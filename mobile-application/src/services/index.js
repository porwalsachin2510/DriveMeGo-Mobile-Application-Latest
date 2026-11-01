import api from "../api/client";

const unwrap = (res) => res.data;

export const pageService = {
  page: (slug) => api.get(`/pages/public/${slug}`).then(unwrap),
  settings: () => api.get("/pages/public/settings").then(unwrap),
};

export const authService = {
  forgotPassword: (email) => api.post("/auth/forgot-password", { email: email.trim().toLowerCase() }).then(unwrap),
  verifyResetOtp: (email, otp) =>
    api.post("/auth/verify-reset-otp", { email: email.trim().toLowerCase(), otp }).then(unwrap),
  resetPassword: (email, resetToken, newPassword) =>
    api.post("/auth/reset-password", { email: email.trim().toLowerCase(), resetToken, newPassword }).then(unwrap),
};

export const routeService = {
  search: ({ authenticated, ...params }) => {
    const query = { ...params };
    if (query.selectedDays && typeof query.selectedDays !== "string") {
      query.selectedDays = JSON.stringify(query.selectedDays);
    }
    Object.keys(query).forEach((k) => (query[k] === undefined || query[k] === "" || query[k] === null) && delete query[k]);
    const url = authenticated ? "/commute/search" : "/commute/public-search";
    return api.get(url, { params: query }).then(unwrap);
  },
  details: (routeId) => api.get(`/commute/routes/${routeId}`).then(unwrap),
  paymentSettings: () => api.get("/pages/public/payment-settings").then(unwrap),
  schedules: (routeId) => api.get(`/b2c-partner/routes/${routeId}/schedules`).then(unwrap),
  seatAvailability: (routeId) =>
    api.get(`/b2c-partner/public/routes/${routeId}/trips/seat-availability`).then(unwrap),
  commuterRoutes: (nationality) =>
    api.get("/commuter/routes", { params: nationality ? { nationality } : {} }).then(unwrap),
  save: (routeId) => api.post(`/commuter/routes/${routeId}/save`).then(unwrap),
  unsave: (routeId) => api.post(`/commuter/routes/${routeId}/leave`).then(unwrap),
  commuterStats: () => api.get("/commuter/stats").then(unwrap),
};

export const bookingService = {
  createMonthlyPass: (payload) => api.post("/monthly-pass/create", payload).then(unwrap),
  passenger: (params) => api.get("/bookings/passenger", { params }).then(unwrap),
  details: (bookingId) => api.get(`/b2c-bookings/booking/${bookingId}`).then(unwrap),
  cancellationPreview: (bookingId) => api.get(`/bookings/${bookingId}/cancellation-preview`).then(unwrap),
  dailyTrips: (bookingId) => api.get(`/bookings/${bookingId}/daily-trips`).then(unwrap),
  cancel: (bookingId, cancellationReason) =>
    api.put(`/bookings/${bookingId}/cancel`, { cancellationReason }).then(unwrap),
  userPasses: (userId) => api.get(`/monthly-pass/user/${userId}`).then(unwrap),
  passDetails: (passId) => api.get(`/monthly-pass/details/${passId}`).then(unwrap),
  passCertificatePath: (passId) => `/monthly-pass/download/${passId}`,
  cancelPass: (passId, reason) => api.post("/monthly-pass/cancel", { passId, reason }).then(unwrap),
  renewPass: (passId, durationMonths, paymentMethod) =>
    api.post("/monthly-pass/renew", { passId, durationMonths, paymentMethod }).then(unwrap),
};

export const walletService = {
  balance: () => api.get("/wallet/balance").then(unwrap),
  transactions: (page = 1, limit = 20) => api.get("/wallet/transactions", { params: { page, limit } }).then(unwrap),
  createPaymentSession: (payload) => api.post("/wallet/create-payment-session", payload).then(unwrap),
  withdraw: (payload) => api.post("/wallet/withdraw", payload).then(unwrap),
};

export const notificationService = {
  list: (userId, page = 1, limit = 30) =>
    api.get(`/notifications/user/${userId}`, { params: { page, limit } }).then(unwrap),
  unreadCount: (userId) => api.get(`/notifications/user/${userId}/unread-count`).then(unwrap),
  markRead: (id) => api.patch(`/notifications/${id}/read`).then(unwrap),
  markAllRead: (userId) => api.patch(`/notifications/user/${userId}/read-all`).then(unwrap),
  remove: (id) => api.delete(`/notifications/${id}`).then(unwrap),
};

export const travelHistoryService = {
  mine: (params) => api.get("/travel-history/my-history", { params }).then(unwrap),
  rate: (travelId, payload) => api.post(`/travel-history/rate/${travelId}`, payload).then(unwrap),
};

export const routeRequestService = {
  mostRequested: (params) => api.get("/route-requests/most-requested", { params }).then(unwrap),
  showInterest: (payload) => api.post("/route-requests/show-interest", payload).then(unwrap),
  create: (payload) => api.post("/route-requests/request", payload).then(unwrap),
  mine: (params) => api.get("/route-requests/my-requests", { params }).then(unwrap),
};

export const profileService = {
  get: () => api.get("/commuter/profile").then(unwrap),
  update: (payload) => api.put("/commuter/profile", payload).then(unwrap),
  changePassword: (currentPassword, newPassword) =>
    api.put("/commuter/change-password", { currentPassword, newPassword }).then(unwrap),
};

export const subscriptionService = {
  settings: () => api.get("/subscription-settings/settings").then(unwrap),
  update: (payload) => api.put("/subscription-settings/settings", payload).then(unwrap),
  cancel: (payload) => api.post("/subscription-settings/cancel", payload).then(unwrap),
  renew: (payload) => api.post("/subscription-settings/renew", payload).then(unwrap),
};

export const engagementService = {
  city: () => api.get("/engagement/city").then(unwrap),
  setCity: (city) => api.put("/engagement/city", { city }).then(unwrap),

  contacts: () => api.get("/engagement/emergency-contacts").then(unwrap),
  createContact: (payload) => api.post("/engagement/emergency-contacts", payload).then(unwrap),
  updateContact: (id, payload) => api.put(`/engagement/emergency-contacts/${id}`, payload).then(unwrap),
  deleteContact: (id) => api.delete(`/engagement/emergency-contacts/${id}`).then(unwrap),

  submitFeedback: (payload) => api.post("/engagement/feedback", payload).then(unwrap),
  myFeedback: (params) => api.get("/engagement/feedback/mine", { params }).then(unwrap),

  faqs: (params) => api.get("/engagement/faqs", { params }).then(unwrap),

  posts: (params) => api.get("/engagement/posts", { params }).then(unwrap),
  post: (idOrSlug) => api.get(`/engagement/posts/${idOrSlug}`).then(unwrap),

  contests: () => api.get("/engagement/contests").then(unwrap),
  joinContest: (id, payload) => api.post(`/engagement/contests/${id}/join`, payload).then(unwrap),

  referrals: () => api.get("/engagement/referrals").then(unwrap),
  applyReferral: (code) => api.post("/engagement/referrals/apply", { code }).then(unwrap),

  protection: () => api.get("/engagement/trip-protection").then(unwrap),
  buyProtection: (payload) => api.post("/engagement/trip-protection", payload).then(unwrap),
  claimProtection: (id, reason) => api.post(`/engagement/trip-protection/${id}/claim`, { reason }).then(unwrap),
};
