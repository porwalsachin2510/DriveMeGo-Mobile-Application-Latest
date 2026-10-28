import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { Screen } from "./Screen";
import { AppHeader } from "./AppHeader";
import { Button, EmptyState, Field, Loading } from "./ui";
import { GradientAction, PageTitle, StatusPill, TripCard } from "./driver";
import { employeeService, sosService } from "../services/driver";
import { getErrorMessage } from "../api/client";
import { asDate, dateTimeLabel, longDate, placeName, statusOf, toTime12 } from "../utils/driver";
import { colors, radius } from "../theme";

const tripDateOf = (t) => t?.tripDate || t?.travelDate || t?.date;
const routeLabel = (t) => `${placeName(t?.fromLocation) || "Pickup"} \u2192 ${placeName(t?.toLocation) || "Dropoff"}`;

const useDashboard = () =>
  useQuery({ queryKey: ["employee", "dashboard"], queryFn: employeeService.dashboard });

const REQUEST_TONE = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", CANCELLED: "muted" };
const SOS_TONE = { ACTIVE: "danger", ACKNOWLEDGED: "warning", RESOLVED: "success", CANCELLED: "muted" };

function StarRow({ label, value, onChange }) {
  return (
    <View style={styles.starRow}>
      <Text style={styles.starLabel}>{label}</Text>
      <View style={styles.stars} accessibilityRole="adjustable" accessibilityLabel={`${label} rating`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityLabel={`${n} star`}>
            <Ionicons name={n <= value ? "star" : "star-outline"} size={24} color={n <= value ? colors.warning : colors.subtle} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TextArea({ label, value, onChangeText, placeholder, required }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.inputLabel}>
        {label}
        {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        multiline
        maxLength={1000}
        style={styles.textarea}
      />
    </View>
  );
}

/* ---------------- Rate trips ---------------- */

function RateForm({ trip, onDone }) {
  const qc = useQueryClient();
  const [ratings, setRatings] = useState({ rating: 0, driverRating: 0, punctualityRating: 0, cleanlinessRating: 0, safetyRating: 0 });
  const [feedback, setFeedback] = useState("");
  const set = (k) => (v) => setRatings((r) => ({ ...r, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => employeeService.rateTrip({ tripId: trip._id, ...ratings, feedback: feedback.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee", "dashboard"] });
      Alert.alert("Thank you", "Your feedback has been submitted.");
      onDone();
    },
    onError: (e) => Alert.alert("Could not submit", getErrorMessage(e)),
  });

  return (
    <View style={styles.formBox}>
      <StarRow label="Overall" value={ratings.rating} onChange={set("rating")} />
      <StarRow label="Driver" value={ratings.driverRating} onChange={set("driverRating")} />
      <StarRow label="Punctuality" value={ratings.punctualityRating} onChange={set("punctualityRating")} />
      <StarRow label="Cleanliness" value={ratings.cleanlinessRating} onChange={set("cleanlinessRating")} />
      <StarRow label="Safety" value={ratings.safetyRating} onChange={set("safetyRating")} />
      <TextArea label="Comments" value={feedback} onChangeText={setFeedback} placeholder="Tell us about your ride (optional)" />
      <Button title="Submit Rating" icon="send" loading={mutation.isPending} disabled={!ratings.rating} onPress={() => mutation.mutate()} />
    </View>
  );
}

export function PassengerFeedbackScreen() {
  const router = useRouter();
  const query = useDashboard();
  const [openId, setOpenId] = useState(null);
  const data = query.data?.data;

  const ratedIds = useMemo(
    () => new Set((data?.employee?.feedback?.feedbackHistory || data?.feedbackHistory || []).map((f) => String(f.tripId))),
    [data],
  );
  const completed = useMemo(
    () =>
      [...(data?.travelHistory || [])]
        .filter((t) => statusOf(t) === "COMPLETED" || !t.status)
        .sort((a, b) => asDate(tripDateOf(b)) - asDate(tripDateOf(a)))
        .slice(0, 20),
    [data],
  );

  return (
    <Screen header={<AppHeader onBack={() => router.back()} />} tabBarSpace refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <PageTitle title="Rate Your Trips" subtitle="Help us improve your daily commute" icon="star-outline" />
      {query.isLoading ? (
        <Loading />
      ) : completed.length === 0 ? (
        <EmptyState icon="star-outline" title="No completed trips" message="Trips you complete will appear here for rating." />
      ) : (
        <View style={{ gap: 14 }}>
          {completed.map((t) => {
            const id = String(t.tripId || t._id);
            const rated = ratedIds.has(id) || t.rated || t.feedbackGiven;
            const open = openId === id;
            return (
              <TripCard key={id}>
                <View style={styles.rowHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.route} numberOfLines={2}>
                      {routeLabel(t)}
                    </Text>
                    <Text style={styles.sub}>{`${longDate(tripDateOf(t))}  \u2022  ${toTime12(t.startTime)}`}</Text>
                  </View>
                  {rated ? (
                    <StatusPill label="RATED" tone="success" dot={false} />
                  ) : (
                    <Pressable onPress={() => setOpenId(open ? null : id)} style={styles.smallBtn}>
                      <Text style={styles.smallBtnText}>{open ? "Close" : "Rate"}</Text>
                    </Pressable>
                  )}
                </View>
                {open && !rated ? <RateForm trip={{ ...t, _id: id }} onDone={() => setOpenId(null)} /> : null}
              </TripCard>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

/* ---------------- Route change ---------------- */

export function PassengerRouteChangeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["employee", "route-changes"], queryFn: employeeService.routeChangeRequests });
  const [form, setForm] = useState({ reason: "", preferredRoute: "", newPickupPoint: "", newDropOffPoint: "" });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const requests = query.data?.data || [];

  const submit = useMutation({
    mutationFn: () => employeeService.requestRouteChange(form),
    onSuccess: () => {
      setForm({ reason: "", preferredRoute: "", newPickupPoint: "", newDropOffPoint: "" });
      qc.invalidateQueries({ queryKey: ["employee", "route-changes"] });
      Alert.alert("Request submitted", "Your transport coordinator will review it shortly.");
    },
    onError: (e) => Alert.alert("Could not submit", getErrorMessage(e)),
  });

  const withdraw = useMutation({
    mutationFn: employeeService.cancelRouteChange,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee", "route-changes"] }),
    onError: (e) => Alert.alert("Could not withdraw", getErrorMessage(e)),
  });

  return (
    <Screen header={<AppHeader onBack={() => router.back()} />} tabBarSpace refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <PageTitle title="Route Change" subtitle="Request a new route or pickup point" icon="git-compare-outline" />
      <TripCard>
        <Field label="Preferred Route" icon="map-outline" value={form.preferredRoute} onChangeText={set("preferredRoute")} placeholder="e.g. Marina \u2192 Business Bay" maxLength={200} />
        <Field label="New Pickup Point" icon="location-outline" value={form.newPickupPoint} onChangeText={set("newPickupPoint")} placeholder="New pickup location" maxLength={200} />
        <Field label="New Drop-off Point" icon="flag-outline" value={form.newDropOffPoint} onChangeText={set("newDropOffPoint")} placeholder="New drop-off location" maxLength={200} />
        <TextArea label="Reason for Change" required value={form.reason} onChangeText={set("reason")} placeholder="Explain why you need this change" />
        <Button title="Submit Request" icon="send" loading={submit.isPending} disabled={!form.reason.trim()} onPress={() => submit.mutate()} />
      </TripCard>

      <Text style={styles.section}>My Requests</Text>
      {query.isLoading ? (
        <Loading />
      ) : requests.length === 0 ? (
        <EmptyState icon="document-text-outline" title="No requests yet" message="Requests you submit will be tracked here." />
      ) : (
        <View style={{ gap: 12 }}>
          {requests.map((r) => (
            <TripCard key={r._id}>
              <View style={styles.rowHead}>
                <Text style={[styles.route, { flex: 1 }]} numberOfLines={2}>
                  {r.preferredRoute || r.newPickupPoint || "Route change"}
                </Text>
                <StatusPill label={r.status} tone={REQUEST_TONE[r.status] || "muted"} dot={false} />
              </View>
              <Text style={styles.body}>{r.reason}</Text>
              {r.newPickupPoint ? <Text style={styles.sub}>{`Pickup: ${r.newPickupPoint}`}</Text> : null}
              {r.newDropOffPoint ? <Text style={styles.sub}>{`Drop-off: ${r.newDropOffPoint}`}</Text> : null}
              {r.responseNote ? <Text style={styles.sub}>{`Response: ${r.responseNote}`}</Text> : null}
              <View style={styles.rowHead}>
                <Text style={[styles.sub, { flex: 1 }]}>{`Requested ${dateTimeLabel(r.requestedAt)}`}</Text>
                {r.status === "PENDING" ? (
                  <Pressable onPress={() => withdraw.mutate(r._id)} disabled={withdraw.isPending} style={styles.linkBtn}>
                    <Text style={styles.linkDanger}>Withdraw</Text>
                  </Pressable>
                ) : null}
              </View>
            </TripCard>
          ))}
        </View>
      )}
    </Screen>
  );
}

/* ---------------- SOS ---------------- */

const EMERGENCY_TYPES = [
  { key: "SOS", label: "Emergency", icon: "alert-circle" },
  { key: "MEDICAL", label: "Medical", icon: "medkit" },
  { key: "ACCIDENT", label: "Accident", icon: "car" },
  { key: "HARASSMENT", label: "Safety", icon: "shield" },
];

export function PassengerSOSScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [type, setType] = useState("SOS");
  const [message, setMessage] = useState("");
  const active = useQuery({ queryKey: ["sos", "active"], queryFn: sosService.myActive, refetchInterval: 15000 });
  const history = useQuery({ queryKey: ["sos", "mine"], queryFn: sosService.myAlerts });
  const tripQuery = useQuery({ queryKey: ["employee", "active-trip"], queryFn: () => employeeService.activeTrip() });
  const activeAlert = active.data?.data;
  const alerts = history.data?.data || [];
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["sos"] });
  };

  const raise = useMutation({
    mutationFn: async () => {
      let location;
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === "granted") {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        }
      } catch {
        location = undefined;
      }
      const trip = tripQuery.data?.data;
      return sosService.raise({ emergencyType: type, message: message.trim(), location, tripId: trip?._id || trip?.tripId });
    },
    onSuccess: () => {
      setMessage("");
      refresh();
      Alert.alert("SOS sent", "Your alert was sent to the operations team. Help is on the way.");
    },
    onError: (e) => Alert.alert("SOS failed", getErrorMessage(e, "Could not send alert. Call emergency services directly.")),
  });

  const cancel = useMutation({
    mutationFn: sosService.cancel,
    onSuccess: refresh,
    onError: (e) => Alert.alert("Could not cancel", getErrorMessage(e)),
  });

  const confirmRaise = () =>
    Alert.alert("Send SOS alert?", "Your location will be shared with the operations team.", [
      { text: "Cancel", style: "cancel" },
      { text: "Send SOS", style: "destructive", onPress: () => raise.mutate() },
    ]);

  return (
    <Screen header={<AppHeader onBack={() => router.back()} />} tabBarSpace refreshing={active.isRefetching} onRefresh={refresh}>
      <PageTitle title="Emergency SOS" subtitle="Get immediate help during your trip" icon="warning-outline" />
      {active.isLoading ? (
        <Loading />
      ) : activeAlert ? (
        <TripCard style={{ borderColor: colors.danger }}>
          <View style={styles.rowHead}>
            <Ionicons name="radio" size={22} color={colors.danger} />
            <Text style={[styles.route, { flex: 1 }]}>Alert in progress</Text>
            <StatusPill label={activeAlert.status} tone={SOS_TONE[activeAlert.status] || "danger"} />
          </View>
          <Text style={styles.body}>{`Raised ${dateTimeLabel(activeAlert.createdAt)}. The operations team has been notified.`}</Text>
          <Button title="Cancel Alert (False Alarm)" variant="outline" icon="close" loading={cancel.isPending} onPress={() => cancel.mutate(activeAlert._id)} />
        </TripCard>
      ) : (
        <TripCard>
          <Text style={styles.inputLabel}>Emergency Type</Text>
          <View style={styles.typeGrid}>
            {EMERGENCY_TYPES.map((t) => {
              const on = type === t.key;
              return (
                <Pressable key={t.key} onPress={() => setType(t.key)} style={[styles.typeItem, on && styles.typeOn]} accessibilityState={{ selected: on }}>
                  <Ionicons name={t.icon} size={20} color={on ? colors.danger : colors.muted} />
                  <Text style={[styles.typeText, on && { color: colors.danger }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextArea label="Details" value={message} onChangeText={setMessage} placeholder="Describe the situation (optional)" />
          <GradientAction danger title="Send SOS Alert" icon="alert" loading={raise.isPending} onPress={confirmRaise} />
        </TripCard>
      )}

      <Text style={styles.section}>Alert History</Text>
      {history.isLoading ? (
        <Loading />
      ) : alerts.length === 0 ? (
        <EmptyState icon="shield-checkmark-outline" title="No alerts" message="You haven't raised any SOS alerts." />
      ) : (
        <View style={{ gap: 12 }}>
          {alerts.slice(0, 15).map((a) => (
            <TripCard key={a._id}>
              <View style={styles.rowHead}>
                <Text style={[styles.route, { flex: 1 }]}>{String(a.emergencyType || "SOS").replace(/_/g, " ")}</Text>
                <StatusPill label={a.status} tone={SOS_TONE[a.status] || "muted"} dot={false} />
              </View>
              {a.message ? <Text style={styles.body}>{a.message}</Text> : null}
              <Text style={styles.sub}>{dateTimeLabel(a.createdAt)}</Text>
            </TripCard>
          ))}
        </View>
      )}
    </Screen>
  );
}

/* ---------------- Quick actions (used on Transport screen) ---------------- */

export function PassengerQuickActions({ basePath }) {
  const router = useRouter();
  const qc = useQueryClient();
  const notTraveling = useMutation({
    mutationFn: () => employeeService.notTravelingToday("Not traveling today"),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["employee"] });
      Alert.alert("Updated", res?.message || "Your driver has been informed you are not traveling today.");
    },
    onError: (e) => Alert.alert("Could not update", getErrorMessage(e)),
  });

  const confirmNotTraveling = () =>
    Alert.alert("Not traveling today?", "You will be removed from today's trips and the driver will be notified.", [
      { text: "Keep my seat", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: () => notTraveling.mutate() },
    ]);

  const items = [
    { icon: "close-circle-outline", label: notTraveling.isPending ? "Updating..." : "Not Traveling Today", onPress: confirmNotTraveling, tone: colors.warning },
    { icon: "star-outline", label: "Rate Trips", onPress: () => router.push(`${basePath}/feedback`), tone: colors.tealDark },
    { icon: "git-compare-outline", label: "Route Change", onPress: () => router.push(`${basePath}/route-change`), tone: colors.info },
    { icon: "warning-outline", label: "Emergency SOS", onPress: () => router.push(`${basePath}/sos`), tone: colors.danger },
    { icon: "document-text-outline", label: "No-Show History", onPress: () => router.push(`${basePath}/no-shows`), tone: colors.navy },
  ];

  return (
    <View style={styles.quickGrid}>
      {items.map((it) => (
        <Pressable key={it.label} onPress={it.onPress} style={styles.quickItem} accessibilityRole="button">
          <Ionicons name={it.icon} size={22} color={it.tone} />
          <Text style={styles.quickText}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function CancelTripButton({ trip }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => employeeService.cancelTrip(trip._id, "Cancelled by passenger"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee"] });
      Alert.alert("Seat released", "You have been removed from this trip.");
    },
    onError: (e) => Alert.alert("Could not cancel", getErrorMessage(e)),
  });
  const status = statusOf(trip);
  if (["COMPLETED", "CANCELLED", "IN_PROGRESS", "ACTIVE"].includes(status)) return null;
  return (
    <Pressable
      disabled={mutation.isPending}
      onPress={() =>
        Alert.alert("Cancel this trip?", "Your seat will be released for this trip only.", [
          { text: "No", style: "cancel" },
          { text: "Cancel Trip", style: "destructive", onPress: () => mutation.mutate() },
        ])
      }
      style={styles.linkBtn}
    >
      <Text style={styles.linkDanger}>{mutation.isPending ? "Cancelling..." : "Cancel my seat"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  route: { fontSize: 15, fontWeight: "800", color: colors.navy },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  body: { fontSize: 13, color: colors.text, lineHeight: 19 },
  section: { fontSize: 17, fontWeight: "800", color: colors.navy, marginTop: 22, marginBottom: 10 },
  smallBtn: { backgroundColor: colors.teal, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill },
  smallBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  formBox: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 4 },
  starRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  starLabel: { fontSize: 14, fontWeight: "700", color: colors.navy },
  stars: { flexDirection: "row", gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: "700", color: colors.navy, marginBottom: 8 },
  textarea: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.tealTint,
    textAlignVertical: "top",
  },
  linkBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  linkDanger: { color: colors.danger, fontWeight: "800", fontSize: 13 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  typeItem: {
    flexBasis: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  typeOn: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  typeText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  quickItem: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  quickText: { fontSize: 13, fontWeight: "800", color: colors.navy },
});
