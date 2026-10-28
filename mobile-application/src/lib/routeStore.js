let selectedRoute = null;
let bookingDraft = null;

export const routeStore = {
  setRoute: (route) => {
    selectedRoute = route;
  },
  getRoute: () => selectedRoute,
  setDraft: (draft) => {
    bookingDraft = draft;
  },
  getDraft: () => bookingDraft,
  clear: () => {
    selectedRoute = null;
    bookingDraft = null;
  },
};
