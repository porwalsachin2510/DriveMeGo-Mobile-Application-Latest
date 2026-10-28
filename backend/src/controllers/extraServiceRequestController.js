import mongoose from "mongoose"
import ExtraServiceRequest from "../models/ExtraServiceRequest.js"
import Contract from "../models/Contract.js"
import Invoice from "../models/Invoice.js"
import Trip from "../models/Trip.js"
import Vehicle from "../models/Vehicle.js"
import Wallet from "../models/Wallet.js"
import User from "../models/User.js"
import CorporateEmployee from "../models/CorporateEmployee.js"
import { createNotification, sendAdminNotification } from "../Services/notificationService.js"
import { sendTripAssignmentEmail } from "../Services/emailService.js"
import { isCustomerRole, isPartnerRole } from "../utils/roleFamilies.js"
import paymentGatewayService, {
    detectCountryFromCurrency,
    getPaymentGateway,
} from "../Services/paymentGatewayService.js"
import crypto from "crypto"

// Normalize the payment method the customer picked in the modal to a canonical
// code. Accepts both the UI labels and the canonical codes so the same handler
// works no matter how the front-end phrases it.
const ESD_METHOD_MAP = {
    CARD: "CARD",
    "CREDIT CARD": "CARD",
    "CREDIT/DEBIT CARD": "CARD",
    WALLET: "WALLET",
    "MOBILE WALLET": "WALLET",
    BANK_TRANSFER: "BANK_TRANSFER",
    "BANK TRANSFER": "BANK_TRANSFER",
    CASH: "CASH",
}
const normalizeEsdMethod = (m) => ESD_METHOD_MAP[String(m || "").trim().toUpperCase()] || null

// Resolve the driver's *User account* id from a contract driver-model id.
// The operational Trip stores the User id in `driverId` (the driver lifecycle —
// start / share-location / complete — authenticates against the logged-in User),
// so an extra-day trip is only actionable by its driver when we store the User id.
// Returns null when the driver has no linked login (e.g. an unclaimed corporate
// driver record); the caller then falls back to the driver-model id for display.
const resolveDriverUserId = async (driverModelId, driverModel) => {
    if (!driverModelId) return null
    try {
        const query = { driverId: driverModelId }
        if (driverModel) query.driverModel = driverModel
        const user = await User.findOne(query).select("_id")
        return user?._id || null
    } catch (e) {
        console.error("[extraService] resolveDriverUserId error:", e.message)
        return null
    }
}

// Build the passenger manifest for an extra-day trip from the customer company's
// ACTIVE employees/students, so they are invited onto the trip exactly like a
// regular managed trip. This is what makes the extra day show up on each
// passenger's "My trips" / "Track my ride" screen (the employee queries match
// `passengers.passengerId` or `passengers.employeeId`), lets the driver see who
// to pick up, and lets each passenger track the shared driver location.
// Capped to the trip's seat count so we never over-book the assigned vehicle.
const buildExtraServiceManifest = async (request, seats) => {
    const passengers = []
    const employeeUserIds = []
    // Contact records (email + name) so callers can email each invited passenger
    // an assignment confirmation in addition to the in-app notification.
    const passengerContacts = []
    if (!request.customerId) return { passengers, employeeUserIds, passengerContacts }

    const cap = Number(seats) > 0 ? Number(seats) : 0
    const query = CorporateEmployee.find({
        companyId: request.customerId,
        "accessControl.isActive": true,
        // Only invite people currently active for transport — mirrors how
        // transport eligibility is determined elsewhere in the app. Older
        // records without the field are treated as active.
        "transportDetails.transportStatus": { $ne: "TERMINATED", $nin: ["INACTIVE", "SUSPENDED"] },
    })
        .select("userId personalInfo transportDetails")
        .sort({ createdAt: 1 })
    if (cap > 0) query.limit(cap)

    const employees = await query
    for (const emp of employees) {
        const name =
            [emp.personalInfo?.firstName, emp.personalInfo?.lastName].filter(Boolean).join(" ").trim() ||
            "Passenger"
        const pickup = request.pickupLocation || emp.transportDetails?.pickupPoint || ""
        const dropoff = request.dropoffLocation || emp.transportDetails?.dropOffPoint || ""
        const email = emp.personalInfo?.email || null
        if (email) passengerContacts.push({ email, name, pickup, dropoff })
        passengers.push({
            passengerId: emp.userId || undefined,
            employeeId: emp._id,
            name,
            pickupStop: pickup,
            dropoffStop: dropoff,
            pickupPoint: pickup,
            pickupTime: request.departureTime || "",
            status: "CONFIRMED",
            bookingStatus: "CONFIRMED",
            bookedAt: new Date(),
        })
        if (emp.userId) employeeUserIds.push(emp.userId.toString())
    }
    return { passengers, employeeUserIds, passengerContacts }
}
const ONLINE_ESD_METHODS = ["CARD", "WALLET"]
const MANUAL_ESD_METHODS = ["BANK_TRANSFER", "CASH"]

/**
 * Settle a SEPARATE extra-service charge: credit the partner's wallet with the
 * charge (the platform is the ledger of record, so this runs for every payment
 * method), mark the request + its invoice PAID, and notify both sides. Safe to
 * call more than once — it no-ops if the request is already PAID, so the gateway
 * callback and the webhook can both call it without double-crediting.
 *
 * Exported so the payment callback / gateway webhooks can settle a request once
 * the online payment is confirmed by the gateway.
 */
export const settleExtraServiceRequestPayment = async (
    request,
    { method, provider, transactionId } = {}
) => {
    if (!request) return null
    if (request.paymentStatus === "PAID") return request

    const amount = Math.round((request.charge || 0) * 100) / 100
    const currency = request.currency || "AED"
    const resolvedMethod = method || request.paymentMethod || "CARD"
    const label = `Extra service day: ${request.purpose}`

    if (amount > 0) {
        // Partner wallet (create in the same currency if missing).
        let partnerWallet = await Wallet.findOne({ userId: request.partnerId, currency })
        if (!partnerWallet) {
            const existingPartnerWallet = await Wallet.findOne({ userId: request.partnerId })
            if (existingPartnerWallet) {
                partnerWallet = existingPartnerWallet
            } else {
                const partnerUser = await User.findById(request.partnerId).select("role")
                partnerWallet = new Wallet({
                    userId: request.partnerId,
                    role: partnerUser?.role || "B2B_PARTNER",
                    currency,
                    balance: 0,
                    transactions: [],
                })
            }
        }

        partnerWallet.transactions.push({
            type: "BOOKING_EARNING",
            amount: amount,
            description: label,
            senderId: request.customerId,
            senderName: request.customerName,
            status: "COMPLETED",
            createdAt: new Date(),
        })
        partnerWallet.balance = Math.round(((partnerWallet.balance || 0) + amount) * 100) / 100
        await partnerWallet.save()
    }

    const txnId = transactionId || request.transactionId || `ESD-${request._id.toString().slice(-6)}-${Date.now().toString().slice(-6)}`

    request.paymentStatus = "PAID"
    request.paidAt = new Date()
    request.transactionId = txnId
    request.paymentMethod = resolvedMethod
    if (provider) request.paymentProvider = provider
    await request.save()

    if (request.invoiceId) {
        await Invoice.findByIdAndUpdate(request.invoiceId, {
            status: "PAID",
            paidAt: new Date(),
            paymentMethod: resolvedMethod,
            transactionId: txnId,
        })
    }

    await createNotification({
        userId: request.partnerId,
        type: "PAYMENT_RECEIVED",
        title: "Extra service day paid",
        message: `${request.customerName} paid ${amount} ${currency} for "${request.purpose}".`,
        data: {
            extraServiceRequestId: request._id.toString(),
            contractId: request.contractId.toString(),
        },
    })

    return request
}

/**
 * Resolve + settle an extra-service request from a gateway session id. Used by
 * both the browser payment callback and the gateway webhooks. Returns the
 * settled request (or null if none matches this session).
 */
export const settleExtraServicePaymentBySession = async (sessionId, { provider, transactionId } = {}) => {
    if (!sessionId) return null
    const request = await ExtraServiceRequest.findOne({ gatewaySessionId: sessionId })
    if (!request) return null
    return settleExtraServiceRequestPayment(request, {
        provider,
        transactionId,
        method: request.paymentMethod,
    })
}

/**
 * Load a MANAGED contract and confirm the requester is either its customer or
 * its partner. Returns { contract, side } where side is "CUSTOMER" | "PARTNER",
 * or null (after sending a response) when access is denied.
 */
const resolveContractAccess = async (req, res, contractId) => {
    if (!mongoose.Types.ObjectId.isValid(contractId)) {
        res.status(400).json({ success: false, message: "Invalid contract id." })
        return null
    }

    const contract = await Contract.findById(contractId)
        .populate("corporateOwnerId", "fullName companyName")
        .populate("fleetOwnerId", "fullName companyName")

    if (!contract) {
        res.status(404).json({ success: false, message: "Contract not found." })
        return null
    }
    if (contract.serviceMode !== "MANAGED") {
        res.status(403).json({
            success: false,
            message: "Extra service days are only available for managed-service contracts.",
        })
        return null
    }

    const corpId = contract.corporateOwnerId?._id?.toString() || contract.corporateOwnerId?.toString()
    const fleetId = contract.fleetOwnerId?._id?.toString() || contract.fleetOwnerId?.toString()

    let side = null
    if (isCustomerRole(req.userRole) && corpId === req.userId) side = "CUSTOMER"
    else if (isPartnerRole(req.userRole) && fleetId === req.userId) side = "PARTNER"

    if (!side) {
        res.status(403).json({ success: false, message: "You do not have access to this contract." })
        return null
    }

    return { contract, side, corpId, fleetId }
}

