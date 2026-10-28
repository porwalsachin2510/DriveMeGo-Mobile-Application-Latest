import api from "../api/client";

const unwrap = (res) => res.data;

export const partnerService = {
  dashboardStats: () => api.get("/b2c-partner/dashboard-stats").then(unwrap),
  renewals: () => api.get("/b2c-partner/subscription-renewals").then(unwrap),
  earnings: (period = "monthly") => api.get("/b2c-partner/earnings", { params: { period } }).then(unwrap),

  fleet: () => api.get("/b2c-partner/fleet").then(unwrap),
  deleteVehicle: (id) => api.delete(`/b2c-partner/vehicles/${id}`).then(unwrap),
  setVehicleStatus: (id, status) => api.put(`/b2c-partner/vehicles/${id}/status`, { status }).then(unwrap),
  setVehicleAvailability: (id, availabilityStatus) =>
    api.put(`/b2c-partner/vehicles/${id}/status`, { availabilityStatus }).then(unwrap),
  createVehicle: (formData) => api.post("/b2c-partner/vehicles", formData).then(unwrap),
  updateVehicle: (id, formData) => api.put(`/b2c-partner/vehicles/${id}`, formData).then(unwrap),

  drivers: () => api.get("/b2c-partner/drivers").then(unwrap),
  deleteDriver: (id) => api.delete(`/b2c-partner/drivers/${id}`).then(unwrap),
  createDriver: (formData) => api.post("/b2c-partner/drivers", formData).then(unwrap),
  updateDriver: (id, formData) => api.put(`/b2c-partner/drivers/${id}`, formData).then(unwrap),
  setDriverAvailability: (payload) => api.post("/b2c-partner/drivers/availability", payload).then(unwrap),
  availableDrivers: (params) => api.get("/b2c-partner/drivers/available-for-assignment", { params }).then(unwrap),
  selfDriverStatus: () => api.get("/b2c-partner/self-driver/status").then(unwrap),
  toggleSelfDriver: (payload) => api.post("/b2c-partner/self-driver/toggle", payload).then(unwrap),

  routes: () => api.get("/b2c-partner/routes").then(unwrap),
  deleteRoute: (id) => api.delete(`/b2c-partner/routes/${id}`).then(unwrap),
  assignDriverToRoute: (payload) => api.post("/b2c-partner/assign-driver-route", payload).then(unwrap),
  assignDriverToVehicle: (vehicleId, payload) =>
    api.post(`/b2c-partner/vehicles/${vehicleId}/assign-driver`, payload).then(unwrap),

  routeRequests: (params) => api.get("/b2c-partner/route-requests", { params }).then(unwrap),
  respondRouteRequest: (id, payload) => api.put(`/b2c-partner/route-requests/${id}/respond`, payload).then(unwrap),

  profile: () => api.get("/b2c-partner/profile").then(unwrap),
  updateProfile: (payload) => api.put("/b2c-partner/profile", payload).then(unwrap),
  updateProfileImage: (formData) => api.put("/b2c-partner/profile/image", formData).then(unwrap),
};

export const scheduleService = {
  create: (payload) => api.post("/b2c-schedules/routes", payload).then(unwrap),
  routesByPartner: () => api.get("/b2c-schedules/routes").then(unwrap),
  createSchedule: (payload) => api.post("/b2c-schedules/schedules", payload).then(unwrap),
  schedules: (routeId) => api.get("/b2c-schedules/schedules", { params: routeId ? { routeId } : {} }).then(unwrap),
  deleteSchedule: (scheduleId) => api.delete(`/b2c-schedules/schedules/${scheduleId}`).then(unwrap),
  addToRoute: (routeId, payload) => api.post("/b2c-schedules/schedules", { ...payload, routeId }).then(unwrap),
};

export const partnerBookingService = {
  list: () => api.get("/b2c-bookings/partner/bookings").then(unwrap),
  history: () => api.get("/b2c-bookings/partner/bookings/history").then(unwrap),
  updateStatus: (bookingId, payload) => api.put(`/b2c-bookings/booking/${bookingId}/status`, payload).then(unwrap),
  details: (bookingId) => api.get(`/b2c-bookings/booking/${bookingId}`).then(unwrap),
};

export const dailyTripService = {
  today: () => api.get("/b2c-daily-trips/today").then(unwrap),
  upcoming: () => api.get("/b2c-daily-trips/upcoming").then(unwrap),
  selfDriverTrips: () => api.get("/b2c-daily-trips/partner/self-driver-trips").then(unwrap),
  start: (tripId) => api.put(`/b2c-daily-trips/partner/start/${tripId}`).then(unwrap),
  complete: (tripId) => api.put(`/b2c-daily-trips/partner/complete/${tripId}`).then(unwrap),
};

export const subscriptionSettingsService = {
  get: () => api.get("/subscription-settings/settings").then(unwrap),
  setAutoRenewal: (autoRenewal) => api.put("/subscription-settings/settings", { autoRenewal }).then(unwrap),
};

export const commissionService = {
  mine: () => api.get("/commission/my-commission").then(unwrap),
};

export const settlementService = {
  mine: (params) => api.get("/settlement/my-settlement", { params }).then(unwrap),
};

export const ratingsService = {
  driverRatings: (params) => api.get("/travel-history/driver-ratings", { params }).then(unwrap),
};


