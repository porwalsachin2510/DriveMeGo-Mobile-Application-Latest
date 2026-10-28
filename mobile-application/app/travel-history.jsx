import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { AppHeader } from "../src/components/AppHeader";
import { PageHero } from "../src/components/PageHero";
import { FilterSelect } from "../src/components/FilterSelect";
import { Badge, EmptyState, Loading } from "../src/components/ui";
import { travelHistoryService } from "../src/services";
import { bookingStatusMeta, dayParts, formatMoney, toDate } from "../src/utils/format";
import { useFocusEffect } from "expo-router";
import { colors, radius, shadow } from "../src/theme";

const PERIODS = [
  { value: "month", label: "This Month" },
  { value: "30", label: "Last 30 Days" },
  { value: "90", label: "Last 3 Months" },
  { value: "all", label: "All Time" },
];

const STATUSES = [
  { value: "all", label: "All Status" },
  { value: "COMPLETED", label: "Completed" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "CANCELLED", label: "Cancelled" },
];

const normalizeStatus = (s) => {
  const v = String(s || "").toUpperCase();
  if (v === "CANCELED") return "CANCELLED";
  if (["CONFIRMED", "BOOKED", "PENDING", "SCHEDULED", "ACTIVE"].includes(v)) return "UPCOMING";
  return v;
};

const routeLabel = (t) => `${t.pickupLocation || "-"} - ${t.dropoffLocation || "-"}`;

const inPeriod = (date, period) => {
  if (period === "all") return true;
  const d = toDate(date);
  if (!d) return false;
  const now = new Date();
  if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  const from = new Date();
  from.setDate(from.getDate() - Number(period));
  return d >= from;
};

function TripCard({ trip, onPress }) {
  const parts = dayParts(trip.tripDate);
  const status = normalizeStatus(trip.status);
  const meta = bookingStatusMeta(status);
  const accent = status === "COMPLETED" ? colors.success : status === "CANCELLED" ? colors.muted : colors.info;
  const toneBg = status === "COMPLETED" ? colors.successSoft : status === "CANCELLED" ? "#EEF2F7" : colors.infoSoft;
  const time = trip.pickupTime || trip.startTime || "--";

  return (
    <View style={[styles.card, shadow]}>
      <View style={styles.cardTop}>
        <View style={[styles.dateBlock, { backgroundColor: toneBg }]}>
          <Text style={[styles.dateDay, { color: accent }]}>{parts.day}</Text>
          <Text style={[styles.dateNum, { color: colors.navy }]}>{parts.date}</Text>
          <Text style={[styles.dateMonth, { color: accent }]}>{parts.month}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ alignSelf: "flex-end" }}>
            <Badge
              label={status === "UPCOMING" ? "Upcoming" : meta.label}
              tone={status === "COMPLETED" ? "success" : status === "CANCELLED" ? "muted" : "info"}
            />
          </View>
          <Text style={styles.route} numberOfLines={2}>
            {trip.pickupLocation || "Pickup"}
            <Text style={{ color: colors.teal }}> {"\u2192"} </Text>
            {trip.dropoffLocation || "Dropoff"}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {trip.routeName || "Route"} - {trip.seats || 1} {(trip.seats || 1) > 1 ? "Seats" : "Seat"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.navy} />
      </View>
      <View style={styles.infoRow}>
        <Info icon="time-outline" label="Pickup" value={time} />
        <View style={styles.sep} />
        <Info icon="person-outline" label="Driver" value={trip.driverName || "N/A"} />
        <View style={styles.sep} />
        <Info icon="wallet-outline" label="Trip Fare" value={formatMoney(trip.paymentAmount || 0, trip.currency || "AED")} />
      </View>
    </View>
  );
}

function Info({ icon, label, value }) {
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={18} color={colors.navy} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function TravelHistoryScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("month");
  const [routeFilter, setRouteFilter] = useState("all");
  const [status, setStatus] = useState("all");

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const res = await travelHistoryService.mine({ page: 1, limit: 200 });
      const list = res?.data?.history || res?.data?.travelHistory || [];
      setTrips(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Could not load your travel history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const routeOptions = useMemo(() => {
    const labels = [...new Set(trips.map(routeLabel))];
    return [{ value: "all", label: "All Routes" }, ...labels.map((l) => ({ value: l, label: l }))];
  }, [trips]);

  const filtered = useMemo(
    () =>
      trips.filter(
        (t) =>
          inPeriod(t.tripDate, period) &&
          (routeFilter === "all" || routeLabel(t) === routeFilter) &&
          (status === "all" || normalizeStatus(t.status) === status)
      ),
    [trips, period, routeFilter, status]
  );

  return (
    <Screen header={<AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/more"))} />} refreshing={refreshing} onRefresh={() => load(true)} decor>
      <PageHero eyebrow="Travel History" title="Your Travel History" subtitle="View and manage your past trips, routes and ride details." icon="time-outline" />

      <View style={styles.filters}>
        <FilterSelect icon="calendar-outline" title="Period" value={period} options={PERIODS} onChange={setPeriod} />
        <FilterSelect icon="location-outline" title="Route" value={routeFilter} options={routeOptions} onChange={setRouteFilter} />
        <FilterSelect icon="flag-outline" title="Status" value={status} options={STATUSES} onChange={setStatus} />
      </View>

      {loading ? (
        <Loading label="Loading trips..." />
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Something went wrong" message={error} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="bus-outline" title="No trips found" message="Try changing the filters to see more trips." />
      ) : (
        <View style={{ gap: 14 }}>
          {filtered.map((t) => (
            <TripCard
              key={String(t._id)}
              trip={t}
              onPress={() => t.bookingId && router.push({ pathname: "/booking-details", params: { bookingId: String(t.bookingId) } })}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 8, marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: radius.xl, padding: 12, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  dateBlock: { width: 62, height: 78, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  dateDay: { fontSize: 12, fontWeight: "700" },
  dateNum: { fontSize: 26, fontWeight: "800", lineHeight: 30 },
  dateMonth: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  route: { fontSize: 15, fontWeight: "800", color: colors.navy },
  sub: { fontSize: 12.5, color: colors.muted },
  infoRow: { flexDirection: "row", alignItems: "center", marginTop: 12, padding: 12, borderRadius: radius.lg, backgroundColor: colors.tealTint },
  info: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  sep: { width: 1, alignSelf: "stretch", backgroundColor: colors.border, marginHorizontal: 8 },
  infoLabel: { fontSize: 10.5, color: colors.muted },
  infoValue: { fontSize: 12.5, fontWeight: "800", color: colors.navy },
});