const nameOf = (user) => user?.companyName || user?.fullName || "N/A"

// ---------------------------------------------------------------------------
// POST /api/extra-service-requests/:contractId   (customer creates a request)
// ---------------------------------------------------------------------------
export const createExtraServiceRequest = async (req, res) => {
    try {
        const { contractId } = req.params
        const access = await resolveContractAccess(req, res, contractId)
        if (!access) return

        if (access.side !== "CUSTOMER") {
            return res.status(403).json({
                success: false,
                message: "Only the school customer can request extra service days.",
            })
        }

        const {
            purpose,
            serviceDates,
            vehiclesRequired,
            pickupLocation,
            dropoffLocation,
            departureTime,
            expectedReturnTime,
            passengerCount,
            notes,
        } = req.body

        if (!purpose || !Array.isArray(serviceDates) || serviceDates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "A purpose and at least one service date are required.",
            })
        }

        // Normalise + validate dates. Extra days must be in the future.
        const parsedDates = serviceDates
            .map((d) => new Date(d))
            .filter((d) => !isNaN(d.getTime()))
        if (parsedDates.length === 0) {
            return res.status(400).json({ success: false, message: "No valid service dates provided." })
        }
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        if (parsedDates.some((d) => d < startOfToday)) {
            return res.status(400).json({ success: false, message: "Service dates cannot be in the past." })
        }

        const { contract } = access

        // Extra service days are ad-hoc, SEPARATELY-charged add-ons layered on an
        // existing managed contract — NOT part of the recurring contract schedule.
        // A day may legitimately fall AFTER the regular contract term: e.g. a
        // Jan–Mar contract booking a 2-day picnic in May. The customer pays
        // separately for that day and the partner commits the same contract fleet
        // to it, so we do NOT cap extra days at the contract end date.
        //
        // The only floor is the contract START: the relationship (and the fleet
        // committed to it) does not exist before the contract begins, so a day
        // before the start date is rejected. Past dates are already blocked above.
        if (contract.rentalPeriod?.startDate) {
            const termStart = new Date(contract.rentalPeriod.startDate)
            termStart.setHours(0, 0, 0, 0)

            const beforeStart = parsedDates.find((d) => d < termStart)
            if (beforeStart) {
                return res.status(400).json({
                    success: false,
                    message: `Service dates cannot be before the contract starts (${termStart.toLocaleDateString("en-GB")}). ${beforeStart.toLocaleDateString("en-GB")} is before the contract period.`,
                })
            }
        }

        const request = await ExtraServiceRequest.create({
            contractId: contract._id,
            contractNumber: contract.contractNumber,
            customerId: access.corpId,
            customerName: nameOf(contract.corporateOwnerId),
            partnerId: access.fleetId,
            partnerName: nameOf(contract.fleetOwnerId),
            purpose: purpose.trim(),
            serviceDates: parsedDates,
            vehiclesRequired: Math.max(1, parseInt(vehiclesRequired, 10) || 1),
            pickupLocation,
            dropoffLocation,
            departureTime,
            expectedReturnTime,
            passengerCount: passengerCount ? parseInt(passengerCount, 10) : undefined,
            notes,
            currency: contract.financials?.currency || "AED",
            status: "PENDING",
            createdBy: req.userId,
        })

        // Notify the partner.
        await createNotification({
            userId: access.fleetId,
            type: "EXTRA_SERVICE_REQUEST",
            title: "New extra service day request",
            message: `${request.customerName} requested ${parsedDates.length} extra service day(s) on contract ${contract.contractNumber} for: ${request.purpose}`,
            data: { contractId: contract._id.toString(), extraServiceRequestId: request._id.toString() },
        })

        return res.status(201).json({ success: true, data: request })
    } catch (error) {
        console.error("[extraService] createExtraServiceRequest error:", error)
        return res.status(500).json({ success: false, message: "Failed to create extra service request." })
    }
}

// ---------------------------------------------------------------------------
// GET /api/extra-service-requests/:contractId   (both sides list requests)
// ---------------------------------------------------------------------------
export const getExtraServiceRequests = async (req, res) => {
    try {
        const { contractId } = req.params
        const access = await resolveContractAccess(req, res, contractId)
        if (!access) return

        const requests = await ExtraServiceRequest.find({ contractId: access.contract._id })
            .sort({ createdAt: -1 })
            .populate("invoiceId", "invoiceNumber status total currency")

        return res.json({ success: true, data: requests, viewerSide: access.side })
    } catch (error) {
        console.error("[extraService] getExtraServiceRequests error:", error)
        return res.status(500).json({ success: false, message: "Failed to load extra service requests." })
    }
}

