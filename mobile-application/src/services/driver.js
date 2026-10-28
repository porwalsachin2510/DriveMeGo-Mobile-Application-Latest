import api from "../api/client";

const unwrap = (res) => res.data;

export const b2cDriverService = {
  bookings: (status) =>
    api.get("/b2c-bookings/driver/bookings", { params: status ? { status } : undefined }).then(unwrap),
  trips: (filter = "today") => api.get("/b2c-daily-trips/driver/trips", { params: { filter } }).then(unwrap),
  startTrip: (tripId) => api.put(`/b2c-daily-trips/driver/start/${tripId}`).then(unwrap),
  completeTrip: (tripId) => api.put(`/b2c-daily-trips/driver/complete/${tripId}`).then(unwrap),
  availability: () => api.get("/b2c-daily-trips/driver/availability").then(unwrap),
  setAvailability: (status) => api.put("/b2c-daily-trips/driver/availability/status", { status }).then(unwrap),
  availabilityDetailed: () => api.get("/b2c-daily-trips/driver/availability/detailed").then(unwrap),
  checkAvailability: () => api.get("/b2c-daily-trips/driver/check-availability").then(unwrap),
  ratings: () => api.get("/travel-history/driver-ratings").then(unwrap),
  updateLocation: (payload) => api.post("/b2c-daily-trips/driver/update-location", payload).then(unwrap),
};

const bookingBase = (kind) => (kind === "corporate" ? "/bookings/corporate" : "/bookings/b2b-partner");

export const managedDriverService = {
  bookings: (kind, userId) =>
    api
      .get(kind === "corporate" ? `/bookings/corporate/driver/${userId}` : `/bookings/b2b-partner/driver/${userId}`)
      .then(unwrap),
  startTrip: (kind, bookingId, mergedTripIds = []) =>
    api.put(`${bookingBase(kind)}/${bookingId}/start`, { mergedTripIds }).then(unwrap),
  completeTrip: (kind, bookingId, mergedTripIds = []) =>
    api.put(`${bookingBase(kind)}/${bookingId}/complete`, { mergedTripIds }).then(unwrap),
  activeTrip: () => api.get("/driver/active-trip").then(unwrap),
  updateLocation: (payload) => api.post("/driver/update-location", payload).then(unwrap),
};

export const driverEmergencyService = {
  report: (tripId, payload) => api.post(`/driver/trips/${tripId}/emergency`, payload).then(unwrap),
};

export const employeeService = {
  dashboard: () => api.get("/corporate-employee-users/dashboard").then(unwrap),
  history: (params) => api.get("/travel-history/my-history", { params }).then(unwrap),
  activeTrip: (coords) => api.get("/trips/my-active-trip", { params: coords || {} }).then(unwrap),
  cancelTrip: (tripId, reason) =>
    api.post("/corporate-employee-users/booking", { action: "CANCEL", tripId, reason }).then(unwrap),
  notTravelingToday: (reason) =>
    api.post("/corporate-employee-users/not-traveling-today", { date: new Date().toISOString(), reason }).then(unwrap),
  rateTrip: (payload) => api.post("/corporate-employee-users/rate-trip", payload).then(unwrap),
  routeChangeRequests: () => api.get("/corporate-employee-users/route-change-requests").then(unwrap),
  requestRouteChange: (payload) => api.post("/corporate-employee-users/request-route-change", payload).then(unwrap),
  cancelRouteChange: (id) => api.patch(`/corporate-employee-users/route-change-requests/${id}/cancel`).then(unwrap),
};

export const noShowService = {
  mine: (params) => api.get("/no-show/my-no-shows", { params }).then(unwrap),
  notTraveling: ({ reason, notes }) =>
    api
      .post("/corporate-employee-users/not-traveling-today", { date: new Date().toISOString(), reason, notes })
      .then(unwrap),
};

export const sosService = {
  myAlerts: () => api.get("/sos/my-alerts").then(unwrap),
  myActive: () => api.get("/sos/my-active").then(unwrap),
  raise: (payload) => api.post("/sos/raise", payload).then(unwrap),
  cancel: (id) => api.patch(`/sos/${id}/cancel`, { note: "Cancelled by passenger (false alarm)" }).then(unwrap),
};
