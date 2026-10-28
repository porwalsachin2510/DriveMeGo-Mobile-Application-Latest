import { useMemo, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Screen } from "./Screen";
import { AppHeader } from "./AppHeader";
import { EmptyState, Loading } from "./ui";
import {
  DriverBanner,
  GradientAction,
  HelpStrip,
  MetaCell,
  PageTitle,
  SegmentTabs,
  StatusPill,
  TripCard,
} from "./driver";
import { useAuth } from "../context/AuthContext";
import { useLocationSharing } from "../context/LocationContext";
import { managedDriverService } from "../services/driver";
import {
  bookingDate,
  bookingRoute,
  bookingTime,
  longDate,
  passengerCountOf,
  passengerName,
  shortDate,
  statusOf,
} from "../utils/driver";
import { segmentTerms } from "../utils/roles";
import { colors, radius } from "../theme";

const GROUPS = {
  confirmed: (s) => ["CONFIRMED", "ASSIGNED", "SCHEDULED", "UPCOMING", "ACTIVE"].includes(s),
  progress: (s) => s === "IN_PROGRESS",
  completed: (s) => s === "COMPLETED",
};

const STATUS_META = {
  CONFIRMED: { label: "Confirmed", tone: "success" },
  ASSIGNED: { label: "Confirmed", tone: "success" },
  SCHEDULED: { label: "Upcoming", tone: "info" },
  UPCOMING: { label: "Upcoming", tone: "info" },
  ACTIVE: { label: "Active", tone: "success" },
  IN_PROGRESS: { label: "In Progress", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

function PassengerBlock({ booking, corporate, terms }) {
  const list = booking.passengers || [];
  if (list.length === 0) return null;
  const first = list[0] || {};
  const school = terms.segment === "school";
  const label = school ? `${terms.passengers} to Pickup:` : "Passengers to Pickup:";
  return (
    <View style={styles.passengerBox}>
      <Text style={styles.boxLabel}>{corporate ? (school ? `${terms.passengers.toUpperCase()}:` : "PASSENGERS:") : label}</Text>
      {list.map((p, i) => (
        <View key={p._id || i} style={corporate ? styles.nameChip : undefined}>
          {corporate ? <Ionicons name="person-outline" size={14} color={colors.navy} /> : null}
          <Text style={corporate ? styles.nameChipText : styles.passengerName}>{passengerName(p)}</Text>
        </View>
      ))}
      {!corporate && (first.pickupStop || first.dropoffStop) ? (
        <View style={styles.stopRow}>
          {first.pickupStop ? <Text style={styles.stopChip}>{`Pickup: ${first.pickupStop}`}</Text> : null}
          {first.dropoffStop ? <Text style={styles.stopChip}>{`Drop: ${first.dropoffStop}`}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function BookingCard({ booking, corporate, terms, busyId, onStart, onComplete, onLive, expanded, onToggle }) {
  const status = statusOf(booking);
  const meta = STATUS_META[status] || { label: status || "Pending", tone: "muted" };
  const { from, to } = bookingRoute(booking);
  const inProgress = status === "IN_PROGRESS";
  const confirmed = GROUPS.confirmed(status);
  const busy = busyId === booking._id;
  const firstPassenger = booking.passengers?.[0];
  const pickup = firstPassenger?.pickupStop || from;
  const dropoff = firstPassenger?.dropoffStop || to;
  const showDetails = expanded || inProgress || corporate;

  return (
    <TripCard>
      <Pressable onPress={onToggle} style={styles.cardHead}>
        <View style={[styles.routeIcon, inProgress && { backgroundColor: colors.successSoft }]}>
          <Ionicons name={corporate ? "bus" : inProgress ? "person" : "git-compare-outline"} size={22} color={colors.success} />
        </View>
        <Text style={styles.route} numberOfLines={2}>
          {`${from} \u2192 ${to}`}
        </Text>
        <StatusPill label={meta.label} tone={meta.tone} />
        <Ionicons name={showDetails ? "chevron-down" : "chevron-forward"} size={16} color={colors.subtle} />
      </Pressable>

      <View style={styles.metaRow}>
        <MetaCell icon="calendar-outline" label="Date" value={corporate ? longDate(bookingDate(booking)) : shortDate(bookingDate(booking))} />
        <View style={styles.vDivider} />
        <MetaCell icon="time-outline" label="Time" value={bookingTime(booking)} />
        <View style={styles.vDivider} />
        <MetaCell icon="person-outline" label={terms.passengers === "Students" ? "Students" : "Passengers"} value={String(passengerCountOf(booking))} />
      </View>

      {showDetails ? (
        <>
          <PassengerBlock booking={booking} corporate={corporate} terms={terms} />
          {corporate ? (
            <View style={styles.pointsBox}>
              <View style={styles.point}>
                <Ionicons name="location" size={22} color={colors.teal} />
                <View>
                  <Text style={styles.pointLabel}>Pickup Point</Text>
                  <Text style={styles.pointValue}>{pickup}</Text>
                </View>
              </View>
              <View style={styles.point}>
                <Ionicons name="location" size={22} color={colors.teal} />
                <View>
                  <Text style={styles.pointLabel}>Dropoff Point</Text>
                  <Text style={styles.pointValue}>{dropoff}</Text>
                </View>
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      {confirmed ? (
        <View style={styles.actionRow}>
          <GradientAction
            title="Start Trip"
            loading={busy}
            onPress={() => onStart(booking)}
            style={{ flex: 1 }}
          />
          {corporate ? (
            <Pressable onPress={onLive} style={styles.liveLink}>
              <Ionicons name="location-outline" size={16} color={colors.tealDark} />
              <Text style={styles.liveLinkText}>Live Location</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {inProgress ? (
        <View style={styles.actionRow}>
          <GradientAction title="Complete Trip" icon="checkmark" loading={busy} onPress={() => onComplete(booking)} style={{ flex: 1 }} />
        </View>
      ) : null}

      {status === "COMPLETED" && corporate ? (
        <View style={styles.doneRow}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.doneTitle}>Trip Completed</Text>
            <Text style={styles.doneSub}>{longDate(booking.completedAt || bookingDate(booking))}</Text>
          </View>
        </View>
      ) : null}
    </TripCard>
  );
}

export function ManagedBookingsScreen({ kind, liveHref }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { userId, user } = useAuth();
  const terms = segmentTerms(user?.role);
  const { start: startSharing, stop: stopSharing, sharing } = useLocationSharing();
  const corporate = kind === "corporate";
  const [tab, setTab] = useState("confirmed");
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const query = useQuery({
    queryKey: ["driver", kind, "bookings", userId],
    queryFn: () => managedDriverService.bookings(kind, userId),
    enabled: !!userId,
    refetchInterval: 60000,
  });

  const bookings = query.data?.bookings || [];
  const counts = useMemo(() => {
    const c = { confirmed: 0, progress: 0, completed: 0 };
    bookings.forEach((b) => {
      const s = statusOf(b);
      Object.keys(c).forEach((k) => GROUPS[k](s) && (c[k] += 1));
    });
    return c;
  }, [bookings]);

  const visible = useMemo(
    () =>
      bookings
        .filter((b) => GROUPS[tab](statusOf(b)))
        .sort((a, b) => new Date(bookingDate(tab === "completed" ? b : a)) - new Date(bookingDate(tab === "completed" ? a : b))),
    [bookings, tab],
  );

  const refresh = () => qc.invalidateQueries({ queryKey: ["driver", kind] });

  const startMutation = useMutation({
    mutationFn: (b) => managedDriverService.startTrip(kind, b._id),
    onMutate: (b) => setBusyId(b._id),
    onSuccess: async () => {
      await refresh();
      if (!sharing) await startSharing();
      setTab("progress");
    },
    onError: (e) => Alert.alert("Could not start trip", e?.response?.data?.message || "Please try again."),
    onSettled: () => setBusyId(null),
  });

  const completeMutation = useMutation({
    mutationFn: (b) => managedDriverService.completeTrip(kind, b._id),
    onMutate: (b) => setBusyId(b._id),
    onSuccess: async (_d, b) => {
      await refresh();
      const stillRunning = bookings.some((x) => x._id !== b._id && statusOf(x) === "IN_PROGRESS");
      if (!stillRunning) stopSharing();
      setTab("completed");
    },
    onError: (e) => Alert.alert("Could not complete trip", e?.response?.data?.message || "Please try again."),
    onSettled: () => setBusyId(null),
  });

  const confirmStart = (b) =>
    Alert.alert("Start trip", `Start trip to ${bookingRoute(b).to}? Live location sharing will begin.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Start", onPress: () => startMutation.mutate(b) },
    ]);

  const confirmComplete = (b) =>
    Alert.alert("Complete trip", "Mark this trip as completed?", [
      { text: "Cancel", style: "cancel" },
      { text: "Complete", onPress: () => completeMutation.mutate(b) },
    ]);

  const tabs = corporate
    ? [
        { key: "confirmed", label: "Confirmed", count: counts.confirmed },
        { key: "progress", label: "In Progress", count: counts.progress },
        { key: "completed", label: "Completed", count: counts.completed },
      ]
    : [
        { key: "confirmed", label: "Confirmed Bookings", count: counts.confirmed },
        { key: "progress", label: "In Progress", count: counts.progress },
        { key: "completed", label: "Completed", count: counts.completed },
      ];

  const emptyMessage = {
    confirmed: "No confirmed bookings yet. New assignments will appear here.",
    progress: "No trips are in progress right now.",
    completed: "Completed trips will be listed here.",
  }[tab];

  return (
    <Screen header={<AppHeader />} tabBarSpace refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <DriverBanner liveHref={liveHref} />
      <View style={{ height: 6 }} />
      <PageTitle title="My Bookings" subtitle={corporate ? `Manage your scheduled ${terms.passenger.toLowerCase()} trips.` : undefined} />
      <View style={{ marginBottom: 14 }}>
        <SegmentTabs value={tab} onChange={setTab} items={tabs} />
      </View>

      {query.isLoading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <EmptyState icon="calendar-outline" title="Nothing here" message={emptyMessage} />
      ) : (
        <View style={{ gap: 14 }}>
          {visible.map((b) => (
            <BookingCard
              key={b._id}
              booking={b}
              corporate={corporate}
              terms={terms}
              busyId={busyId}
              expanded={expandedId === b._id}
              onToggle={() => setExpandedId(expandedId === b._id ? null : b._id)}
              onStart={confirmStart}
              onComplete={confirmComplete}
              onLive={() => router.push(liveHref)}
            />
          ))}
        </View>
      )}

      {corporate ? (
        <View style={{ marginTop: 14 }}>
          <HelpStrip onPress={() => Linking.openURL("mailto:support@drivemego.com")} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.successSoft, alignItems: "center", justifyContent: "center" },
  route: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.navy },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  vDivider: { width: 1, alignSelf: "stretch", backgroundColor: colors.border, marginHorizontal: 8 },
  passengerBox: { marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.tealSoft, gap: 6 },
  boxLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, letterSpacing: 0.4 },
  passengerName: { fontSize: 14, fontWeight: "800", color: colors.navy },
  nameChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  nameChipText: { fontSize: 13, fontWeight: "700", color: colors.navy },
  stopRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stopChip: { fontSize: 11, fontWeight: "700", color: colors.tealDark, backgroundColor: "#CDEFF3", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: "hidden" },
  pointsBox: { flexDirection: "row", marginTop: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.tealSoft, gap: 12 },
  point: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  pointLabel: { fontSize: 11, color: colors.muted },
  pointValue: { fontSize: 13, fontWeight: "800", color: colors.navy },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  liveLink: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4 },
  liveLinkText: { fontSize: 13, fontWeight: "700", color: colors.tealDark },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.successSoft },
  doneTitle: { fontSize: 13, fontWeight: "800", color: colors.success },
  doneSub: { fontSize: 11, color: colors.muted },
});