// ---------------------------------------------------------------------------
// GET /api/extra-service-requests/mine/all   (list across all my contracts)
// ---------------------------------------------------------------------------
export const getMyExtraServiceRequests = async (req, res) => {
    try {
        const filter = isPartnerRole(req.userRole)
            ? { partnerId: req.userId }
            : { customerId: req.userId }

        if (req.query.status) filter.status = req.query.status

        const requests = await ExtraServiceRequest.find(filter)
            .sort({ createdAt: -1 })
            .populate("invoiceId", "invoiceNumber status total currency")

        return res.json({ success: true, data: requests })
    } catch (error) {
        console.error("[extraService] getMyExtraServiceRequests error:", error)
        return res.status(500).json({ success: false, message: "Failed to load extra service requests." })
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/extra-service-requests/item/:requestId/respond  (partner decision)
// ---------------------------------------------------------------------------
export const respondToExtraServiceRequest = async (req, res) => {
    try {
        const { requestId } = req.params
        const { decision, charge, billingMode, partnerResponseNote } = req.body

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: "Invalid request id." })
        }
        if (!["APPROVE", "REJECT"].includes(decision)) {
            return res.status(400).json({ success: false, message: "Decision must be APPROVE or REJECT." })
        }

        const request = await ExtraServiceRequest.findById(requestId)
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found." })
        }

        // Only the owning partner may respond.
        if (!isPartnerRole(req.userRole) || request.partnerId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Only the school partner can respond to this request.",
            })
        }
        if (request.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: `This request has already been ${request.status.toLowerCase()}.`,
            })
        }

        if (decision === "REJECT") {
            request.status = "REJECTED"
            request.partnerResponseNote = partnerResponseNote
            request.respondedAt = new Date()
            await request.save()

            await createNotification({
                userId: request.customerId,
                type: "EXTRA_SERVICE_REQUEST",
                title: "Extra service day request declined",
                message: `Your extra service request (${request.purpose}) on contract ${request.contractNumber} was declined.`,
                data: { contractId: request.contractId.toString(), extraServiceRequestId: request._id.toString() },
            })

            return res.json({ success: true, data: request })
        }

        // ---- APPROVE ----
        const chargeAmount = Number(charge)
        if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "A positive charge amount is required to approve the request.",
            })
        }
        if (!["SEPARATE", "ADD_TO_CONTRACT"].includes(billingMode)) {
            return res.status(400).json({
                success: false,
                message: "billingMode must be SEPARATE or ADD_TO_CONTRACT.",
            })
        }

        const contract = await Contract.findById(request.contractId)
            .populate("corporateOwnerId", "fullName companyName")
            .populate("fleetOwnerId", "fullName companyName")
        if (!contract) {
            return res.status(404).json({ success: false, message: "Contract not found." })
        }

        const currency = contract.financials?.currency || request.currency || "AED"
        const roundedCharge = Math.round(chargeAmount * 100) / 100

        request.status = "APPROVED"
        request.charge = roundedCharge
        request.currency = currency
        request.billingMode = billingMode
        request.partnerResponseNote = partnerResponseNote
        request.respondedAt = new Date()
        request.paymentStatus = "PENDING"
        // Approved requests now need a vehicle + driver assigned for each date
        // before the fleet actually turns up for the trip.
        request.fulfillmentStatus = "UNASSIGNED"

        const datesLabel = request.serviceDates
            .map((d) => new Date(d).toLocaleDateString("en-GB"))
            .join(", ")
        const description = `Extra service day(s) [${datesLabel}] - ${request.purpose}`

        // Create the invoice for the extra service charge (idempotent via sourceKey).
        const sourceKey = `${contract._id}:EXTRA_SERVICE:${request._id}`
        const baseNumber = contract.contractNumber || contract._id.toString().slice(-6)
        const invoice = await Invoice.create({
            invoiceNumber: `B2B-INV-${baseNumber}-EXTRA-${request._id.toString().slice(-4)}`,
            sourceKey,
            contractId: contract._id,
            contractNumber: contract.contractNumber,
            fleetOwnerId: contract.fleetOwnerId?._id || contract.fleetOwnerId,
            fleetOwnerName: nameOf(contract.fleetOwnerId),
            corporateOwnerId: contract.corporateOwnerId?._id || contract.corporateOwnerId,
            corporateName: nameOf(contract.corporateOwnerId),
            type: "OPERATIONAL",
            issueDate: new Date(),
            dueDate: request.serviceDates[0],
            lineItems: [
                {
                    description,
                    quantity: request.vehiclesRequired || 1,
                    unitPrice: Math.round((roundedCharge / (request.vehiclesRequired || 1)) * 100) / 100,
                    amount: roundedCharge,
                },
            ],
            currency,
            status: "PENDING",
            notes:
                billingMode === "ADD_TO_CONTRACT"
                    ? "Extra service day charge folded into the contract balance."
                    : "Standalone extra service day charge.",
        })

        request.invoiceId = invoice._id

        // For ADD_TO_CONTRACT, fold the charge into the contract's financials so
        // it is collected together with the contract balance.
        if (billingMode === "ADD_TO_CONTRACT") {
            contract.financials.totalAmount = Math.round(((contract.financials.totalAmount || 0) + roundedCharge) * 100) / 100
            contract.financials.remainingAmount = Math.round(((contract.financials.remainingAmount || 0) + roundedCharge) * 100) / 100
            if (contract.financials.finalPayment) {
                contract.financials.finalPayment.amount = Math.round(((contract.financials.finalPayment.amount || 0) + roundedCharge) * 100) / 100
                if (contract.financials.finalPayment.status === "PAID") {
                    // Re-open the final payment so the extra charge is collectible.
                    contract.financials.finalPayment.status = "PENDING"
                }
            }
            if (contract.financials.paymentStatus === "COMPLETED") {
                contract.financials.paymentStatus = "PARTIAL"
            }
            await contract.save()
        }

        await request.save()

        await createNotification({
            userId: request.customerId,
            type: "EXTRA_SERVICE_REQUEST",
            title: "Extra service day request approved",
            message: `Your extra service request (${request.purpose}) was approved. Charge: ${roundedCharge} ${currency} (${billingMode === "ADD_TO_CONTRACT" ? "added to contract" : "separate invoice"}).`,
            data: { contractId: contract._id.toString(), extraServiceRequestId: request._id.toString(), invoiceId: invoice._id.toString() },
        })

        return res.json({ success: true, data: request, invoice })
    } catch (error) {
        console.error("[extraService] respondToExtraServiceRequest error:", error)
        return res.status(500).json({ success: false, message: "Failed to respond to extra service request." })
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/extra-service-requests/item/:requestId/cancel  (customer cancels)
// ---------------------------------------------------------------------------
export const cancelExtraServiceRequest = async (req, res) => {
    try {
        const { requestId } = req.params
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: "Invalid request id." })
        }

        const request = await ExtraServiceRequest.findById(requestId)
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found." })
        }
        if (!isCustomerRole(req.userRole) || request.customerId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Only the requesting school customer can cancel this request.",
            })
        }

        // A PENDING request can always be cancelled (nothing has happened yet).
        // An APPROVED request can still be cancelled *before* any money is taken
        // and *before* the fleet actually starts running — but doing so has to
        // unwind the invoice, any contract-balance change and the scheduled
        // trips the approval created. Once it's PAID or a trip is in progress /
        // completed, it can no longer be cancelled.
        if (!["PENDING", "APPROVED"].includes(request.status)) {
            return res.status(400).json({
                success: false,
                message: `A ${request.status.toLowerCase()} request can no longer be cancelled.`,
            })
        }
        if (request.status === "APPROVED") {
            if (request.paymentStatus === "PAID") {
                return res.status(400).json({
                    success: false,
                    message: "This request is already paid and can no longer be cancelled.",
                })
            }
            if (request.paymentStatus === "PROCESSING") {
                return res.status(400).json({
                    success: false,
                    message: "A payment is in progress for this request. Wait for it to settle before cancelling.",
                })
            }
            if (["IN_PROGRESS", "COMPLETED"].includes(request.fulfillmentStatus)) {
                return res.status(400).json({
                    success: false,
                    message: "The fleet is already running this extra service day, so it can no longer be cancelled.",
                })
            }

            // 1) Void the extra-service invoice (if one was raised on approval).
            if (request.invoiceId) {
                await Invoice.findByIdAndUpdate(request.invoiceId, {
                    status: "CANCELLED",
                    notes: "Extra service day cancelled by the customer before payment.",
                })
            }

            // 2) Reverse an ADD_TO_CONTRACT charge back out of the contract
            //    financials so the customer isn't billed for a cancelled day.
            if (request.billingMode === "ADD_TO_CONTRACT" && request.charge > 0) {
                const contract = await Contract.findById(request.contractId)
                if (contract?.financials) {
                    const c = Math.round((request.charge || 0) * 100) / 100
                    const f = contract.financials
                    f.totalAmount = Math.max(0, Math.round(((f.totalAmount || 0) - c) * 100) / 100)
                    f.remainingAmount = Math.max(0, Math.round(((f.remainingAmount || 0) - c) * 100) / 100)
                    if (f.finalPayment) {
                        f.finalPayment.amount = Math.max(0, Math.round(((f.finalPayment.amount || 0) - c) * 100) / 100)
                    }
                    await contract.save()
                }
            }

            // 3) Remove any scheduled trips the assignment created.
            const tripIds = (request.assignments || []).map((a) => a.tripId).filter(Boolean)
            if (tripIds.length) {
                await Trip.deleteMany({ _id: { $in: tripIds }, status: { $in: ["SCHEDULED", "Scheduled"] } })
            }
            request.assignments = []
            request.fulfillmentStatus = "NOT_REQUIRED"
            request.paymentStatus = "NOT_APPLICABLE"
        }

        request.status = "CANCELLED"
        await request.save()

        await createNotification({
            userId: request.partnerId,
            type: "EXTRA_SERVICE_REQUEST",
            title: "Extra service day request cancelled",
            message: `${request.customerName} cancelled their extra service request (${request.purpose}) on contract ${request.contractNumber}.`,
            data: { contractId: request.contractId.toString(), extraServiceRequestId: request._id.toString() },
        })

        return res.json({ success: true, data: request })
    } catch (error) {
        console.error("[extraService] cancelExtraServiceRequest error:", error)
        return res.status(500).json({ success: false, message: "Failed to cancel extra service request." })
    }
}

