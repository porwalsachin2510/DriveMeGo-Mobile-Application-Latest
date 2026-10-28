"use client";

import { useState, useEffect, useCallback } from "react";
import {
  listExtraServiceRequests,
  createExtraServiceRequest,
  respondToExtraServiceRequest,
  cancelExtraServiceRequest,
  listAssignableFleet,
  assignExtraServiceResources,
  getExtraServiceRoster,
  updateExtraServiceTripPassengers,
  payExtraServiceRequest,
  confirmExtraServiceRequestPayment,
} from "../../../services/extraServiceRequestAPI";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh";
import ExtraServicePaymentModal from "./ExtraServicePaymentModal";
import "./extraservicedays.css";

/**
 * ExtraServiceDays
 * ----------------
 * Ad-hoc extra-day requests on a MANAGED contract. A school customer
 * (mode="corporate") asks its school partner for the fleet on extra dates
 * beyond the recurring school-week schedule — e.g. a Sunday picnic or an event.
 * The operating partner (mode="partner") approves each request with a charge
 * and a billing choice (SEPARATE one-off invoice or folded into the contract
 * balance) or rejects it. Approval generates a real invoice on the backend.
 */

const STATUS_LABEL = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Declined",
  CANCELLED: "Cancelled",
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const fmtMoney = (amount, currency) =>
  amount == null
    ? "—"
    : `${Number(amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${currency || "AED"}`;

const todayStr = () => new Date().toISOString().slice(0, 10);

// The leg a student can ride on an extra service day. A student going on the
// picnic might only need the bus one way (e.g. a parent drops them at Burj
// Khalifa and they ride back to school), so each student is assigned exactly
// the leg they travel.
const JOURNEY_OPTIONS = [
  {
    value: "ROUND_TRIP",
    label: "Round trip",
    hint: "Goes and comes back",
  },
  {
    value: "OUTBOUND",
    label: "One way — going",
    hint: "Only travels to the destination",
  },
  {
    value: "RETURN",
    label: "One way — return",
    hint: "Only travels back to school",
  },
];

const JOURNEY_LABEL = {
  ROUND_TRIP: "Round trip",
  OUTBOUND: "One way · going",
  RETURN: "One way · return",
};

// Human-readable route for a leg, oriented from the event's endpoints.
const journeyRoute = (journeyType, origin, destination) => {
  const o = origin || "School";
  const d = destination || "Destination";
  if (journeyType === "RETURN") return `${d} → ${o}`;
  if (journeyType === "OUTBOUND") return `${o} → ${d}`;
  return `${o} ⇄ ${d}`;
};

const EMPTY_FORM = {
  purpose: "",
  serviceDates: [todayStr()],
  vehiclesRequired: 1,
  pickupLocation: "",
  dropoffLocation: "",
  departureTime: "",
  expectedReturnTime: "",
  passengerCount: "",
  notes: "",
};

