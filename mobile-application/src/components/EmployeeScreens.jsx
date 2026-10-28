import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Screen } from "./Screen";
import { AppHeader } from "./AppHeader";
import { LiveMap } from "./LiveMap";
import { EmptyState, Loading } from "./ui";
import { HelpStrip, MetaCell, PageTitle, StatusPill, TripCard } from "./driver";
import { employeeService } from "../services/driver";
import { CancelTripButton, PassengerQuickActions } from "./PassengerActionScreens";
import { useAuth } from "../context/AuthContext";
import { rolePath, segmentTerms } from "../utils/roles";
import { asDate, clock, longDate, placeName, statusOf, toTime12 } from "../utils/driver";
import { colors, radius, shadow } from "../theme";

const PAGE_SIZE = 5;

const STATUS_META = {
  ACTIVE: { label: "Active", tone: "success" },
  SCHEDULED: { label: "Confirmed", tone: "success" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  UPCOMING: { label: "Confirmed", tone: "success" },
  IN_PROGRESS: { label: "In Progress", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

const metaOf = (s) => STATUS_META[s] || { label: s ? s.replace(/_/g, " ") : "Pending", tone: "muted" };

const tripDateOf = (t) => t?.tripDate || t?.travelDate || t?.date;
const tripFrom = (t) => placeName(t?.fromLocation) || "Pickup";
const tripTo = (t) => placeName(t?.toLocation) || "Dropoff";
const pickupOf = (t) => t?.pickupStop || t?.pickupPoint || tripFrom(t);
const dropoffOf = (t) => t?.dropoffStop || t?.dropOffPoint || tripTo(t);
const vehicleOf = (t) => [t?.vehicleName, t?.vehicleNumber && `(${t.vehicleNumber})`].filter((x) => x && x !== "Not assigned").join(" ") || "Not assigned";
const driverOf = (t) => t?.driverName || t?.driver?.name || "To be assigned";
const timeRange = (t) => (t?.endTime ? `${toTime12(t.startTime)} - ${toTime12(t.endTime)}` : toTime12(t?.startTime));

const uniqueTrips = (...lists) => {
  const seen = new Set();
  return lists
    .flat()
    .filter(Boolean)
    .filter((t) => {
      const key = String(t._id || `${tripDateOf(t)}-${t.startTime}-${tripFrom(t)}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const useDashboard = () =>
  useQuery({
    queryKey: ["employee", "dashboard"],
    queryFn: employeeService.dashboard,
    refetchInterval: 60000,
  });

const contactCoordinator = () => Linking.openURL("mailto:support@drivemego.com");

function Pager({ page, pages, total, onChange }) {
  if (pages <= 1) return null;
  return (
    <View style={styles.pager}>
      <Pressable disabled={page === 0} onPress={() => onChange(page - 1)} style={[styles.pagerBtn, page === 0 && styles.pagerOff]}>
        <Text style={[styles.pagerText, page === 0 && { color: colors.subtle }]}>Previous</Text>
      </Pressable>
      <Text style={styles.pagerInfo}>{`Page ${page + 1} of ${pages} (${total} trips)`}</Text>
      <Pressable
        disabled={page >= pages - 1}
        onPress={() => onChange(page + 1)}
        style={[styles.pagerBtn, styles.pagerNext, page >= pages - 1 && styles.pagerOff]}
      >
        <Text style={[styles.pagerText, { color: "#fff" }, page >= pages - 1 && { color: colors.subtle }]}>Next</Text>
      </Pressable>
    </View>
  );
}

function PointRow({ pickup, dropoff }) {
  return (
    <View style={styles.pointsBox}>
      <View style={styles.point}>
        <Ionicons name="location" size={20} color={colors.teal} />
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.pointLabel}>Pickup Point</Text>
          <Text style={styles.pointValue} numberOfLines={1}>
            {pickup}
          </Text>
        </View>
      </View>
      <View style={styles.point}>
        <Ionicons name="location" size={20} color={colors.teal} />
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.pointLabel}>Dropoff Point</Text>
          <Text style={styles.pointValue} numberOfLines={1}>
            {dropoff}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Detail({ icon, label, value }) {
  return <MetaCell icon={icon} label={label} value={value} />;
}

function ScheduledTripCard({ trip, onTrack }) {
  const status = statusOf(trip);
  const meta = metaOf(status);
  return (
    <TripCard>
      <View style={styles.cardHead}>
        <View style={styles.routeIcon}>
          <Ionicons name="bus" size={22} color={colors.tealDark} />
        </View>
        <Text style={styles.route} numberOfLines={2}>
          {`${tripFrom(trip)} \u2192 ${tripTo(trip)}`}
        </Text>
        <StatusPill label={meta.label} tone={meta.tone} dot={false} />
      </View>
      <View style={styles.metaRow}>
        <View style={{ flex: 1, gap: 10 }}>
          <Detail icon="calendar-outline" label="Date" value={longDate(tripDateOf(trip))} />
          <Detail icon="time-outline" label="Time" value={timeRange(trip)} />
        </View>
        <View style={styles.vDivider} />
        <View style={{ flex: 1, gap: 10 }}>
          <Detail icon="bus-outline" label="Vehicle" value={vehicleOf(trip)} />
          <Detail icon="person-outline" label="Driver" value={driverOf(trip)} />
        </View>
      </View>
      <View style={styles.footRow}>
        <Ionicons name="location" size={14} color={colors.teal} />
        <Text style={styles.footText} numberOfLines={1}>
          {`Pickup: ${pickupOf(trip)}  \u2192  Dropoff: ${dropoffOf(trip)}`}
        </Text>
        <Pressable onPress={onTrack} style={styles.trackBtn}>
          <Ionicons name="navigate-outline" size={14} color="#fff" />
          <Text style={styles.trackText}>Track Driver</Text>
        </Pressable>
      </View>
    </TripCard>
  );
}

export function EmployeeTripsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const terms = segmentTerms(user?.role);
  const query = useDashboard();
  const [page, setPage] = useState(0);
  const data = query.data?.data;

  const trips = useMemo(
    () =>
      uniqueTrips(data?.todayTrips || [], data?.upcomingTrips || []).sort(
        (a, b) => asDate(tripDateOf(a)) - asDate(tripDateOf(b)),
      ),
    [data],
  );
  const pages = Math.max(1, Math.ceil(trips.length / PAGE_SIZE));
  const visible = trips.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <Screen header={<AppHeader />} tabBarSpace refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <PageTitle title="My Scheduled Trips" subtitle="View your past and upcoming trips" />
      <View style={styles.info}>
        <Ionicons name="information-circle" size={22} color={colors.teal} />
        <Text style={styles.infoText}>
          {`These trips have been scheduled by ${terms.scheduledBy}. You are automatically booked on these trips.`}
        </Text>
      </View>
      {query.isLoading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <EmptyState icon="calendar-outline" title="No scheduled trips" message={`Trips scheduled by ${terms.scheduledBy} will appear here.`} />
      ) : (
        <View style={{ gap: 14 }}>
          {visible.map((t) => (
            <ScheduledTripCard key={t._id} trip={t} onTrack={() => router.push(rolePath(user?.role, "live"))} />
          ))}
          <Pager page={page} pages={pages} total={trips.length} onChange={setPage} />
        </View>
      )}
    </Screen>
  );
}

export function EmployeeHistoryScreen() {
  const query = useDashboard();
  const { user } = useAuth();
  const terms = segmentTerms(user?.role);
  const [page, setPage] = useState(0);
  const history = useMemo(
    () => [...(query.data?.data?.travelHistory || [])].sort((a, b) => asDate(tripDateOf(b)) - asDate(tripDateOf(a))),
    [query.data],
  );
  const pages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const visible = history.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <Screen header={<AppHeader />} tabBarSpace refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <PageTitle title="Trip History" subtitle={`Review your completed ${terms.segment} trips`} />
      {query.isLoading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <EmptyState icon="time-outline" title="No trip history" message="Your completed trips will be listed here." />
      ) : (
        <View style={{ gap: 14 }}>
          {visible.map((t) => {
            const meta = metaOf(statusOf(t));
            return (
              <TripCard key={t._id}>
                <View style={styles.cardHead}>
                  <View style={styles.routeIcon}>
                    <Ionicons name="bus" size={22} color={colors.tealDark} />
                  </View>
                  <Text style={styles.route} numberOfLines={2}>
                    {`${tripFrom(t)} \u2192 ${tripTo(t)}`}
                  </Text>
                  <StatusPill label={meta.label} tone={meta.tone} />
                </View>
                <View style={styles.metaRow}>
                  <Detail icon="calendar-outline" label="Date" value={longDate(tripDateOf(t))} />
                  <View style={styles.vDivider} />
                  <Detail icon="time-outline" label="Time" value={toTime12(t.startTime)} />
                </View>
                <View style={styles.listRows}>
                  <ListRow icon="swap-horizontal-outline" label="Direction" value={t.direction ? String(t.direction).replace(/_/g, " ") : `To ${tripTo(t)}`} />
                  <ListRow icon="bus-outline" label="Vehicle" value={vehicleOf(t)} />
                  <ListRow icon="person-outline" label="Driver" value={driverOf(t)} />
                </View>
                <PointRow pickup={pickupOf(t)} dropoff={dropoffOf(t)} />
              </TripCard>
            );
          })}
          <Pager page={page} pages={pages} total={history.length} onChange={setPage} />
        </View>
      )}
    </Screen>
  );
}

function ListRow({ icon, label, value }) {
  return (
    <View style={styles.listRow}>
      <Ionicons name={icon} size={20} color={colors.tealDark} />
      <View style={{ flex: 1 }}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.listValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function EmployeeTransportScreen() {
  const router = useRouter();
  const query = useDashboard();
  const data = query.data?.data;
  const [openId, setOpenId] = useState(null);
  const { user } = useAuth();
  const terms = segmentTerms(user?.role);
  const company = data?.company?.companyName || data?.company?.businessName || data?.company?.fullName || terms.organisation;

  const trips = useMemo(
    () =>
      uniqueTrips(data?.todayTrips || [], data?.upcomingTrips || [])
        .sort((a, b) => asDate(tripDateOf(a)) - asDate(tripDateOf(b)))
        .slice(0, 8),
    [data],
  );

  return (
    <Screen header={<AppHeader onBack={() => router.back()} />} tabBarSpace refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <PageTitle title="Transport Info" subtitle="View your transport details and trip information" />
      <PassengerQuickActions basePath={rolePath(user?.role, "").replace(/\/$/, "")} />
      {query.isLoading ? (
        <Loading />
      ) : trips.length === 0 ? (
        <EmptyState icon="bus-outline" title="No transport assigned" message="Your transport details will appear once trips are scheduled." />
      ) : (
        <View style={{ gap: 14 }}>
          {trips.map((t, i) => {
            const meta = metaOf(statusOf(t));
            const expanded = openId === t._id || (openId === null && i === 0);
            return (
              <TripCard key={t._id}>
                <Pressable onPress={() => setOpenId(expanded ? "" : t._id)} style={styles.cardHead}>
                  <View style={styles.routeIcon}>
                    <Ionicons name="bus" size={22} color={colors.tealDark} />
                  </View>
                  <Text style={styles.route} numberOfLines={2}>
                    {`${tripFrom(t)} \u2192 ${tripTo(t)}`}
                  </Text>
                  <StatusPill label={meta.label} tone={meta.tone} dot={false} />
                  <Ionicons name={expanded ? "chevron-down" : "chevron-forward"} size={16} color={colors.subtle} />
                </Pressable>
                <View style={styles.metaRow}>
                  <View style={{ flex: 1, gap: 10 }}>
                    <Detail icon="calendar-outline" label="Date" value={longDate(tripDateOf(t))} />
                    <Detail icon="time-outline" label="Departure" value={toTime12(t.startTime)} />
                  </View>
                  <View style={styles.vDivider} />
                  <View style={{ flex: 1, gap: 10 }}>
                    <Detail icon="bus-outline" label="Vehicle" value={vehicleOf(t)} />
                    <Detail icon="person-outline" label="Driver" value={driverOf(t)} />
                  </View>
                </View>
                {expanded ? (
                  <>
                    <PointRow pickup={pickupOf(t)} dropoff={dropoffOf(t)} />
                    <View style={styles.payBox}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Payment Information</Text>
                        <Text style={styles.listValue}>{`${company} Paid`}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: "flex-end" }}>
                        <Text style={styles.metaLabel}>Payment Status</Text>
                        <StatusPill label="PAID" tone="success" dot={false} />
                      </View>
                    </View>
                    <CancelTripButton trip={t} />
                  </>
                ) : null}
              </TripCard>
            );
          })}
          <HelpStrip title="Need help or have a change in your travel?" subtitle="Contact your transport coordinator." onPress={contactCoordinator} />
        </View>
      )}
    </Screen>
  );
}

export function EmployeeLiveScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const terms = segmentTerms(user?.role);
  const query = useQuery({
    queryKey: ["employee", "active-trip"],
    queryFn: () => employeeService.activeTrip(),
    refetchInterval: 8000,
  });
  const trip = query.data?.data?.trip;
  const loc = trip?.driverLocation;
  const hasLoc = loc && loc.lat != null && loc.lng != null;
  const sharing = !!trip?.isSharingLocation;
  const driverName = trip?.driver?.name || "Driver";
  const route = trip ? `${placeName(trip.fromLocation)} \u2192 ${placeName(trip.toLocation)}` : "";

  return (
    <Screen header={<AppHeader onBack={() => router.back()} />} tabBarSpace refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <PageTitle title="Live Location Tracking" subtitle="Track your assigned driver in real time." />
      {query.isLoading ? (
        <Loading />
      ) : !trip ? (
        <EmptyState icon="navigate-outline" title="No active trip" message="Live tracking is available when you have a trip scheduled for today." />
      ) : (
        <View style={{ gap: 14 }}>
          <View style={styles.card}>
            <View style={styles.driverRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{driverName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{driverName}</Text>
                <Text style={styles.driverRole}>{terms.driverLabel}</Text>
                <Text style={styles.metaLabel}>
                  {trip.lastPingAt ? `Last update: ${clock(trip.lastPingAt)}` : "Awaiting location"}
                </Text>
              </View>
              <StatusPill label={sharing ? "Sharing Live Location" : "Location Off"} tone={sharing ? "success" : "muted"} />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.summaryRow}>
              <Detail icon="git-network-outline" label="Route" value={route} />
            </View>
            <View style={[styles.summaryRow, { marginTop: 10 }]}>
              <Detail icon="bus-outline" label="Vehicle" value={trip.vehicle ? `${trip.vehicle.name || ""} ${trip.vehicle.plate ? `(${trip.vehicle.plate})` : ""}`.trim() : "Not assigned"} />
              <View style={styles.vDivider} />
              <Detail
                icon="speedometer-outline"
                label="ETA"
                value={trip.etaMinutes != null ? `${trip.etaMinutes} min` : "--"}
              />
            </View>
          </View>

          {hasLoc ? (
            <View>
              <LiveMap marker={{ latitude: loc.lat, longitude: loc.lng }} label={driverName} vehicle height={300} />
              <View style={styles.liveBadge}>
                <Ionicons name="radio" size={12} color="#fff" />
                <Text style={styles.liveBadgeText}>LIVE TRACKING</Text>
              </View>
            </View>
          ) : (
            <EmptyState icon="location-outline" title="Driver location unavailable" message="The map will appear as soon as your driver starts sharing location." />
          )}

          <View style={styles.card}>
            <Text style={styles.metaLabel}>Trip Details</Text>
            <View style={{ marginVertical: 6 }}>
              <StatusPill label={String(trip.status || "").replace(/_/g, " ")} tone="teal" dot={false} />
            </View>
            <Text style={styles.listValue}>{route}</Text>
            <View style={[styles.metaRow, { marginTop: 10 }]}>
              <Detail icon="location" label="Pickup" value={trip.pickupStop || placeName(trip.fromLocation)} />
              <View style={styles.vDivider} />
              <Detail icon="flag" label="Drop-off" value={trip.dropoffStop || placeName(trip.toLocation)} />
            </View>
            {trip.driver?.phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${trip.driver.phone}`)} style={styles.callBtn}>
                <Ionicons name="call" size={16} color="#fff" />
                <Text style={styles.callText}>Call Driver</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  info: { flexDirection: "row", gap: 10, alignItems: "center", padding: 12, borderRadius: radius.lg, backgroundColor: colors.tealSoft, borderWidth: 1, borderColor: "#CFEFF3", marginBottom: 14 },
  infoText: { flex: 1, fontSize: 12.5, color: colors.navySoft, lineHeight: 18 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  route: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.navy },
  metaRow: { flexDirection: "row", alignItems: "center", paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  vDivider: { width: 1, alignSelf: "stretch", backgroundColor: colors.border, marginHorizontal: 10 },
  metaLabel: { fontSize: 11, color: colors.muted },
  footRow: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: radius.md, backgroundColor: colors.tealSoft },
  footText: { flex: 1, fontSize: 11, fontWeight: "700", color: colors.navy },
  trackBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.tealDark, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.md },
  trackText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  pagerBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.tealSoft },
  pagerNext: { backgroundColor: colors.tealDark },
  pagerOff: { backgroundColor: "#EEF2F6" },
  pagerText: { fontSize: 13, fontWeight: "800", color: colors.tealDark },
  pagerInfo: { fontSize: 11, color: colors.muted, flex: 1, textAlign: "center" },
  pointsBox: { flexDirection: "row", padding: 12, borderRadius: radius.md, backgroundColor: colors.tealSoft, gap: 12 },
  point: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  pointLabel: { fontSize: 11, color: colors.muted },
  pointValue: { fontSize: 13, fontWeight: "800", color: colors.navy },
  listRows: { gap: 2 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  listValue: { fontSize: 14, fontWeight: "800", color: colors.navy, marginTop: 1 },
  payBox: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: radius.md, backgroundColor: colors.tealSoft },
  card: { backgroundColor: "#fff", borderRadius: radius.xl, padding: 14, borderWidth: 1, borderColor: colors.border, ...shadow },
  driverRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  driverName: { fontSize: 16, fontWeight: "800", color: colors.navy },
  driverRole: { fontSize: 13, fontWeight: "700", color: colors.tealDark },
  summaryRow: { flexDirection: "row", alignItems: "center" },
  liveBadge: { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.success, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  liveBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  callBtn: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.tealDark, paddingVertical: 12, borderRadius: radius.lg },
  callText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