// ---------------------------------------------------------------------------
// GET /api/extra-service-requests/:contractId/fleet  (partner: assignable fleet)
// ---------------------------------------------------------------------------
// Returns the vehicles + drivers that are attached to this managed contract, so
// the partner can pick which of the fleet they've committed to the customer
// goes out on the extra day.
export const getAssignableFleet = async (req, res) => {
    try {
        const { contractId } = req.params
        const access = await resolveContractAccess(req, res, contractId)
        if (!access) return

        if (access.side !== "PARTNER") {
            return res.status(403).json({
                success: false,
                message: "Only the operating partner can view the assignable fleet.",
            })
        }

        const contract = await Contract.findById(access.contract._id)
            .populate("vehicles.assignedVehicles.vehicleId", "vehicleName registrationNumber capacity make model")
            .populate("vehicles.assignedVehicles.driverId", "name phone fullName")

        // Return ONE entry per assigned unit (subdocument), NOT one per vehicle.
        // A contract vehicle booked with quantity > 1 has several assignedVehicles
        // entries that can share the same vehicleId / registration but each carry
        // their own driver (e.g. 3 units of "Tata Motors 2026" driven by G, E and
        // H). Deduplicating by vehicleId used to collapse them into a single unit,
        // which is why the assign modal only ever offered one driver and then
        // stored a different one. Each unit is uniquely identified by its
        // subdocument _id (`unitId`) so all drivers stay individually selectable
        // and the stored driver always matches the chosen one.
        const fleet = []
        for (const group of contract.vehicles || []) {
            for (const av of group.assignedVehicles || []) {
                const vId = av.vehicleId?._id?.toString() || av.vehicleId?.toString()
                if (!vId || !av?._id) continue
                const v = av.vehicleId
                const d = av.driverId
                fleet.push({
                    unitId: av._id.toString(),
                    vehicleId: vId,
                    vehicleLabel: v?.vehicleName
                        ? `${v.vehicleName}${v.registrationNumber ? ` (${v.registrationNumber})` : ""}`
                        : v?.registrationNumber || "Vehicle",
                    seatingCapacity: v?.capacity?.seatingCapacity || null,
                    driverId: d?._id?.toString() || (av.driverId ? av.driverId.toString() : null),
                    driverModel: av.driverModel || "Driver",
                    driverName: d?.name || d?.fullName || null,
                    driverPhone: d?.phone || null,
                })
            }
        }

        return res.json({ success: true, data: fleet })
    } catch (error) {
        console.error("[extraService] getAssignableFleet error:", error)
        return res.status(500).json({ success: false, message: "Failed to load assignable fleet." })
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/extra-service-requests/item/:requestId/assign  (partner assigns)
// ---------------------------------------------------------------------------
// The partner assigns a vehicle + driver for each requested date. Each date
// becomes a real Trip the assigned driver sees on that day, so the fleet turns
// up for the picnic/event. Re-running replaces the previous assignment (any
// prior scheduled extra-day trips are removed and recreated).
export const assignExtraServiceResources = async (req, res) => {
    try {
        const { requestId } = req.params
        const { assignments } = req.body // [{ serviceDate, vehicleId, driverId }]

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: "Invalid request id." })
        }
        if (!Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({ success: false, message: "At least one assignment is required." })
        }

        const request = await ExtraServiceRequest.findById(requestId)
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found." })
        }
        if (!isPartnerRole(req.userRole) || request.partnerId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Only the operating partner can assign the fleet for this request.",
            })
        }
        if (request.status !== "APPROVED") {
            return res.status(400).json({
                success: false,
                message: "Only approved requests can be assigned a vehicle and driver.",
            })
        }
        if (["IN_PROGRESS", "COMPLETED"].includes(request.fulfillmentStatus)) {
            return res.status(400).json({
                success: false,
                message: "This request is already being fulfilled and can no longer be reassigned.",
            })
        }

        const contract = await Contract.findById(request.contractId)
            .populate("vehicles.assignedVehicles.vehicleId", "vehicleName registrationNumber capacity")
            .populate("vehicles.assignedVehicles.driverId", "name phone fullName email")
        if (!contract) {
            return res.status(404).json({ success: false, message: "Contract not found." })
        }

        // Build a lookup of the contract's assigned units keyed by the
        // assignedVehicles subdocument _id (`unitId`). Keying by unitId — rather
        // than vehicleId — keeps every unit of a quantity>1 vehicle distinct, so
        // the driver committed to the chosen unit is the driver that actually
        // gets stored (fixing the "assigned G but saved H" mismatch). We also
        // keep a vehicleId index for backward compatibility with older payloads
        // that only sent a vehicleId (+ optional driverId).
        const unitMap = new Map()
        const unitsByVehicle = new Map()
        for (const group of contract.vehicles || []) {
            for (const av of group.assignedVehicles || []) {
                if (!av?._id) continue
                unitMap.set(av._id.toString(), av)
                const vId = av.vehicleId?._id?.toString() || av.vehicleId?.toString()
                if (vId) {
                    if (!unitsByVehicle.has(vId)) unitsByVehicle.set(vId, [])
                    unitsByVehicle.get(vId).push(av)
                }
            }
        }

        // The set of valid service dates on this request (compare by day).
        const dayKey = (d) => new Date(d).toISOString().slice(0, 10)
        const validDates = new Set((request.serviceDates || []).map(dayKey))

        // Ids of this request's own (still-scheduled) trips — excluded from the
        // double-booking check below and deleted before we recreate them.
        // Both legs (going + return) of every previous assignment — excluded from
        // the double-booking check below and deleted before we recreate them.
        const oldTripIds = (request.assignments || [])
            .flatMap((a) => [a.tripId, a.returnTripId])
            .filter(Boolean)

        // ---- PASS 1: validate + resolve every assignment before touching the
        // database. This makes the assign atomic in effect: if any date/vehicle
        // is invalid, or a vehicle/driver is already booked elsewhere that day,
        // we reject the whole request instead of leaving half-created trips. ----
        const prepared = []
        const seenDayUnit = new Set() // guard against the same unit twice on one date within this payload

        for (const a of assignments) {
            if (!a?.serviceDate) continue
            if (!validDates.has(dayKey(a.serviceDate))) {
                return res.status(400).json({
                    success: false,
                    message: "One of the assignment dates is not part of this request.",
                })
            }

            // Resolve the exact assigned unit. The assign modal sends a `unitId`
            // (the assignedVehicles subdocument id) which uniquely pins down BOTH
            // the vehicle and its committed driver. Fall back to legacy payloads
            // that only carried a vehicleId (+ optional driverId) so nothing that
            // was working before breaks.
            let av = null
            if (a.unitId && unitMap.has(a.unitId.toString())) {
                av = unitMap.get(a.unitId.toString())
            } else if (a.vehicleId) {
                const units = unitsByVehicle.get(a.vehicleId.toString()) || []
                av =
                    (a.driverId &&
                        units.find(
                            (u) =>
                                (u.driverId?._id?.toString() || u.driverId?.toString()) ===
                                a.driverId.toString(),
                        )) ||
                    units[0] ||
                    null
            }
            if (!av) {
                return res.status(400).json({
                    success: false,
                    message: "Selected vehicle is not assigned to this contract.",
                })
            }

            const unitKey = av._id.toString()
            const vehicleId = av.vehicleId?._id || av.vehicleId
            if (!vehicleId) {
                return res.status(400).json({
                    success: false,
                    message: "The selected unit has no vehicle attached.",
                })
            }

            const dupKey = `${dayKey(a.serviceDate)}:${unitKey}`
            if (seenDayUnit.has(dupKey)) {
                return res.status(400).json({
                    success: false,
                    message: "The same vehicle unit can't be assigned twice on the same date.",
                })
            }
            seenDayUnit.add(dupKey)

            // The driver is whatever is committed to this specific unit — no
            // separate override, so the stored driver always matches the choice.
            const driverId = av.driverId?._id || av.driverId
            const driverModel = av.driverModel || "Driver"
            const driverDoc = av.driverId

            // Resolve the driver's login account so the driver can actually
            // operate the trip (start / share location / complete). Fall back to
            // the driver-model id for display when there is no linked account.
            const driverUserId = driverId ? await resolveDriverUserId(driverId, driverModel) : null

            // ---- Double-booking guard ----
            // A contract vehicle/driver can only be in one place at a time. Reject
            // if this vehicle (or its driver) is already committed to another
            // active trip on the same calendar day — whether that's a regular
            // contract trip or another extra-service day. We compare the whole day
            // because extra-day trips don't have precise slot scheduling.
            const dayStart = new Date(a.serviceDate)
            dayStart.setHours(0, 0, 0, 0)
            const dayEnd = new Date(dayStart)
            dayEnd.setDate(dayEnd.getDate() + 1)

            // Only guard against a driver double-booking. Units of the same
            // quantity>1 vehicle share a vehicleId, so a vehicleId-based clash
            // would wrongly block a second unit (a different physical driver)
            // from going out the same day. The driver is the real single-use
            // resource here, so we conflict on the assigned driver only.
            const driverForConflict = driverUserId || driverId
            const conflict = driverForConflict
                ? await Trip.findOne({
                      _id: { $nin: oldTripIds },
                      extraServiceRequestId: { $ne: request._id },
                      tripDate: { $gte: dayStart, $lt: dayEnd },
                      status: { $in: ["SCHEDULED", "IN_PROGRESS", "Scheduled", "InProgress"] },
                      driverId: driverForConflict,
                  }).select("_id vehicleId driverId")
                : null

            if (conflict) {
                return res.status(409).json({
                    success: false,
                    message: `The selected driver is already booked on another trip on ${new Date(a.serviceDate).toLocaleDateString("en-GB")}. Pick a different unit/driver or date.`,
                })
            }

            prepared.push({ a, av, vehicleId, driverId, driverModel, driverDoc, driverUserId })
        }

        if (prepared.length === 0) {
            return res.status(400).json({ success: false, message: "No valid assignments were provided." })
        }

        // ---- PASS 2: all validated — remove the previous scheduled trips and
        // create the new ones. ----
        if (oldTripIds.length) {
            await Trip.deleteMany({ _id: { $in: oldTripIds }, status: { $in: ["SCHEDULED", "Scheduled"] } })
        }

        const newAssignments = []
        const driverNotifyIds = new Set()
        const passengerNotifyIds = new Set()
        // Assignment-confirmation emails to send once the request is persisted.
        // Collected per created trip so each recipient gets that trip's exact
        // vehicle/driver/date. Dispatched best-effort after save.
        const emailJobs = []

        for (const { a, av, vehicleId, driverId, driverModel, driverDoc, driverUserId } of prepared) {
            const vehicle = av.vehicleId
            const seats =
                request.passengerCount ||
                vehicle?.capacity?.seatingCapacity ||
                30
            const vehicleLabel = vehicle?.vehicleName
                ? `${vehicle.vehicleName}${vehicle.registrationNumber ? ` (${vehicle.registrationNumber})` : ""}`
                : vehicle?.registrationNumber || "Vehicle"
            const driverName = driverDoc?.name || driverDoc?.fullName || null
            const driverPhone = driverDoc?.phone || null

            // Students are NOT auto-invited. The partner explicitly adds the
            // specific students who travel on this extra day from the roster
            // panel, mirroring the regular managed flow. Both legs therefore
            // start empty — every seat is available until a student is assigned.
            const origin = request.pickupLocation || "School"
            const destination = request.dropoffLocation || request.purpose

            // A round-trip extra day is TWO real trips the driver runs (and
            // starts/completes) independently, exactly like a regular managed
            // day's going + return legs. Every assigned unit gets BOTH an
            // outbound leg (origin -> destination) and a return leg
            // (destination -> origin). Students are then added to the leg(s)
            // they actually ride, so a round-trip student sees a separate trip
            // per leg on the service date.
            const commonTripFields = {
                contractId: contract._id,
                extraServiceRequestId: request._id,
                routeId: undefined,
                vehicleId: vehicleId,
                driverId: driverUserId || driverId || undefined,
                corporateId: request.customerId,
                b2bPartnerId: request.partnerId,
                tripDate: new Date(a.serviceDate),
                tripType: "ONE_WAY",
                totalSeats: seats,
                availableSeats: seats,
                bookedSeats: 0,
                passengers: [],
                currency: request.currency || "AED",
                status: "SCHEDULED",
                createdBy: req.userId,
            }

            // Outbound leg: origin -> destination (the "going" trip).
            const outboundTrip = await Trip.create({
                ...commonTripFields,
                startTime: request.departureTime || "08:00",
                endTime: request.expectedReturnTime || "",
                direction: "FORWARD",
                scheduleIndex: 0,
                fromLocation: origin,
                toLocation: destination,
                events: [
                    {
                        eventType: driverId ? "DRIVER_ASSIGNED" : "VEHICLE_ASSIGNED",
                        description: `Extra service day (going): ${request.purpose}`,
                    },
                ],
            })

            // Return leg: destination -> origin (the "coming back" trip). Runs at
            // the expected return time and is a distinct trip the driver
            // starts/completes on its own.
            const returnTrip = await Trip.create({
                ...commonTripFields,
                startTime: request.expectedReturnTime || request.departureTime || "08:00",
                endTime: "",
                direction: "RETURN",
                scheduleIndex: 1,
                fromLocation: destination,
                toLocation: origin,
                events: [
                    {
                        eventType: driverId ? "DRIVER_ASSIGNED" : "VEHICLE_ASSIGNED",
                        description: `Extra service day (return): ${request.purpose}`,
                    },
                ],
            })

            newAssignments.push({
                serviceDate: new Date(a.serviceDate),
                vehicleId: vehicleId,
                vehicleLabel,
                driverId: driverId || undefined,
                driverModel,
                driverName,
                driverPhone,
                tripId: outboundTrip._id,
                returnTripId: returnTrip._id,
                status: "SCHEDULED",
                assignedAt: new Date(),
            })

            if (driverId) driverNotifyIds.add(driverId.toString())

            // ---- Assignment-confirmation emails ----
            // Driver + each invited passenger get an email for this specific
            // trip (its vehicle, driver and service date), mirroring the in-app
            // notifications below. Resolved here while we still hold the trip's
            // full context.
            const tripTimeText = [request.departureTime, request.expectedReturnTime]
                .filter(Boolean)
                .join(" - ")
            const routeLabel = [request.pickupLocation, request.dropoffLocation || request.purpose]
                .filter(Boolean)
                .join(" -> ")

            let driverEmail = driverDoc?.email || null
            if (!driverEmail && driverUserId) {
                const du = await User.findById(driverUserId).select("email")
                driverEmail = du?.email || null
            }
            if (driverEmail) {
                emailJobs.push({
                    to: driverEmail,
                    recipientName: driverName || "Driver",
                    recipientType: "DRIVER",
                    tripTitle: request.purpose,
                    serviceDate: a.serviceDate,
                    timeText: tripTimeText,
                    vehicleLabel,
                    routeLabel,
                    pickup: request.pickupLocation || "",
                    dropoff: request.dropoffLocation || "",
                    isExtraService: true,
                })
            }
        }

        request.assignments = newAssignments
        request.fulfillmentStatus = "ASSIGNED"
        await request.save()

        // Notify each assigned driver (resolve driver-model id -> user account).
        for (const drvId of driverNotifyIds) {
            try {
                const driverUser = await User.findOne({ driverId: drvId }).select("_id")
                const notifyUserId = driverUser?._id || drvId
                await createNotification({
                    userId: notifyUserId,
                    type: "TRIP_ASSIGNED",
                    title: "Extra service day assigned",
                    message: `You have an extra service trip for ${request.customerName}: ${request.purpose}. Check your trips on the service date.`,
                    data: { extraServiceRequestId: request._id.toString(), contractId: contract._id.toString() },
                })
            } catch (e) {
                console.error("[extraService] driver notify failed:", e.message)
            }
        }

        // Notify the customer that the fleet is confirmed.
        await createNotification({
            userId: request.customerId,
            type: "EXTRA_SERVICE_REQUEST",
            title: "Extra service day — fleet assigned",
            message: `Your partner assigned ${newAssignments.length} vehicle(s)/driver(s) for "${request.purpose}". You're all set for the trip.`,
            data: { contractId: contract._id.toString(), extraServiceRequestId: request._id.toString() },
        })

        // Notify each invited passenger so the extra day shows up on their trips.
        for (const passengerUserId of passengerNotifyIds) {
            try {
                await createNotification({
                    userId: passengerUserId,
                    type: "TRIP_ASSIGNED",
                    title: "You're booked on an extra service trip",
                    message: `An extra service trip has been scheduled: ${request.purpose}. Check "My trips" on the service date to track your ride.`,
                    data: { extraServiceRequestId: request._id.toString(), contractId: contract._id.toString() },
                })
            } catch (e) {
                console.error("[extraService] passenger notify failed:", e.message)
            }
        }

        // Dispatch assignment-confirmation emails to the driver(s) and every
        // invited passenger. Best-effort: a mail failure never fails the assign.
        if (emailJobs.length) {
            try {
                await Promise.allSettled(emailJobs.map((job) => sendTripAssignmentEmail(job)))
            } catch (e) {
                console.error("[extraService] assignment emails failed:", e.message)
            }
        }

        return res.json({ success: true, data: request })
    } catch (error) {
        console.error("[extraService] assignExtraServiceResources error:", error)
        return res.status(500).json({ success: false, message: "Failed to assign the fleet for this request." })
    }
}

