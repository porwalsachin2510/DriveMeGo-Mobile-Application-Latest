import express from "express"
import {
    createExtraServiceRequest,
    getExtraServiceRequests,
    getMyExtraServiceRequests,
    respondToExtraServiceRequest,
    cancelExtraServiceRequest,
    getAssignableFleet,
    assignExtraServiceResources,
    getExtraServiceRoster,
    updateExtraServiceTripPassengers,
    payExtraServiceRequest,
    confirmExtraServiceRequestPayment,
} from "../controllers/extraServiceRequestController.js"
import { verifyToken, requireRole } from "../middleware/auth.js"

const router = express.Router()

// requireRole is family-aware: "CORPORATE" also admits SCHOOL_CUSTOMER and
// "B2B_PARTNER" also admits SCHOOL_PARTNER. Extra service days are a
// school-transportation feature but the guards are kept generic so the managed
// pipeline stays consistent.

// List all of my extra service requests (across contracts) - customer or partner
router.get("/mine/all", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), getMyExtraServiceRequests)

// Create a request for a specific contract (customer only, enforced in controller)
router.post("/:contractId", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), createExtraServiceRequest)

// Partner: list the vehicles + drivers assignable to this contract
router.get("/:contractId/fleet", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), getAssignableFleet)

// List requests for a specific contract (both sides)
router.get("/:contractId", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), getExtraServiceRequests)

// Partner responds (approve with charge + billing mode, or reject)
router.patch("/item/:requestId/respond", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), respondToExtraServiceRequest)

// Partner assigns vehicle + driver per date (creates the operational trips)
router.patch("/item/:requestId/assign", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), assignExtraServiceResources)

// Roster: view the per-date trip's vehicle/driver + its students, and the
// company's assignable students (both sides can view; partner can manage)
router.get("/item/:requestId/roster", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), getExtraServiceRoster)

// Partner assigns / removes the specific students who travel on an extra-day trip
router.patch(
    "/item/:requestId/trip/:tripId/passengers",
    verifyToken,
    requireRole(["CORPORATE", "B2B_PARTNER"]),
    updateExtraServiceTripPassengers,
)

// Customer starts payment for a SEPARATE extra-service charge (card/wallet/bank/cash)
router.post("/item/:requestId/pay", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), payExtraServiceRequest)

// Partner confirms receipt of a manual (cash/bank) extra-service payment
router.patch("/item/:requestId/confirm-payment", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), confirmExtraServiceRequestPayment)

// Customer cancels a pending request
router.patch("/item/:requestId/cancel", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), cancelExtraServiceRequest)

export default router
