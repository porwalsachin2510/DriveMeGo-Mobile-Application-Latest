import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
    registerCorporateEmployee,
    getEmployeeDashboard,
    getAssignedRoute,
    manageBooking,
    markNotTravelingToday,
    rateTrip,
    requestRouteChange,
    getMyRouteChangeRequests,
    cancelRouteChangeRequest,
    getEmployeeMonthlyPasses
} from "../controllers/corporateEmployeeUserController.js";

const router = express.Router();

// Employee registration and dashboard
router.post("/register", verifyToken, registerCorporateEmployee);
router.get("/dashboard", verifyToken, getEmployeeDashboard);
router.get("/route", verifyToken, getAssignedRoute);
router.get("/monthly-passes", verifyToken, getEmployeeMonthlyPasses);

// Booking management
router.post("/booking", verifyToken, manageBooking);
router.post("/not-traveling-today", verifyToken, markNotTravelingToday);

// Feedback and requests
router.post("/rate-trip", verifyToken, rateTrip);
router.post("/request-route-change", verifyToken, requestRouteChange);
router.get("/route-change-requests", verifyToken, getMyRouteChangeRequests);
router.patch("/route-change-requests/:requestId/cancel", verifyToken, cancelRouteChangeRequest);

export default router;