// ---------------------------------------------------------------------------
// POST /api/extra-service-requests/item/:requestId/pay  (customer pays)
// ---------------------------------------------------------------------------
// Starts payment for a SEPARATE extra-service charge using the method the
// customer picked in the modal, exactly like a contract payment:
//   - CARD / WALLET      -> create a real gateway checkout (Stripe for AED,
//                           TAP for KWD) and return its paymentUrl. The browser
//                           redirects, and the payment callback + gateway
//                           webhook settle the request once the gateway confirms.
//   - BANK_TRANSFER/CASH -> record a manual submission (PROCESSING) and notify
//                           the partner to confirm they received the money.
// ADD_TO_CONTRACT charges are collected with the contract and are not payable here.
export const payExtraServiceRequest = async (req, res) => {
    try {
        const { requestId } = req.params
        const { paymentMethod } = req.body || {}

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: "Invalid request id." })
        }

        const method = normalizeEsdMethod(paymentMethod)
        if (!method) {
            return res.status(400).json({ success: false, message: "Please choose a valid payment method." })
        }

        const request = await ExtraServiceRequest.findById(requestId)
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found." })
        }
        if (!isCustomerRole(req.userRole) || request.customerId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Only the requesting school customer can pay for this request.",
            })
        }
        if (request.status !== "APPROVED") {
            return res.status(400).json({ success: false, message: "Only approved requests can be paid." })
        }
        if (request.billingMode !== "SEPARATE") {
            return res.status(400).json({
                success: false,
                message: "This charge is collected with your contract, not as a separate payment.",
            })
        }
        if (request.paymentStatus === "PAID") {
            return res.status(400).json({ success: false, message: "This request is already paid." })
        }
        // A manual (cash/bank) submission is already awaiting the partner's
        // confirmation — don't let the customer double-submit it.
        if (request.paymentStatus === "PROCESSING" && MANUAL_ESD_METHODS.includes(request.paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Your payment is already submitted and awaiting your partner's confirmation.",
            })
        }

        const amount = Math.round((request.charge || 0) * 100) / 100
        if (!(amount > 0)) {
            return res.status(400).json({ success: false, message: "Nothing to pay for this request." })
        }

        const currency = request.currency || "AED"

        // Respect the platform switch that turns off online payments.
        if (ONLINE_ESD_METHODS.includes(method)) {
            const country = detectCountryFromCurrency(currency)
            const gateway = getPaymentGateway(country)

            const customer = await User.findById(request.customerId).select("email fullName companyName phone")
            const redirectBase = (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim()

            try {
                const paymentSession = await paymentGatewayService.createPaymentSession({
                    gateway,
                    amount,
                    currency,
                    customer: {
                        email: customer?.email,
                        name: customer?.companyName || customer?.fullName || "Customer",
                        phone: customer?.phone,
                    },
                    contractId: request.contractId,
                    redirectUrl: `${redirectBase}/payment/callback`,
                    metadata: {
                        type: "EXTRA_SERVICE",
                        extraServiceRequestId: request._id.toString(),
                        contractId: request.contractId.toString(),
                        method,
                    },
                })

                request.paymentStatus = "PROCESSING"
                request.paymentMethod = method
                request.paymentProvider = gateway
                request.gatewaySessionId = paymentSession.sessionId
                request.paymentReference = `ESD-${request._id.toString().slice(-6)}-${Date.now().toString().slice(-6)}`
                request.paymentSubmittedAt = new Date()
                await request.save()

                return res.json({
                    success: true,
                    message: "Payment session created successfully",
                    data: { paymentSession },
                })
            } catch (gwError) {
                console.error("[extraService] gateway session error:", gwError.message)
                return res.status(500).json({
                    success: false,
                    message: "Failed to start the online payment. Please try again.",
                })
            }
        }

        // Manual methods — record the submission and ask the partner to confirm.
        const reference = `ESD-${request._id.toString().slice(-6)}-${Date.now().toString().slice(-6)}`
        request.paymentStatus = "PROCESSING"
        request.paymentMethod = method
        request.paymentProvider = "MANUAL"
        request.gatewaySessionId = null
        request.paymentReference = reference
        request.paymentSubmittedAt = new Date()
        await request.save()

        await createNotification({
            userId: request.partnerId,
            type: "PAYMENT_SUBMITTED",
            title: "Extra service payment submitted",
            message: `${request.customerName} submitted a ${method === "CASH" ? "cash" : "bank transfer"} payment of ${amount} ${currency} for "${request.purpose}". Confirm once you receive it.`,
            data: {
                extraServiceRequestId: request._id.toString(),
                contractId: request.contractId.toString(),
                reference,
            },
        })

        return res.json({
            success: true,
            message:
                method === "CASH"
                    ? "Cash payment recorded. Your partner will confirm once collected."
                    : "Bank transfer recorded. Your partner will confirm once received.",
            data: { request, reference, manual: true },
        })
    } catch (error) {
        console.error("[extraService] payExtraServiceRequest error:", error)
        return res.status(500).json({ success: false, message: "Failed to start payment for this request." })
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/extra-service-requests/item/:requestId/confirm-payment  (partner)
// ---------------------------------------------------------------------------
// The partner confirms they received a cash/bank-transfer payment the customer
// submitted, which settles the request (credits the partner + marks the invoice
// PAID). Online (CARD/WALLET) payments settle automatically via the gateway and
// cannot be confirmed manually here.
export const confirmExtraServiceRequestPayment = async (req, res) => {
    try {
        const { requestId } = req.params
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: "Invalid request id." })
        }

        const request = await ExtraServiceRequest.findById(requestId)
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found." })
        }
        if (!isPartnerRole(req.userRole) || request.partnerId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Only the operating partner can confirm this payment.",
            })
        }
        if (request.paymentStatus === "PAID") {
            return res.status(400).json({ success: false, message: "This request is already paid." })
        }
        if (request.paymentStatus !== "PROCESSING" || !MANUAL_ESD_METHODS.includes(request.paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "There is no cash/bank payment awaiting your confirmation for this request.",
            })
        }

        const settled = await settleExtraServiceRequestPayment(request, {
            method: request.paymentMethod,
            provider: "MANUAL",
            transactionId: request.paymentReference,
        })

        await createNotification({
            userId: request.customerId,
            type: "PAYMENT_RECEIVED",
            title: "Extra service payment confirmed",
            message: `Your partner confirmed the ${request.paymentMethod === "CASH" ? "cash" : "bank transfer"} payment for "${request.purpose}".`,
            data: {
                extraServiceRequestId: request._id.toString(),
                contractId: request.contractId.toString(),
            },
        })

        return res.json({ success: true, data: settled })
    } catch (error) {
        console.error("[extraService] confirmExtraServiceRequestPayment error:", error)
        return res.status(500).json({ success: false, message: "Failed to confirm the payment." })
    }
}

