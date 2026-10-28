import { useMemo, useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "./Screen";
import { AppHeader } from "./AppHeader";
import { EmptyState, Loading } from "./ui";
import { DriverBanner, GradientAction, HelpStrip, MetaCell, PageTitle, SegmentTabs, StatusPill, TripCard } from "./driver";
import { useLocationSharing } from "../context/LocationContext";
import { DriverAvailabilityCard } from "./DriverAvailability";
import { b2cDriverService } from "../services/driver";
import { bookingDate, bookingRoute, longDate, passengerName, placeName, shortDate, statusOf, toTime12 } from "../utils/driver";
import { colors, radius, shadow } from "../theme";

const LIVE_HREF = "/b2c-driver/live";

const STATUS_META = {
  PENDING: { label: "Pending", tone: "warning" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  ACCEPTED: { label: "Confirmed", tone: "success" },
  SCHEDULED: { label: "Scheduled", tone: "info" },
  IN_PROGRESS: { label: "In Progress", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "danger" },
};
const metaOf = (s) => STATUS_META[s] || { label: s ? s.replace(/_/g, " ") : "Pending", tone: "muted" };

const GROUPS = {
  confirmed: (s) => ["PENDING", "CONFIRMED", "ACCEPTED", "SCHEDULED"].includes(s),
  progress: (s) => s === "IN_PROGRESS",
  completed: (s) => s === "COMPLETED",
};

const bookingTimeOf = (b) => b?.pickupTime || b?.departureTime || b?.startTime || b?.travelTime || "";
const routeOf = (b) => {
  const r = bookingRoute(b);
  const route = b?.routeId;
  return {
    from: r.from !== "Pickup" ? r.from : placeName(route?.fromLocation) || r.from,
    to: r.to !== "Dropoff" ? r.to : placeName(route?.toLocation) || r.to,
  };
};

const contactSupport = () => Linking.openURL("mailto:support@drivemego.com");

export function B2CBookingsScreen() {
  const query = useQuery({
    queryKey: ["b2c-driver", "bookings"],
    queryFn: () => b2cDriverService.bookings(),
    refetchInterval: 60000,
  });
  const [tab, setTab] = useState("confirmed");
  const bookings = query.data?.data?.bookings || [];

  const counts = useMemo(() => {
    const c = { confirmed: 0, progress: 0, completed: 0 };
    bookings.forEach((b) => Object.keys(c).forEach((k) => GROUPS[k](statusOf(b)) && (c[k] += 1)));
    return c;
  }, [bookings]);

  const visible = useMemo(
    () => bookings.filter((b) => GROUPS[tab](statusOf(b))).sort((a, b) => new Date(bookingDate(b)) - new Date(bookingDate(a))),
    [bookings, tab],
  );

  return (
    <Screen header={<AppHeader />} tabBarSpace refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <DriverBanner liveHref={LIVE_HREF} />
      <DriverAvailabilityCard />
      <PageTitle title="My Bookings" subtitle="Passengers booked on your routes." />
      <View style={{ marginBottom: 14 }}>
        <SegmentTabs
          value={tab}
          onChange={setTab}
          items={[
            { key: "confirmed", label: "Confirmed", count: counts.confirmed },
            { key: "progress", label: "In Progress", count: counts.progress },
            { key: "completed", label: "Completed", count: counts.completed },
          ]}
        />
      </View>
      {query.isLoading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <EmptyState icon="calendar-outline" title="Nothing here" message="Bookings in this state will appear here." />
      ) : (
        <View style={{ gap: 14 }}>
          {visible.map((b) => {
            const { from, to } = routeOf(b);
            const meta = metaOf(statusOf(b));
            const count = b.numberOfSeats || b.seats || b.passengerCount || 1;
            return (
              <TripCard key={b._id}>
                <View style={styles.cardHead}>
                  <View style={styles.routeIcon}>
                    <Ionicons name="car" size={22} color={colors.success} />
                  </View>
                  <Text style={styles.route} numberOfLines={2}>
                    {`${from} \u2192 ${to}`}
                  </Text>
                  <StatusPill label={meta.label} tone={meta.tone} />
                </View>
                <View style={styles.metaRow}>
                  <MetaCell icon="calendar-outline" label="Date" value={shortDate(bookingDate(b))} />
                  <View style={styles.vDivider} />
                  <MetaCell icon="time-outline" label="Time" value={toTime12(bookingTimeOf(b))} />
                  <View style={styles.vDivider} />
                  <MetaCell icon="person-outline" label="Seats" value={String(count)} />
                </View>
                <View style={styles.passengerBox}>
                  <Text style={styles.boxLabel}>Passenger</Text>
                  <Text style={styles.passengerName}>{passengerName(b.passengerId ? { passengerId: b.passengerId } : b)}</Text>
                  <View style={styles.stopRow}>
                    <Text style={styles.stopChip}>{`Pickup: ${placeName(b.pickupLocation) || from}`}</Text>
                    <Text style={styles.stopChip}>{`Drop: ${placeName(b.dropoffLocation) || to}`}</Text>
                  </View>
                </View>
                {b.passengerId?.whatsappNumber ? (
                  <Text
                    style={styles.call}
                    onPress={() => Linking.openURL(`tel:${b.passengerId.countryCode || ""}${b.passengerId.whatsappNumber}`)}
                  >
                    Call passenger
                  </Text>
                ) : null}
              </TripCard>
            );
          })}
        </View>
      )}
      <View style={{ marginTop: 14 }}>
        <HelpStrip onPress={contactSupport} />
      </View>
    </Screen>
  );
}

export function B2CDailyTripsScreen() {
  const qc = useQueryClient();
  const { start: startSharing, stop: stopSharing, sharing } = useLocationSharing();
  const [filter, setFilter] = useState("today");
  const [busyId, setBusyId] = useState(null);

  const query = useQuery({
    queryKey: ["b2c-driver", "trips", filter],
    queryFn: () => b2cDriverService.trips(filter),
    refetchInterval: 45000,
  });
  const trips = query.data?.data?.trips || [];
  const stats = query.data?.data?.stats;

  const refresh = () => qc.invalidateQueries({ queryKey: ["b2c-driver"] });

  const startMutation = useMutation({
    mutationFn: (t) => b2cDriverService.startTrip(t._id),
    onMutate: (t) => setBusyId(t._id),
    onSuccess: async () => {
      await refresh();
      if (!sharing) await startSharing();
    },
    onError: (e) => Alert.alert("Could not start trip", e?.response?.data?.message || "Please try again."),
    onSettled: () => setBusyId(null),
  });

  const completeMutation = useMutation({
    mutationFn: (t) => b2cDriverService.completeTrip(t._id),
    onMutate: (t) => setBusyId(t._id),
    onSuccess: async (_d, t) => {
      await refresh();
      if (!trips.some((x) => x._id !== t._id && statusOf(x) === "IN_PROGRESS")) stopSharing();
    },
    onError: (e) => Alert.alert("Could not complete trip", e?.response?.data?.message || "Please try again."),
    onSettled: () => setBusyId(null),
  });

  const confirm = (title, body, action) =>
    Alert.alert(title, body, [{ text: "Cancel", style: "cancel" }, { text: "Confirm", onPress: action }]);

  return (
    <Screen header={<AppHeader />} tabBarSpace refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <DriverBanner liveHref={LIVE_HREF} />
      <DriverAvailabilityCard />
      <PageTitle title="Daily Trips" subtitle="Start and complete your assigned trips." />
      <View style={{ marginBottom: 14 }}>
        <SegmentTabs
          value={filter}
          onChange={setFilter}
          items={[
            { key: "today", label: "Today", count: stats?.todayTrips },
            { key: "upcoming", label: "Upcoming" },
            { key: "completed", label: "Completed" },
          ]}
        />
      </View>
      {query.isLoading ? (
        <Loading />
      ) : trips.length === 0 ? (
        <EmptyState icon="car-outline" title="No trips" message="Trips with accepted bookings will appear here." />
      ) : (
        <View style={{ gap: 14 }}>
          {trips.map((t) => {
            const s = statusOf(t);
            const meta = metaOf(s);
            const passengers = t.passengers || [];
            const busy = busyId === t._id;
            return (
              <TripCard key={t._id}>
                <View style={styles.cardHead}>
                  <View style={styles.routeIcon}>
                    <Ionicons name="car" size={22} color={colors.success} />
                  </View>
                  <Text style={styles.route} numberOfLines={2}>
                    {`${placeName(t.fromLocation) || t.routeId?.fromLocation || "Pickup"} \u2192 ${placeName(t.toLocation) || t.routeId?.toLocation || "Dropoff"}`}
                  </Text>
                  <StatusPill label={meta.label} tone={meta.tone} />
                </View>
                <View style={styles.metaRow}>
                  <MetaCell icon="calendar-outline" label="Date" value={longDate(t.tripDate)} />
                  <View style={styles.vDivider} />
                  <MetaCell icon="time-outline" label="Time" value={toTime12(t.startTime)} />
                  <View style={styles.vDivider} />
                  <MetaCell icon="person-outline" label="Riders" value={String(t.passengerCount ?? passengers.length)} />
                </View>
                {passengers.length > 0 ? (
                  <View style={styles.passengerBox}>
                    <Text style={styles.boxLabel}>Passengers</Text>
                    {passengers.map((p, i) => (
                      <Text key={p._id || i} style={styles.passengerName}>
                        {passengerName(p)}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {s === "SCHEDULED" ? (
                  <GradientAction
                    title="Start Trip"
                    loading={busy}
                    onPress={() => confirm("Start trip", "Live location sharing will begin.", () => startMutation.mutate(t))}
                  />
                ) : null}
                {s === "IN_PROGRESS" ? (
                  <GradientAction
                    title="Complete Trip"
                    icon="checkmark"
                    loading={busy}
                    onPress={() => confirm("Complete trip", "Mark this trip as completed?", () => completeMutation.mutate(t))}
                  />
                ) : null}
              </TripCard>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function Stars({ value, size = 16 }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={value >= n ? "star" : value >= n - 0.5 ? "star-half" : "star-outline"}
          size={size}
          color="#F5B400"
        />
      ))}
    </View>
  );
}

export function B2CRatingsScreen() {
  const query = useQuery({ queryKey: ["b2c-driver", "ratings"], queryFn: b2cDriverService.ratings });
  const data = query.data?.data;
  const ratings = data?.ratings || [];
  const total = data?.totalRatings || 0;
  const average = data?.averageRating || 0;
  const dist = useMemo(() => {
    const d = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach((r) => {
      const k = Math.round(r.rating);
      if (d[k] !== undefined) d[k] += 1;
    });
    return d;
  }, [ratings]);
  const max = Math.max(1, ...Object.values(dist));

  return (
    <Screen header={<AppHeader />} tabBarSpace refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <PageTitle title="My Ratings" subtitle="See what passengers say about your service" />
      {query.isLoading ? (
        <Loading />
      ) : (
        <View style={{ gap: 16 }}>
          <View style={styles.summary}>
            <View style={styles.summaryLeft}>
              <Text style={styles.avg}>{average.toFixed(1)}</Text>
              <Stars value={average} size={18} />
              <Text style={styles.metaLabel}>{`${total} total ratings`}</Text>
            </View>
            <View style={{ flex: 1, gap: 7 }}>
              {[5, 4, 3, 2, 1].map((n) => (
                <View key={n} style={styles.distRow}>
                  <Text style={styles.distLabel}>{`${n} star`}</Text>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${(dist[n] / max) * 100}%` }]} />
                  </View>
                  <Text style={styles.distCount}>{dist[n]}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={styles.sectionTitle}>Recent Reviews</Text>
          {ratings.length === 0 ? (
            <EmptyState icon="star-outline" title="No reviews yet" message="Passenger reviews will appear here after completed trips." />
          ) : (
            ratings.map((r) => (
              <View key={r._id} style={styles.review}>
                <View style={styles.reviewHead}>
                  <View style={styles.reviewAvatar}>
                    <Ionicons name="person" size={20} color={colors.tealDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.passengerName}>{r.passengerName || "Passenger"}</Text>
                    <Text style={styles.metaLabel}>{shortDate(r.ratedAt || r.tripDate)}</Text>
                  </View>
                  <Stars value={r.rating} size={13} />
                  <Text style={styles.reviewScore}>{Number(r.rating).toFixed(1)}</Text>
                </View>
                {r.routeName ? (
                  <View style={styles.reviewRoute}>
                    <Ionicons name="location" size={15} color={colors.danger} />
                    <Text style={styles.reviewRouteText} numberOfLines={1}>
                      {r.routeName}
                    </Text>
                  </View>
                ) : null}
                {r.feedback ? <Text style={styles.feedback}>{`\u201C${r.feedback}\u201D`}</Text> : null}
              </View>
            ))
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.successSoft, alignItems: "center", justifyContent: "center" },
  route: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.navy },
  metaRow: { flexDirection: "row", alignItems: "center", paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  vDivider: { width: 1, alignSelf: "stretch", backgroundColor: colors.border, marginHorizontal: 8 },
  metaLabel: { fontSize: 11, color: colors.muted },
  passengerBox: { padding: 12, borderRadius: radius.md, backgroundColor: colors.tealSoft, gap: 6 },
  boxLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, letterSpacing: 0.4 },
  passengerName: { fontSize: 14, fontWeight: "800", color: colors.navy },
  stopRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stopChip: { fontSize: 11, fontWeight: "700", color: colors.tealDark, backgroundColor: "#CDEFF3", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: "hidden" },
  call: { fontSize: 13, fontWeight: "800", color: colors.tealDark },
  summary: { flexDirection: "row", gap: 16, backgroundColor: "#fff", borderRadius: radius.xl, padding: 16, borderWidth: 1, borderColor: colors.border, ...shadow },
  summaryLeft: { alignItems: "center", justifyContent: "center", gap: 4, width: 120 },
  avg: { fontSize: 44, fontWeight: "800", color: colors.navy },
  distRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  distLabel: { width: 42, fontSize: 11, color: colors.muted },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#E8F0F5", overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: "#F5C451" },
  distCount: { width: 16, fontSize: 12, fontWeight: "700", color: colors.navy, textAlign: "right" },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: colors.navy, borderLeftWidth: 4, borderLeftColor: colors.teal, paddingLeft: 10 },
  review: { backgroundColor: "#fff", borderRadius: radius.xl, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border, ...shadow },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  reviewScore: { fontSize: 13, fontWeight: "800", color: colors.navy },
  reviewRoute: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.tealSoft },
  reviewRouteText: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.navy },
  feedback: { fontSize: 13, fontStyle: "italic", color: colors.navySoft, padding: 10, borderRadius: radius.md, backgroundColor: colors.tealTint },
});