export default function ExtraServiceDays({ contractId, mode = "corporate" }) {
  const isCorporate = mode === "corporate";

  const [requests, setRequests] = useState([]);
  const [viewerSide, setViewerSide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  // Pay modal (customer) — pick a payment method for a SEPARATE charge.
  const [payFor, setPayFor] = useState(null);
  const [payingMethod, setPayingMethod] = useState(false);

  // Create-request modal (customer)
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Approve modal (partner)
  const [approveFor, setApproveFor] = useState(null);
  const [approveForm, setApproveForm] = useState({
    charge: "",
    billingMode: "SEPARATE",
    partnerResponseNote: "",
  });

  // Assign modal (partner) — pick a vehicle + driver per service date
  const [assignFor, setAssignFor] = useState(null);
  const [fleet, setFleet] = useState([]);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [assignRows, setAssignRows] = useState([]); // [{ serviceDate, vehicleId, driverId }]

  // Roster modal — add/remove the specific students who travel on each assigned
  // unit + date for this extra-service request. Partner manages; customer reads.
  const [rosterFor, setRosterFor] = useState(null);
  const [roster, setRoster] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterBusyKey, setRosterBusyKey] = useState(null); // `${tripId}:${employeeId}`
  // Per-student leg selection before adding: `${tripId}:${employeeId}` -> journeyType.
  const [journeyDrafts, setJourneyDrafts] = useState({});

  const setJourneyDraft = (key, journeyType) =>
    setJourneyDrafts((d) => ({ ...d, [key]: journeyType }));

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(
    async ({ silent } = {}) => {
      try {
        if (!silent) setLoading(true);
        const res = await listExtraServiceRequests(contractId);
        if (res.data.success) {
          setRequests(res.data.data || []);
          setViewerSide(res.data.viewerSide || null);
        }
      } catch (err) {
        console.error("[v0] Failed to load extra service requests:", err);
        if (!silent) {
          showToast(
            err.response?.data?.message || "Failed to load extra service days",
            "error",
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [contractId],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Requests move through approval on the partner side, so keep the list live.
  useAutoRefresh(load, {
    interval: 20000,
    enabled: !!contractId,
    socketEvents: ["new-notification"],
    deps: [contractId],
  });

  const summary = requests.reduce(
    (acc, r) => {
      acc.total += 1;
      if (r.status === "PENDING") acc.pending += 1;
      if (r.status === "APPROVED") acc.approved += 1;
      if (r.status === "REJECTED") acc.rejected += 1;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, rejected: 0 },
  );

  const filtered = statusFilter
    ? requests.filter((r) => r.status === statusFilter)
    : requests;

  /* ------------------------------- create -------------------------------- */
  const updateDate = (idx, value) => {
    setForm((f) => {
      const dates = [...f.serviceDates];
      dates[idx] = value;
      return { ...f, serviceDates: dates };
    });
  };
  const addDate = () =>
    setForm((f) => ({ ...f, serviceDates: [...f.serviceDates, todayStr()] }));
  const removeDate = (idx) =>
    setForm((f) => ({
      ...f,
      serviceDates: f.serviceDates.filter((_, i) => i !== idx),
    }));

  const submitCreate = async () => {
    const cleanDates = [...new Set(form.serviceDates.filter(Boolean))];
    if (!form.purpose.trim())
      return showToast("Please describe the purpose (e.g. school picnic)", "error");
    if (cleanDates.length === 0)
      return showToast("Add at least one service date", "error");

    try {
      setSubmitting(true);
      const res = await createExtraServiceRequest(contractId, {
        ...form,
        serviceDates: cleanDates,
        vehiclesRequired: Number(form.vehiclesRequired) || 1,
        passengerCount: form.passengerCount
          ? Number(form.passengerCount)
          : undefined,
      });
      if (res.data.success) {
        showToast("Extra service request sent to your partner");
        setShowCreate(false);
        setForm(EMPTY_FORM);
        load();
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to send request",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------- respond ------------------------------- */
  const openApprove = (request) => {
    setApproveFor(request);
    setApproveForm({ charge: "", billingMode: "SEPARATE", partnerResponseNote: "" });
  };

  const submitApprove = async () => {
    const charge = Number(approveForm.charge);
    if (!Number.isFinite(charge) || charge <= 0)
      return showToast("Enter a valid charge amount", "error");

    try {
      setBusyId(approveFor._id);
      const res = await respondToExtraServiceRequest(approveFor._id, {
        decision: "APPROVE",
        charge,
        billingMode: approveForm.billingMode,
        partnerResponseNote: approveForm.partnerResponseNote,
      });
      if (res.data.success) {
        showToast("Request approved and invoiced");
        setApproveFor(null);
        load();
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to approve request",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (request) => {
    const note = window.prompt("Reason for declining this request:") || "";
    if (!note.trim()) return;
    try {
      setBusyId(request._id);
      const res = await respondToExtraServiceRequest(request._id, {
        decision: "REJECT",
        partnerResponseNote: note,
      });
      if (res.data.success) {
        showToast("Request declined");
        load();
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to decline request",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (request) => {
    if (!window.confirm("Cancel this extra service request?")) return;
    try {
      setBusyId(request._id);
      const res = await cancelExtraServiceRequest(request._id);
      if (res.data.success) {
        showToast("Request cancelled");
        load();
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to cancel request",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  };

  /* ------------------------------- assign -------------------------------- */
  const openAssign = async (request) => {
    setAssignFor(request);
    setAssignRows([]);
    try {
      setFleetLoading(true);
      const res = await listAssignableFleet(contractId);
      const fleetData = res.data.success ? res.data.data || [] : [];
      setFleet(fleetData);
      // Prefill one row per service date. Each fleet entry is a distinct unit
      // (vehicle + its committed driver) keyed by unitId, so we match an
      // existing assignment back to its unit by vehicle + driver.
      const rows = (request.serviceDates || []).map((d) => {
        const existing = (request.assignments || []).find(
          (a) =>
            new Date(a.serviceDate).toDateString() ===
            new Date(d).toDateString(),
        );
        let unitId = "";
        if (existing) {
          const unit = fleetData.find(
            (f) =>
              String(f.vehicleId) === String(existing.vehicleId) &&
              (existing.driverId
                ? String(f.driverId) === String(existing.driverId)
                : true),
          );
          unitId = unit?.unitId || "";
        }
        return { serviceDate: d, unitId };
      });
      setAssignRows(rows);
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to load your fleet",
        "error",
      );
    } finally {
      setFleetLoading(false);
    }
  };

  const updateAssignRow = (idx, unitId) => {
    setAssignRows((rows) => {
      const next = [...rows];
      next[idx] = { ...next[idx], unitId };
      return next;
    });
  };

  const submitAssign = async () => {
    const assignments = assignRows
      .filter((r) => r.unitId)
      .map((r) => ({ serviceDate: r.serviceDate, unitId: r.unitId }));
    if (assignments.length === 0)
      return showToast("Pick a vehicle & driver for at least one date", "error");

    try {
      setBusyId(assignFor._id);
      const res = await assignExtraServiceResources(assignFor._id, {
        assignments,
      });
      if (res.data.success) {
        showToast("Fleet assigned — the driver will see the trip on that day");
        setAssignFor(null);
        load();
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to assign the fleet",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  };

  /* ------------------------------- roster -------------------------------- */
  // Open the roster panel for an assigned request and load its per-date trips
  // (exact vehicle + driver) plus the company's assignable students.
  const loadRoster = useCallback(async (requestId) => {
    const res = await getExtraServiceRoster(requestId);
    if (res.data.success) setRoster(res.data.data);
    return res.data.data;
  }, []);

  const openRoster = async (request) => {
    setRosterFor(request);
    setRoster(null);
    try {
      setRosterLoading(true);
      await loadRoster(request._id);
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to load the roster",
        "error",
      );
    } finally {
      setRosterLoading(false);
    }
  };

  // Add or remove a single student on a specific extra-day trip. Each change is
  // persisted immediately so the student's trip (and the driver manifest) update
  // right away, and the added/removed student is notified + emailed by the API.
  const toggleStudent = async (
    tripId,
    employeeId,
    action,
    journeyType = "ROUND_TRIP",
  ) => {
    if (!rosterFor || !tripId) return;
    const key = `${tripId}:${employeeId}`;
    try {
      setRosterBusyKey(key);
      // Each added student rides a specific leg (going only / return only /
      // round trip); the backend orients their pickup & drop-off accordingly.
      const payload =
        action === "add"
          ? { add: [{ employeeId, journeyType }] }
          : { remove: [employeeId] };
      const res = await updateExtraServiceTripPassengers(
        rosterFor._id,
        tripId,
        payload,
      );
      if (res.data.success) {
        // Refresh the roster so seat counts + rosters reflect the change.
        await loadRoster(rosterFor._id);
        showToast(
          action === "add" ? "Student added to the trip" : "Student removed",
        );
        // Keep the request list's assignment/fulfilment badges in sync.
        load({ silent: true });
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to update the roster",
        "error",
      );
    } finally {
      setRosterBusyKey(null);
    }
  };

  /* --------------------------------- pay --------------------------------- */
  // Open the payment-method modal (same experience as a contract payment).
  const openPay = (request) => setPayFor(request);

  // Start payment with the chosen method. CARD/WALLET redirect to the gateway;
  // CASH/BANK record a submission the partner then confirms.
  const submitPayment = async (method) => {
    if (!payFor) return;
    try {
      setPayingMethod(true);
      const res = await payExtraServiceRequest(payFor._id, method);
      const data = res.data?.data;

      if (data?.paymentSession?.paymentUrl) {
        // Redirect to the secure gateway checkout (Stripe / TAP).
        window.location.href = data.paymentSession.paymentUrl;
        return;
      }

      // Manual (cash / bank transfer) submission.
      setPayFor(null);
      showToast(
        res.data?.message ||
          "Payment submitted. Your partner will confirm it shortly.",
      );
      load();
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to start payment",
        "error",
      );
    } finally {
      setPayingMethod(false);
    }
  };

  // Partner confirms they received a manual (cash / bank) payment.
  const confirmPayment = async (request) => {
    if (
      !window.confirm(
        `Confirm you received ${fmtMoney(request.charge, request.currency)} for "${request.purpose}"? This marks the invoice paid.`,
      )
    )
      return;
    try {
      setBusyId(request._id);
      const res = await confirmExtraServiceRequestPayment(request._id);
      if (res.data.success) {
        showToast("Payment confirmed");
        load();
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to confirm payment",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="esd-loading">Loading extra service days…</div>;
  }

  return (
    <div className="esd">
      <div className="esd-header">
        <div>
          <h2 className="esd-title">Extra Service Days</h2>
          <p className="esd-sub">
            {isCorporate
              ? "Your contract covers the regular school week. Need the fleet for a picnic, an event or any extra day? Request it here — your partner will confirm the charge and how it's billed."
              : "Ad-hoc extra-day requests from your client beyond the contract schedule. Approve each one with a charge and choose whether to invoice it separately or add it to the contract balance."}
          </p>
        </div>
        {isCorporate && (
          <button className="esd-btn primary" onClick={() => setShowCreate(true)}>
            Request extra day
          </button>
        )}
      </div>

      <div className="esd-summary">
        <div className="esd-stat">
          <span className="esd-stat-val">{summary.total}</span>
          <span className="esd-stat-label">Total</span>
        </div>
        <div className="esd-stat">
          <span className="esd-stat-val">{summary.pending}</span>
          <span className="esd-stat-label">Pending</span>
        </div>
        <div className="esd-stat">
          <span className="esd-stat-val">{summary.approved}</span>
          <span className="esd-stat-label">Approved</span>
        </div>
        <div className="esd-stat">
          <span className="esd-stat-val">{summary.rejected}</span>
          <span className="esd-stat-label">Declined</span>
        </div>
      </div>

      <div className="esd-filters">
        <button
          className={`esd-chip ${statusFilter === "" ? "active" : ""}`}
          onClick={() => setStatusFilter("")}
        >
          All
        </button>
        {Object.keys(STATUS_LABEL).map((s) => (
          <button
            key={s}
            className={`esd-chip ${statusFilter === s ? "active" : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="esd-empty">
          {isCorporate
            ? "No extra service days requested yet. Use “Request extra day” for picnics or events."
            : "No extra service day requests from your client yet."}
        </div>
      ) : (
        <div className="esd-list">
          {filtered.map((r) => {
            const expanded = expandedId === r._id;
            return (
              <div key={r._id} className="esd-card">
                <div className="esd-card-top">
                  <div className="esd-card-main">
                    <div className="esd-card-line1">
                      <span className="esd-purpose">{r.purpose}</span>
                      <span className={`esd-status s-${r.status.toLowerCase()}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.status === "APPROVED" && (
                        <span
                          className={`esd-bill b-${(r.billingMode || "").toLowerCase()}`}
                        >
                          {r.billingMode === "ADD_TO_CONTRACT"
                            ? "Added to contract"
                            : "Separate invoice"}
                        </span>
                      )}
                    </div>
                    <div className="esd-card-meta">
                      {r.serviceDates?.length || 0} day
                      {(r.serviceDates?.length || 0) === 1 ? "" : "s"} ·{" "}
                      {r.vehiclesRequired} vehicle
                      {r.vehiclesRequired === 1 ? "" : "s"}
                      {r.status === "APPROVED" &&
                        ` · ${fmtMoney(r.charge, r.currency)}`}
                    </div>
                    <div className="esd-card-dates">
                      {(r.serviceDates || []).map((d, i) => (
                        <span key={i} className="esd-date-pill">
                          {fmtDate(d)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    className="esd-expand"
                    onClick={() => setExpandedId(expanded ? null : r._id)}
                  >
                    {expanded ? "Hide" : "Details"}
                  </button>
                </div>

                {expanded && (
                  <div className="esd-card-body">
                    <div className="esd-detail-grid">
                      {r.pickupLocation && (
                        <div className="esd-detail">
                          <span className="esd-detail-k">Pickup</span>
                          <span className="esd-detail-v">{r.pickupLocation}</span>
                        </div>
                      )}
                      {r.dropoffLocation && (
                        <div className="esd-detail">
                          <span className="esd-detail-k">Drop-off</span>
                          <span className="esd-detail-v">
                            {r.dropoffLocation}
                          </span>
                        </div>
                      )}
                      {r.departureTime && (
                        <div className="esd-detail">
                          <span className="esd-detail-k">Departure</span>
                          <span className="esd-detail-v">{r.departureTime}</span>
                        </div>
                      )}
                      {r.expectedReturnTime && (
                        <div className="esd-detail">
                          <span className="esd-detail-k">Return</span>
                          <span className="esd-detail-v">
                            {r.expectedReturnTime}
                          </span>
                        </div>
                      )}
                      {r.passengerCount != null && (
                        <div className="esd-detail">
                          <span className="esd-detail-k">Passengers</span>
                          <span className="esd-detail-v">{r.passengerCount}</span>
                        </div>
                      )}
                      <div className="esd-detail">
                        <span className="esd-detail-k">Requested</span>
                        <span className="esd-detail-v">
                          {fmtDateTime(r.createdAt)}
                        </span>
                      </div>
                    </div>

                    {r.notes && (
                      <div className="esd-block">
                        <span className="esd-block-label">Notes</span>
                        <p className="esd-block-text">{r.notes}</p>
                      </div>
                    )}

                    {r.partnerResponseNote && (
                      <div className="esd-block">
                        <span className="esd-block-label">Partner note</span>
                        <p className="esd-block-text">{r.partnerResponseNote}</p>
                      </div>
                    )}

                    {r.status === "APPROVED" && (
                      <div className="esd-block esd-invoice">
                        <span className="esd-block-label">Billing</span>
                        <p className="esd-block-text">
                          {fmtMoney(r.charge, r.currency)} —{" "}
                          {r.billingMode === "ADD_TO_CONTRACT"
                            ? "added to the contract balance and collected with your contract payment."
                            : "invoiced separately as a one-off charge."}
                          {r.invoiceId?.invoiceNumber &&
                            ` Invoice ${r.invoiceId.invoiceNumber} (${r.invoiceId.status}).`}
                        </p>
                        {r.billingMode === "SEPARATE" && (
                          <p className="esd-block-text">
                            Payment:{" "}
                            <strong>
                              {r.paymentStatus === "PAID"
                                ? "Paid"
                                : r.paymentStatus === "PROCESSING"
                                  ? ["CASH", "BANK_TRANSFER"].includes(
                                      r.paymentMethod,
                                    )
                                    ? `Awaiting partner confirmation (${r.paymentMethod === "CASH" ? "cash" : "bank transfer"})`
                                    : "Payment in progress"
                                  : "Awaiting payment"}
                            </strong>
                            {r.paymentStatus === "PAID" && r.paidAt
                              ? ` · ${fmtDateTime(r.paidAt)}`
                              : ""}
                            {r.paymentStatus === "PAID" && r.paymentMethod
                              ? ` · ${
                                  {
                                    CARD: "Card",
                                    WALLET: "Mobile Wallet",
                                    BANK_TRANSFER: "Bank Transfer",
                                    CASH: "Cash",
                                  }[r.paymentMethod] || r.paymentMethod
                                }`
                              : ""}
                          </p>
                        )}
                      </div>
                    )}

                    {r.status === "APPROVED" && (
                      <div className="esd-block">
                        <span className="esd-block-label">Fleet &amp; driver</span>
                        {r.assignments && r.assignments.length > 0 ? (
                          <div className="esd-assign-list">
                            {r.assignments.map((a, i) => (
                              <div key={i} className="esd-assign-item">
                                <span className="esd-date-pill">
                                  {fmtDate(a.serviceDate)}
                                </span>
                                <span className="esd-assign-veh">
                                  {a.vehicleLabel || "Vehicle"}
                                </span>
                                <span className="esd-assign-drv">
                                  {a.driverName
                                    ? `${a.driverName}${a.driverPhone ? ` · ${a.driverPhone}` : ""}`
                                    : "Driver to be confirmed"}
                                </span>
                                <span className={`esd-status s-${(a.status || "scheduled").toLowerCase()}`}>
                                  {a.status || "SCHEDULED"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="esd-block-text">
                            {viewerSide === "PARTNER"
                              ? "No vehicle assigned yet. Assign one so your driver turns up on the day."
                              : "Your partner hasn't assigned a vehicle and driver yet."}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="esd-actions">
                      {viewerSide === "PARTNER" && r.status === "PENDING" && (
                        <>
                          <button
                            className="esd-btn primary sm"
                            disabled={busyId === r._id}
                            onClick={() => openApprove(r)}
                          >
                            Approve &amp; set charge
                          </button>
                          <button
                            className="esd-btn danger sm"
                            disabled={busyId === r._id}
                            onClick={() => reject(r)}
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {viewerSide === "PARTNER" && r.status === "APPROVED" && (
                        <button
                          className="esd-btn primary sm"
                          disabled={busyId === r._id}
                          onClick={() => openAssign(r)}
                        >
                          {r.assignments && r.assignments.length > 0
                            ? "Reassign vehicle & driver"
                            : "Assign vehicle & driver"}
                        </button>
                      )}
                      {r.status === "APPROVED" &&
                        r.assignments &&
                        r.assignments.length > 0 && (
                          <button
                            className="esd-btn sm"
                            disabled={busyId === r._id}
                            onClick={() => openRoster(r)}
                          >
                            {viewerSide === "PARTNER"
                              ? "Manage students"
                              : "View students"}
                          </button>
                        )}
                      {viewerSide === "PARTNER" &&
                        r.status === "APPROVED" &&
                        r.billingMode === "SEPARATE" &&
                        r.paymentStatus === "PROCESSING" &&
                        ["CASH", "BANK_TRANSFER"].includes(r.paymentMethod) && (
                          <button
                            className="esd-btn primary sm"
                            disabled={busyId === r._id}
                            onClick={() => confirmPayment(r)}
                          >
                            {busyId === r._id
                              ? "Confirming…"
                              : "Confirm payment received"}
                          </button>
                        )}
                      {viewerSide === "CUSTOMER" &&
                        r.status === "APPROVED" &&
                        r.billingMode === "SEPARATE" &&
                        r.paymentStatus !== "PAID" &&
                        !(
                          r.paymentStatus === "PROCESSING" &&
                          ["CASH", "BANK_TRANSFER"].includes(r.paymentMethod)
                        ) && (
                          <button
                            className="esd-btn primary sm"
                            disabled={busyId === r._id}
                            onClick={() => openPay(r)}
                          >
                            {r.paymentStatus === "PROCESSING"
                              ? "Complete payment"
                              : `Pay ${fmtMoney(r.charge, r.currency)}`}
                          </button>
                        )}
                      {viewerSide === "CUSTOMER" &&
                        (r.status === "PENDING" ||
                          (r.status === "APPROVED" &&
                            r.paymentStatus !== "PAID" &&
                            r.paymentStatus !== "PROCESSING" &&
                            !["IN_PROGRESS", "COMPLETED"].includes(
                              r.fulfillmentStatus,
                            ))) && (
                          <button
                            className="esd-btn danger sm"
                            disabled={busyId === r._id}
                            onClick={() => cancel(r)}
                          >
                            Cancel request
                          </button>
                        )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ----------------------------- pay modal ----------------------------- */}
      {payFor && (
        <ExtraServicePaymentModal
          request={payFor}
          submitting={payingMethod}
          onClose={() => {
            if (!payingMethod) setPayFor(null);
          }}
          onSubmit={submitPayment}
        />
      )}

      {/* ---------------------------- create modal --------------------------- */}
      {showCreate && (
        <div className="esd-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="esd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="esd-modal-head">
              <h3>Request extra service day(s)</h3>
              <button
                className="esd-modal-close"
                onClick={() => setShowCreate(false)}
              >
                ×
              </button>
            </div>
            <div className="esd-modal-body">
              <label className="esd-field">
                <span className="esd-field-label">Purpose *</span>
                <input
                  type="text"
                  value={form.purpose}
                  placeholder="e.g. Grade 5 picnic to Safari Park"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, purpose: e.target.value }))
                  }
                />
              </label>

              <div className="esd-field">
                <span className="esd-field-label">Service date(s) *</span>
                {form.serviceDates.map((d, i) => (
                  <div key={i} className="esd-date-row">
                    <input
                      type="date"
                      value={d}
                      min={todayStr()}
                      onChange={(e) => updateDate(i, e.target.value)}
                    />
                    {form.serviceDates.length > 1 && (
                      <button
                        type="button"
                        className="esd-date-remove"
                        onClick={() => removeDate(i)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="esd-add-date" onClick={addDate}>
                  + Add another date
                </button>
              </div>

              <div className="esd-field-row">
                <label className="esd-field">
                  <span className="esd-field-label">Vehicles required</span>
                  <input
                    type="number"
                    min="1"
                    value={form.vehiclesRequired}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        vehiclesRequired: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="esd-field">
                  <span className="esd-field-label">Passengers (approx.)</span>
                  <input
                    type="number"
                    min="0"
                    value={form.passengerCount}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        passengerCount: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="esd-field-row">
                <label className="esd-field">
                  <span className="esd-field-label">Pickup location</span>
                  <input
                    type="text"
                    value={form.pickupLocation}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, pickupLocation: e.target.value }))
                    }
                  />
                </label>
                <label className="esd-field">
                  <span className="esd-field-label">Drop-off location</span>
                  <input
                    type="text"
                    value={form.dropoffLocation}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        dropoffLocation: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="esd-field-row">
                <label className="esd-field">
                  <span className="esd-field-label">Departure time</span>
                  <input
                    type="time"
                    value={form.departureTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, departureTime: e.target.value }))
                    }
                  />
                </label>
                <label className="esd-field">
                  <span className="esd-field-label">Expected return</span>
                  <input
                    type="time"
                    value={form.expectedReturnTime}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        expectedReturnTime: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <label className="esd-field">
                <span className="esd-field-label">Notes</span>
                <textarea
                  value={form.notes}
                  rows={2}
                  placeholder="Anything the partner should know…"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </label>
            </div>
            <div className="esd-modal-foot">
              <button
                className="esd-btn"
                onClick={() => setShowCreate(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="esd-btn primary"
                onClick={submitCreate}
                disabled={submitting}
              >
                {submitting ? "Sending…" : "Send request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------- approve modal -------------------------- */}
      {approveFor && (
        <div className="esd-modal-overlay" onClick={() => setApproveFor(null)}>
          <div className="esd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="esd-modal-head">
              <h3>Approve extra service day(s)</h3>
              <button
                className="esd-modal-close"
                onClick={() => setApproveFor(null)}
              >
                ×
              </button>
            </div>
            <div className="esd-modal-body">
              <div className="esd-approve-summary">
                <strong>{approveFor.purpose}</strong>
                <span>
                  {approveFor.serviceDates?.length} day(s) ·{" "}
                  {approveFor.vehiclesRequired} vehicle(s)
                </span>
                <div className="esd-card-dates">
                  {(approveFor.serviceDates || []).map((d, i) => (
                    <span key={i} className="esd-date-pill">
                      {fmtDate(d)}
                    </span>
                  ))}
                </div>
              </div>

              <label className="esd-field">
                <span className="esd-field-label">
                  Charge for the extra service ({approveFor.currency || "AED"}) *
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={approveForm.charge}
                  placeholder="e.g. 1500"
                  onChange={(e) =>
                    setApproveForm((f) => ({ ...f, charge: e.target.value }))
                  }
                />
              </label>

              <div className="esd-field">
                <span className="esd-field-label">How should this be billed?</span>
                <div className="esd-radio-group">
                  <label
                    className={`esd-radio ${approveForm.billingMode === "SEPARATE" ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="billingMode"
                      checked={approveForm.billingMode === "SEPARATE"}
                      onChange={() =>
                        setApproveForm((f) => ({
                          ...f,
                          billingMode: "SEPARATE",
                        }))
                      }
                    />
                    <span>
                      <strong>Separate invoice</strong>
                      <small>A standalone one-off charge for this trip.</small>
                    </span>
                  </label>
                  <label
                    className={`esd-radio ${approveForm.billingMode === "ADD_TO_CONTRACT" ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="billingMode"
                      checked={approveForm.billingMode === "ADD_TO_CONTRACT"}
                      onChange={() =>
                        setApproveForm((f) => ({
                          ...f,
                          billingMode: "ADD_TO_CONTRACT",
                        }))
                      }
                    />
                    <span>
                      <strong>Add to contract</strong>
                      <small>
                        Fold the charge into the contract balance so it&apos;s
                        collected with the contract payment.
                      </small>
                    </span>
                  </label>
                </div>
              </div>

              <label className="esd-field">
                <span className="esd-field-label">Note to client (optional)</span>
                <textarea
                  rows={2}
                  value={approveForm.partnerResponseNote}
                  onChange={(e) =>
                    setApproveForm((f) => ({
                      ...f,
                      partnerResponseNote: e.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="esd-modal-foot">
              <button
                className="esd-btn"
                onClick={() => setApproveFor(null)}
                disabled={busyId === approveFor._id}
              >
                Cancel
              </button>
              <button
                className="esd-btn primary"
                onClick={submitApprove}
                disabled={busyId === approveFor._id}
              >
                {busyId === approveFor._id ? "Approving…" : "Approve & invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------- assign modal --------------------------- */}
      {assignFor && (
        <div className="esd-modal-overlay" onClick={() => setAssignFor(null)}>
          <div className="esd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="esd-modal-head">
              <h3>Assign vehicle &amp; driver</h3>
              <button
                className="esd-modal-close"
                onClick={() => setAssignFor(null)}
              >
                ×
              </button>
            </div>
            <div className="esd-modal-body">
              <p className="esd-modal-intro">
                Pick which of the vehicles you&apos;ve committed to{" "}
                {assignFor.customerName} goes out for{" "}
                <strong>{assignFor.purpose}</strong>. Each date becomes a trip
                the assigned driver sees on that day.
              </p>

              {fleetLoading ? (
                <p className="esd-block-text">Loading your fleet…</p>
              ) : fleet.length === 0 ? (
                <p className="esd-block-text">
                  No vehicles are assigned to this contract yet. Assign fleet on
                  the Vehicles &amp; Routes tab first.
                </p>
              ) : (
                assignRows.map((row, idx) => (
                  <div key={idx} className="esd-assign-row">
                    <span className="esd-date-pill">
                      {fmtDate(row.serviceDate)}
                    </span>
                    <label className="esd-field">
                      <span className="esd-field-label">Vehicle &amp; driver</span>
                      <select
                        value={row.unitId}
                        onChange={(e) => updateAssignRow(idx, e.target.value)}
                      >
                        <option value="">— Select vehicle &amp; driver —</option>
                        {fleet.map((f) => (
                          <option key={f.unitId} value={f.unitId}>
                            {f.vehicleLabel}
                            {f.driverName ? ` — ${f.driverName}` : ""}
                            {f.driverPhone ? ` · ${f.driverPhone}` : ""}
                            {f.seatingCapacity
                              ? ` · ${f.seatingCapacity} seats`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))
              )}
            </div>
            <div className="esd-modal-foot">
              <button
                className="esd-btn ghost"
                onClick={() => setAssignFor(null)}
              >
                Cancel
              </button>
              <button
                className="esd-btn primary"
                onClick={submitAssign}
                disabled={busyId === assignFor._id || fleet.length === 0}
              >
                {busyId === assignFor._id ? "Assigning…" : "Confirm assignment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------- roster modal --------------------------- */}
      {rosterFor && (
        <div className="esd-modal-overlay" onClick={() => setRosterFor(null)}>
          <div
            className="esd-modal esd-modal-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="esd-modal-head">
              <h3>Students for “{rosterFor.purpose}”</h3>
              <button
                className="esd-modal-close"
                onClick={() => setRosterFor(null)}
              >
                ×
              </button>
            </div>
            <div className="esd-modal-body">
              <p className="esd-modal-intro">
                {roster?.canManage
                  ? "Add the specific students who travel on each assigned vehicle for this extra day, and choose how each one travels — round trip (goes and comes back), one way going only, or one way return only. Each student's trip then shows this exact vehicle, driver and their leg, the driver sees who to pick up and where, and every student can track the ride live on the service date."
                  : "The students your partner has assigned to travel on each vehicle for this extra day, and how each one travels."}
              </p>

              {rosterLoading || !roster ? (
                <p className="esd-block-text">Loading roster…</p>
              ) : roster.dateGroups.length === 0 ? (
                <p className="esd-block-text">
                  No vehicle is assigned yet. Assign a vehicle &amp; driver first,
                  then add students here.
                </p>
              ) : (
                roster.dateGroups.map((g) => {
                  const onTripIds = new Set(
                    (g.passengers || []).map((p) => p.employeeId),
                  );
                  const available = (roster.assignableStudents || []).filter(
                    (s) => !onTripIds.has(s.employeeId),
                  );
                  const seatsFull = (g.availableSeats ?? 0) <= 0;
                  // Event endpoints, used to label each student's leg direction.
                  const origin = rosterFor.pickupLocation || "School";
                  const destination =
                    rosterFor.dropoffLocation || rosterFor.purpose || "Destination";
                  return (
                    <div key={g.tripId || g.serviceDate} className="esd-roster-group">
                      <div className="esd-roster-head">
                        <span className="esd-date-pill">
                          {fmtDate(g.serviceDate)}
                        </span>
                        <span className="esd-roster-veh">{g.vehicleLabel}</span>
                        {g.driverName && (
                          <span className="esd-roster-drv">
                            {g.driverName}
                            {g.driverPhone ? ` · ${g.driverPhone}` : ""}
                          </span>
                        )}
                        <span className="esd-roster-seats">
                          {g.bookedSeats}/{g.totalSeats} seats
                        </span>
                        <span
                          className={`esd-status s-${(g.status || "scheduled").toLowerCase()}`}
                        >
                          {g.status}
                        </span>
                      </div>

                      {/* Students currently on this trip */}
                      <div className="esd-roster-col">
                        <span className="esd-block-label">
                          On this vehicle ({g.passengers.length})
                        </span>
                        {g.passengers.length === 0 ? (
                          <p className="esd-block-text esd-roster-empty">
                            No students added yet.
                          </p>
                        ) : (
                          <ul className="esd-roster-list">
                            {g.passengers.map((p) => (
                              <li key={p.employeeId} className="esd-roster-item">
                                <span className="esd-roster-name">{p.name}</span>
                                <span
                                  className={`esd-journey-badge j-${(p.journeyType || "ROUND_TRIP").toLowerCase()}`}
                                >
                                  {JOURNEY_LABEL[p.journeyType] || "Round trip"}
                                </span>
                                <span className="esd-roster-stop">
                                  {p.pickupStop || p.dropoffStop
                                    ? [p.pickupStop, p.dropoffStop]
                                        .filter(Boolean)
                                        .join(" → ")
                                    : journeyRoute(
                                        p.journeyType,
                                        origin,
                                        destination,
                                      )}
                                </span>
                                {roster.canManage &&
                                  !["COMPLETED", "CANCELLED"].includes(
                                    g.status,
                                  ) && (
                                    <button
                                      className="esd-roster-remove"
                                      disabled={
                                        rosterBusyKey ===
                                        `${g.tripId}:${p.employeeId}`
                                      }
                                      onClick={() =>
                                        toggleStudent(
                                          g.tripId,
                                          p.employeeId,
                                          "remove",
                                        )
                                      }
                                    >
                                      Remove
                                    </button>
                                  )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Assignable students (partner only) */}
                      {roster.canManage &&
                        !["COMPLETED", "CANCELLED"].includes(g.status) && (
                          <div className="esd-roster-col">
                            <span className="esd-block-label">
                              Add students{seatsFull ? " (vehicle full)" : ""}
                            </span>
                            {available.length === 0 ? (
                              <p className="esd-block-text esd-roster-empty">
                                All active students are already on this vehicle.
                              </p>
                            ) : (
                              <ul className="esd-roster-list">
                                {available.map((s) => {
                                  const draftKey = `${g.tripId}:${s.employeeId}`;
                                  const draftJourney =
                                    journeyDrafts[draftKey] || "ROUND_TRIP";
                                  const isBusy = rosterBusyKey === draftKey;
                                  return (
                                    <li
                                      key={s.employeeId}
                                      className="esd-roster-item esd-roster-add-item"
                                    >
                                      <div className="esd-roster-add-info">
                                        <span className="esd-roster-name">
                                          {s.name}
                                        </span>
                                        {s.email && (
                                          <span className="esd-roster-stop">
                                            {s.email}
                                          </span>
                                        )}
                                        <span className="esd-roster-stop esd-roster-route">
                                          {journeyRoute(
                                            draftJourney,
                                            origin,
                                            destination,
                                          )}
                                        </span>
                                      </div>
                                      <div className="esd-roster-add-controls">
                                        <label className="esd-journey-select">
                                          <span className="sr-only">
                                            How does {s.name} travel?
                                          </span>
                                          <select
                                            value={draftJourney}
                                            disabled={isBusy}
                                            onChange={(e) =>
                                              setJourneyDraft(
                                                draftKey,
                                                e.target.value,
                                              )
                                            }
                                          >
                                            {JOURNEY_OPTIONS.map((opt) => (
                                              <option
                                                key={opt.value}
                                                value={opt.value}
                                              >
                                                {opt.label}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <button
                                          className="esd-roster-add"
                                          disabled={seatsFull || isBusy}
                                          onClick={() =>
                                            toggleStudent(
                                              g.tripId,
                                              s.employeeId,
                                              "add",
                                              draftJourney,
                                            )
                                          }
                                        >
                                          {isBusy ? "Adding…" : "Add"}
                                        </button>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="esd-modal-foot">
              <button
                className="esd-btn primary"
                onClick={() => setRosterFor(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`esd-toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