// ---------------------------------------------------------------------------
// syncExtraServiceFulfillment (helper — called from the Trip lifecycle)
// ---------------------------------------------------------------------------
// Keeps an extra-service request's fulfillmentStatus in step with the real
// Trips assigned to it, so the request reflects what actually happened on the
// road instead of getting stuck at ASSIGNED forever:
//   - any assigned trip started/completed  -> IN_PROGRESS
//   - every non-cancelled assigned trip done -> COMPLETED
// Called after a driver starts or completes an extra-day trip. Idempotent and
// fully guarded — it never throws into the trip flow (a failure here must not
// block the driver's start/complete action), and only ever moves the status
// forward for a request that was already ASSIGNED or beyond.
export const syncExtraServiceFulfillment = async (extraServiceRequestId) => {
    try {
        if (!extraServiceRequestId || !mongoose.Types.ObjectId.isValid(extraServiceRequestId)) return null

        const request = await ExtraServiceRequest.findById(extraServiceRequestId)
        if (!request) return null

        // Only meaningful once a fleet has been assigned. Untouched / rejected /
        // cancelled requests have no trips to reconcile.
        if (!["ASSIGNED", "IN_PROGRESS", "COMPLETED"].includes(request.fulfillmentStatus)) return request
        if (request.fulfillmentStatus === "COMPLETED") return request

        const trips = await Trip.find({ extraServiceRequestId: request._id }).select("status")
        if (!trips.length) return request

        const norm = (s) => String(s || "").toUpperCase()
        // Map each trip's live status onto the request's per-date assignment, so
        // the customer/partner see progress date-by-date, not just an overall flag.
        const tripStatusById = new Map(trips.map((t) => [t._id.toString(), norm(t.status)]))
        // An assignment now spans two legs (going + return). Combine them into a
        // single assignment status: completed only when both legs are done, in
        // progress if either leg is moving, cancelled only if both are cancelled.
        const combineLegStatus = (sa, sb) => {
            const list = [sa, sb].filter(Boolean)
            if (!list.length) return null
            const active = list.filter((s) => s !== "CANCELLED")
            if (!active.length) return "CANCELLED"
            if (active.every((s) => s === "COMPLETED")) return "COMPLETED"
            if (active.some((s) => ["IN_PROGRESS", "COMPLETED"].includes(s))) return "IN_PROGRESS"
            return "SCHEDULED"
        }
        request.assignments.forEach((a) => {
            const so = a.tripId ? tripStatusById.get(a.tripId.toString()) : null
            const sr = a.returnTripId ? tripStatusById.get(a.returnTripId.toString()) : null
            const s = combineLegStatus(so, sr)
            if (s && ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(s)) {
                a.status = s
            }
        })

        const active = trips.filter((t) => norm(t.status) !== "CANCELLED")
        // If every trip was cancelled there is nothing left to run — leave it as-is.
        if (!active.length) {
            await request.save()
            return request
        }

        const allDone = active.every((t) => norm(t.status) === "COMPLETED")
        const anyMoving = active.some((t) => ["IN_PROGRESS", "COMPLETED"].includes(norm(t.status)))

        let next = request.fulfillmentStatus
        if (allDone) next = "COMPLETED"
        else if (anyMoving) next = "IN_PROGRESS"

        const changed = next !== request.fulfillmentStatus
        request.fulfillmentStatus = next
        if (next === "COMPLETED" && !request.completedAt) request.completedAt = new Date()
        await request.save()

        if (!changed) return request

        // Notify both sides when the whole extra service day is done.
        if (next === "COMPLETED") {
            await Promise.all([
                createNotification({
                    userId: request.customerId,
                    type: "EXTRA_SERVICE_REQUEST",
                    title: "Extra service day completed",
                    message: `Your extra service day "${request.purpose}" has been completed.`,
                    data: {
                        contractId: request.contractId.toString(),
                        extraServiceRequestId: request._id.toString(),
                    },
                }).catch(() => { }),
                createNotification({
                    userId: request.partnerId,
                    type: "EXTRA_SERVICE_REQUEST",
                    title: "Extra service day completed",
                    message: `The extra service day "${request.purpose}" for ${request.customerName} is now complete.`,
                    data: {
                        contractId: request.contractId.toString(),
                        extraServiceRequestId: request._id.toString(),
                    },
                }).catch(() => { }),
            ])
        }

        return request
    } catch (error) {
        console.error("[extraService] syncExtraServiceFulfillment error:", error.message)
        return null
    }
}

