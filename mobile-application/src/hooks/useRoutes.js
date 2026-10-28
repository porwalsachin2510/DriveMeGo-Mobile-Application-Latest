import { useQuery } from "@tanstack/react-query";
import { routeService } from "../services";
import { useAuth } from "../context/AuthContext";

export function useRoutes({ pickup = "", dropoff = "", days } = {}) {
  const { isAuthenticated } = useAuth();
  const hasSearch = !!(pickup.trim() || dropoff.trim());

  return useQuery({
    queryKey: ["routes", { pickup: pickup.trim(), dropoff: dropoff.trim(), days, isAuthenticated }],
    queryFn: async () => {
      const data = await routeService.search({
        authenticated: isAuthenticated,
        filterType: hasSearch ? "matched" : "all",
        pickupLocation: pickup.trim(),
        dropoffLocation: dropoff.trim(),
        selectedDays: hasSearch ? days : undefined,
      });
      return {
        routes: data.routes || [],
        serviceAvailable: data.serviceAvailable !== false,
        message: data.message,
      };
    },
  });
}

export const ROUTE_FILTERS = [
  { key: "all", label: "All", icon: "bus-outline", match: null },
  { key: "budget", label: "Budget Friendly", icon: "wallet-outline", match: ["budget"] },
  { key: "ac", label: "AC Vehicle", icon: "snow-outline", match: ["ac"] },
  { key: "wifi", label: "WiFi Available", icon: "wifi-outline", match: ["wifi", "wi-fi"] },
  { key: "premium", label: "Premium", icon: "diamond-outline", match: ["premium"] },
  { key: "ladies", label: "Ladies Only", icon: "woman-outline", match: ["ladies", "women"] },
  { key: "express", label: "Express", icon: "flash-outline", match: ["express"] },
];

export const filterRoutes = (routes, filterKey, query = "") => {
  const filter = ROUTE_FILTERS.find((f) => f.key === filterKey);
  const q = query.trim().toLowerCase();
  return routes.filter((route) => {
    if (filter?.match) {
      const labels = (route.tags || []).map((t) => String(t.label || "").toLowerCase());
      if (!labels.some((label) => filter.match.some((m) => label.includes(m)))) return false;
    }
    if (q) {
      const haystack = `${route.fromLocation} ${route.toLocation} ${route.operator}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
};

export const routeCurrency = (route) => route?.pricing?.currency || "AED";

export const uniqueTripTimes = (route) => {
  const set = new Set();
  (route?.tripTimes || []).forEach((t) => t.departureTime && set.add(t.departureTime));
  return Array.from(set);
};