// ---------------------------------------------------------------------------
// GET /api/extra-service-requests/item/:requestId/roster
// ---------------------------------------------------------------------------
// Returns, per assigned service date/trip, the exact vehicle + driver committed
// to that date and the students currently travelling on it, plus the customer
// company's active students that can still be added. This powers the "add
// students to the extra service day" panel: the partner picks which students
// travel on each assigned unit for the extra date, so every student's trip
// clearly shows the specific vehicle + driver that runs it. Visible to both the
// operating partner (who can manage) and the school customer (read-only).
export const getExtraServiceRoster = async (req, res) => {
    try {
        const { requestId } = req.params
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: "Invalid request id." })
        }

        const request = await ExtraServiceRequest.findById(requestId)
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found." })
        }

        const isPartner = isPartnerRole(req.userRole) && request.partnerId.toString() === req.userId
        const isCustomer = isCustomerRole(req.userRole) && request.customerId.toString() === req.userId
        if (!isPartner && !isCustomer) {
            return res.status(403).json({ success: false, message: "You don't have access to this request." })
        }

        const trips = await Trip.find({ extraServiceRequestId: request._id })
            .select("_id tripDate status totalSeats bookedSeats availableSeats passengers direction")
            .lean()
        const tripById = new Map(trips.map((t) => [t._id.toString(), t]))

        const norm = (s) => String(s || "").toUpperCase()
        // Combine the two legs' statuses into one status for the date group.
        const combineStatus = (a, b) => {
            const list = [a, b].filter(Boolean).map(norm)
            if (!list.length) return "SCHEDULED"
            const active = list.filter((s) => s !== "CANCELLED")
            if (!active.length) return "CANCELLED"
            if (active.every((s) => s === "COMPLETED")) return "COMPLETED"
            if (active.some((s) => ["IN_PROGRESS", "COMPLETED"].includes(s))) return "IN_PROGRESS"
            return "SCHEDULED"
        }

        const dateGroups = (request.assignments || []).map((a) => {
            const outbound = a.tripId ? tripById.get(a.tripId.toString()) : null
            const ret = a.returnTripId ? tripById.get(a.returnTripId.toString()) : null

            // Merge the passengers of both legs into one per-student row, deriving
            // how each student travels from the legs they appear on: both legs ->
            // ROUND_TRIP, going only -> OUTBOUND, return only -> RETURN. A
            // round-trip student therefore appears once (not twice) in the panel.
            const byEmp = new Map()
            const ingest = (t, leg) => {
                for (const p of t?.passengers || []) {
                    const key = (p.employeeId || p.passengerId || "").toString()
                    if (!key) continue
                    if (!byEmp.has(key)) {
                        byEmp.set(key, {
                            employeeId: p.employeeId ? p.employeeId.toString() : null,
                            passengerId: p.passengerId ? p.passengerId.toString() : null,
                            name: p.name || "Student",
                            bookingStatus: p.bookingStatus || "CONFIRMED",
                            outbound: null,
                            return: null,
                        })
                    }
                    byEmp.get(key)[leg] = {
                        pickupStop: p.pickupStop || p.pickupPoint || "",
                        dropoffStop: p.dropoffStop || "",
                    }
                }
            }
            ingest(outbound, "outbound")
            ingest(ret, "return")

            const passengers = [...byEmp.values()].map((row) => {
                const journeyType =
                    row.outbound && row.return ? "ROUND_TRIP" : row.return ? "RETURN" : "OUTBOUND"
                // Show the going orientation for round-trip / outbound students,
                // the return orientation for return-only students.
                const leg = journeyType === "RETURN" ? row.return : row.outbound || row.return
                return {
                    employeeId: row.employeeId,
                    passengerId: row.passengerId,
                    name: row.name,
                    pickupStop: leg?.pickupStop || "",
                    dropoffStop: leg?.dropoffStop || "",
                    journeyType,
                    bookingStatus: row.bookingStatus,
                }
            })

            const totalSeats =
                outbound?.totalSeats ?? ret?.totalSeats ?? request.passengerCount ?? passengers.length
            const distinct = passengers.length
            return {
                serviceDate: a.serviceDate,
                // Keyed by the OUTBOUND trip id; the passengers endpoint resolves
                // both legs from it.
                tripId: a.tripId ? a.tripId.toString() : null,
                returnTripId: a.returnTripId ? a.returnTripId.toString() : null,
                status: combineStatus(outbound?.status || a.status, ret?.status),
                vehicleLabel: a.vehicleLabel || "Vehicle",
                driverName: a.driverName || null,
                driverPhone: a.driverPhone || null,
                totalSeats,
                bookedSeats: distinct,
                availableSeats: Math.max(0, totalSeats - distinct),
                passengers,
            }
        })

        // Assignable students = the customer company's active students.
        const employees = await CorporateEmployee.find({
            companyId: request.customerId,
            "accessControl.isActive": true,
            "transportDetails.transportStatus": { $ne: "TERMINATED", $nin: ["INACTIVE", "SUSPENDED"] },
        })
            .select("userId personalInfo transportDetails")
            .sort({ createdAt: 1 })
            .lean()

        const assignableStudents = employees.map((emp) => ({
            employeeId: emp._id.toString(),
            userId: emp.userId ? emp.userId.toString() : null,
            name:
                [emp.personalInfo?.firstName, emp.personalInfo?.lastName].filter(Boolean).join(" ").trim() ||
                "Student",
            email: emp.personalInfo?.email || null,
            pickup: request.pickupLocation || emp.transportDetails?.pickupPoint || "",
            dropoff: request.dropoffLocation || emp.transportDetails?.dropOffPoint || "",
        }))

        return res.json({
            success: true,
            data: {
                requestId: request._id.toString(),
                purpose: request.purpose,
                canManage: isPartner,
                fulfillmentStatus: request.fulfillmentStatus,
                dateGroups,
                assignableStudents,
            },
        })
    } catch (error) {
        console.error("[extraService] getExtraServiceRoster error:", error)
        return res.status(500).json({ success: false, message: "Failed to load the extra service roster." })
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/extra-service-requests/item/:requestId/trip/:tripId/passengers
// ---------------------------------------------------------------------------
// The partner assigns / removes the specific students who travel on a given
// extra-day trip (the assigned unit + driver for that date). Added students get
// an in-app notification AND an assignment email naming that trip's exact
// vehicle, driver and service date, so the driver knows who to pick up and each
// student can track the shared driver location live — the same operational flow
// as a regular managed trip. body = { add: [employeeId], remove: [employeeId] }
export const updateExtraServiceTripPassengers = async (req, res) => {
    try {
        const { requestId, tripId } = req.params
        const { add = [], remove = [] } = req.body || {}

        if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(tripId)) {
            return res.status(400).json({ success: false, message: "Invalid id." })
        }

        const request = await ExtraServiceRequest.findById(requestId)
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found." })
        }
        if (!isPartnerRole(req.userRole) || request.partnerId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Only the operating partner can manage passengers for this trip.",
            })
        }

        // The roster keys each date group by its OUTBOUND trip id, but a student
        // can ride either leg. Resolve the assignment from either the outbound
        // (tripId) or the return (returnTripId) trip, then load BOTH legs so we
        // can place each student on the exact trip(s) they actually travel.
        const assignment = (request.assignments || []).find(
            (a) =>
                (a.tripId && a.tripId.toString() === tripId) ||
                (a.returnTripId && a.returnTripId.toString() === tripId),
        )
        if (!assignment) {
            return res.status(404).json({ success: false, message: "Extra service trip not found." })
        }

        const outboundTrip = assignment.tripId
            ? await Trip.findOne({ _id: assignment.tripId, extraServiceRequestId: request._id })
            : null
        const returnTrip = assignment.returnTripId
            ? await Trip.findOne({ _id: assignment.returnTripId, extraServiceRequestId: request._id })
            : null

        if (!outboundTrip && !returnTrip) {
            return res.status(404).json({ success: false, message: "Extra service trip not found." })
        }

        // Shared context (date, vehicle, driver) for notifications / emails /
        // response — both legs share it, so either leg works as the anchor.
        const trip = outboundTrip || returnTrip

        const isClosed = (t) =>
            !!t && ["COMPLETED", "CANCELLED"].includes(String(t.status || "").toUpperCase())
        // Only block when BOTH legs are closed; a single closed leg is skipped
        // per-leg below so the still-open leg can still be edited.
        if ((!outboundTrip || isClosed(outboundTrip)) && (!returnTrip || isClosed(returnTrip))) {
            return res.status(400).json({
                success: false,
                message: "This trip is already completed or cancelled and can no longer be changed.",
            })
        }

        const vehicleLabel = assignment?.vehicleLabel || "Vehicle"
        const driverName = assignment?.driverName || null
        const driverPhone = assignment?.driverPhone || null

        // ---- Remove ----
        const removeSet = new Set((remove || []).map((id) => String(id)))
        let removedUserIds = []
        if (removeSet.size) {
            const removedEmps = await CorporateEmployee.find({
                _id: { $in: [...removeSet].filter((id) => mongoose.Types.ObjectId.isValid(id)) },
            })
                .select("userId")
                .lean()
            removedUserIds = removedEmps.map((e) => e.userId?.toString()).filter(Boolean)
            const strip = (t) => {
                if (!t || isClosed(t)) return
                t.passengers = (t.passengers || []).filter(
                    (p) => !removeSet.has(p.employeeId?.toString()),
                )
            }
            strip(outboundTrip)
            strip(returnTrip)
        }

        // ---- Add ----
        // Each added student can travel a specific leg of the extra day:
        //   OUTBOUND   -> only going    (origin -> destination)
        //   RETURN     -> only coming   (destination -> origin)
        //   ROUND_TRIP -> both          (origin <-> destination)
        // The partner picks this per student in the roster panel. We accept
        // either add:[employeeId] (legacy — defaults to the body journey, or
        // ROUND_TRIP) or add:[{ employeeId, journeyType }] so each student's
        // stored pickup/dropoff is already oriented for the leg they ride.
        const VALID_JOURNEYS = new Set(["OUTBOUND", "RETURN", "ROUND_TRIP"])
        const normJourney = (v) =>
            VALID_JOURNEYS.has(String(v || "").toUpperCase()) ? String(v).toUpperCase() : null
        const bodyJourney = normJourney(req.body?.journeyType) || "ROUND_TRIP"

        const journeyByEmp = new Map()
        for (const item of Array.isArray(add) ? add : []) {
            let empId = null
            let jt = null
            if (item && typeof item === "object") {
                empId = item.employeeId || item.id
                jt = normJourney(item.journeyType)
            } else {
                empId = item
            }
            if (!empId) continue
            const idStr = String(empId)
            if (!mongoose.Types.ObjectId.isValid(idStr)) continue
            journeyByEmp.set(idStr, jt || bodyJourney)
        }
        const addIds = [...journeyByEmp.keys()]

        // Event-level endpoints for this extra day (e.g. School <-> Gold Souk).
        const origin = request.pickupLocation || ""
        const destination = request.dropoffLocation || request.purpose || ""

        const addedContacts = []
        const addedUsers = []
        if (addIds.length) {
            const employees = await CorporateEmployee.find({
                _id: { $in: addIds },
                companyId: request.customerId,
            })
                .select("userId personalInfo transportDetails")
                .lean()

            const seatCapOf = (t) =>
                t.totalSeats || request.passengerCount || (t.passengers?.length || 0) + employees.length
            const alreadyOn = (t, eid) =>
                (t.passengers || []).some((p) => p.employeeId?.toString() === eid)

            // Board a student on a single leg trip, orienting pickup/drop-off for
            // that leg: a RETURN leg boards at the destination and drops at the
            // origin; a FORWARD leg boards at the origin and drops at the
            // destination. Storing the student on the actual leg trip is what
            // makes them see that leg as its own trip on the service date.
            const boardLeg = (legTrip, emp, name, journeyType) => {
                if (!legTrip || isClosed(legTrip)) return
                const eid = emp._id.toString()
                if (alreadyOn(legTrip, eid)) return
                const originResolved = origin || emp.transportDetails?.pickupPoint || ""
                let pickup, dropoff, pickupTime
                if (legTrip.direction === "RETURN") {
                    pickup = destination
                    dropoff = originResolved
                    pickupTime = request.expectedReturnTime || request.departureTime || ""
                } else {
                    pickup = originResolved
                    dropoff = destination
                    pickupTime = request.departureTime || ""
                }
                legTrip.passengers.push({
                    passengerId: emp.userId || undefined,
                    employeeId: emp._id,
                    name,
                    journeyType,
                    pickupStop: pickup,
                    dropoffStop: dropoff,
                    pickupPoint: pickup,
                    pickupTime,
                    status: "CONFIRMED",
                    bookingStatus: "CONFIRMED",
                    bookedAt: new Date(),
                })
            }

            for (const emp of employees) {
                const eid = emp._id.toString()
                const journeyType = journeyByEmp.get(eid) || "ROUND_TRIP"
                const name =
                    [emp.personalInfo?.firstName, emp.personalInfo?.lastName].filter(Boolean).join(" ").trim() ||
                    "Student"

                // The leg trip(s) this student needs, skipping any closed/absent leg.
                const legs = []
                if (journeyType === "OUTBOUND" || journeyType === "ROUND_TRIP") legs.push(outboundTrip)
                if (journeyType === "RETURN" || journeyType === "ROUND_TRIP") legs.push(returnTrip)
                const openLegs = legs.filter((t) => t && !isClosed(t))
                if (!openLegs.length) continue

                // Verify seats on EVERY leg before boarding any, so a round-trip
                // student is never half-added when one leg is full.
                for (const legTrip of openLegs) {
                    if (!alreadyOn(legTrip, eid) && (legTrip.passengers?.length || 0) >= seatCapOf(legTrip)) {
                        return res.status(400).json({
                            success: false,
                            message: `No seats left on ${vehicleLabel} for this date.`,
                        })
                    }
                }

                let boardedAny = false
                for (const legTrip of openLegs) {
                    if (!alreadyOn(legTrip, eid)) boardedAny = true
                    boardLeg(legTrip, emp, name, journeyType)
                }
                if (!boardedAny) continue

                const goingPickup = origin || emp.transportDetails?.pickupPoint || "School"
                const journeyPhrase =
                    journeyType === "OUTBOUND"
                        ? `going only (${goingPickup} -> ${destination})`
                        : journeyType === "RETURN"
                          ? `return only (${destination} -> ${goingPickup})`
                          : `round trip (${goingPickup} <-> ${destination})`

                if (emp.userId) addedUsers.push({ uid: emp.userId.toString(), journeyPhrase })
                if (emp.personalInfo?.email)
                    addedContacts.push({
                        email: emp.personalInfo.email,
                        name,
                        pickup: journeyType === "RETURN" ? destination : goingPickup,
                        dropoff: journeyType === "RETURN" ? goingPickup : destination,
                        journeyType,
                    })
            }
        }

        // Persist both legs with refreshed seat counts.
        const saveLeg = async (t) => {
            if (!t) return
            t.bookedSeats = (t.passengers || []).length
            t.availableSeats = Math.max(0, (t.totalSeats || 0) - (t.passengers || []).length)
            await t.save()
        }
        await saveLeg(outboundTrip)
        await saveLeg(returnTrip)

        const dateText = new Date(trip.tripDate).toLocaleDateString("en-GB")
        const tripTimeText = [request.departureTime, request.expectedReturnTime].filter(Boolean).join(" - ")
        const routeLabel = [request.pickupLocation, request.dropoffLocation || request.purpose]
            .filter(Boolean)
            .join(" -> ")

        // Notify each added student for THIS trip's specific unit/driver/date,
        // naming the exact leg (going / return / round trip) they travel.
        for (const { uid, journeyPhrase } of addedUsers) {
            try {
                await createNotification({
                    userId: uid,
                    type: "TRIP_ASSIGNED",
                    title: "You're booked on an extra service trip",
                    message: `You're booked on "${request.purpose}" on ${dateText} — ${vehicleLabel}${driverName ? ` with ${driverName}` : ""}, ${journeyPhrase}. Track your ride from "My Trips" on the service date.`,
                    data: {
                        extraServiceRequestId: request._id.toString(),
                        contractId: request.contractId.toString(),
                        tripId: trip._id.toString(),
                    },
                })
            } catch (e) {
                console.error("[extraService] add-passenger notify failed:", e.message)
            }
        }

        // Notify each removed student their booking was cancelled.
        for (const uid of removedUserIds) {
            try {
                await createNotification({
                    userId: uid,
                    type: "TRIP_ASSIGNED",
                    title: "Extra service trip booking removed",
                    message: `You've been removed from "${request.purpose}" on ${dateText}.`,
                    data: {
                        extraServiceRequestId: request._id.toString(),
                        contractId: request.contractId.toString(),
                        tripId: trip._id.toString(),
                    },
                })
            } catch (e) {
                console.error("[extraService] remove-passenger notify failed:", e.message)
            }
        }

        // Email each added student the assignment confirmation (best-effort).
        const emailJobs = addedContacts.map((c) => ({
            to: c.email,
            recipientName: c.name || "Student",
            recipientType: "PASSENGER",
            tripTitle: request.purpose,
            serviceDate: trip.tripDate,
            timeText: tripTimeText,
            vehicleLabel,
            driverName,
            driverPhone,
            // Route line oriented for this student's actual leg.
            routeLabel: [c.pickup, c.dropoff].filter(Boolean).join(" -> ") || routeLabel,
            pickup: c.pickup,
            dropoff: c.dropoff,
            isExtraService: true,
        }))
        if (emailJobs.length) {
            try {
                await Promise.allSettled(emailJobs.map((job) => sendTripAssignmentEmail(job)))
            } catch (e) {
                console.error("[extraService] add-passenger emails failed:", e.message)
            }
        }

        // Build a unified per-student roster across both legs for the response
        // (a round-trip student appears once as ROUND_TRIP).
        const respByEmp = new Map()
        const collectResp = (t) => {
            for (const p of t?.passengers || []) {
                const key = p.employeeId ? p.employeeId.toString() : p.passengerId?.toString() || ""
                if (!key) continue
                const dir = t.direction === "RETURN" ? "return" : "outbound"
                if (!respByEmp.has(key))
                    respByEmp.set(key, {
                        employeeId: p.employeeId ? p.employeeId.toString() : null,
                        name: p.name || "Student",
                        outbound: null,
                        return: null,
                    })
                respByEmp.get(key)[dir] = {
                    pickupStop: p.pickupStop || "",
                    dropoffStop: p.dropoffStop || "",
                }
            }
        }
        collectResp(outboundTrip)
        collectResp(returnTrip)
        const respPassengers = [...respByEmp.values()].map((row) => {
            const journeyType =
                row.outbound && row.return ? "ROUND_TRIP" : row.return ? "RETURN" : "OUTBOUND"
            const leg = journeyType === "RETURN" ? row.return : row.outbound || row.return
            return {
                employeeId: row.employeeId,
                name: row.name,
                pickupStop: leg?.pickupStop || "",
                dropoffStop: leg?.dropoffStop || "",
                journeyType,
                bookingStatus: "CONFIRMED",
            }
        })
        const respTotalSeats = (outboundTrip || returnTrip).totalSeats || 0

        return res.json({
            success: true,
            data: {
                tripId: (outboundTrip || returnTrip)._id.toString(),
                returnTripId: returnTrip ? returnTrip._id.toString() : null,
                totalSeats: respTotalSeats,
                bookedSeats: respPassengers.length,
                availableSeats: Math.max(0, respTotalSeats - respPassengers.length),
                passengers: respPassengers,
            },
        })
    } catch (error) {
        console.error("[extraService] updateExtraServiceTripPassengers error:", error)
        return res.status(500).json({ success: false, message: "Failed to update passengers for this trip." })
    }
}
