import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SubScreen } from "./SubScreen";
import { Button, EmptyState, Loading } from "./ui";
import { noShowService } from "../services/driver";
import { getErrorMessage } from "../api/client";
import { longDate, placeName, toTime12 } from "../utils/driver";
import { colors, radius } from "../theme";

const REASONS = ["Sick Leave", "Personal Emergency", "Work From Home", "Meeting Conflict", "Transportation Issue", "Other"];
const STATUS_TONE = {
  REPORTED: { fg: colors.warning, bg: colors.warningSoft },
  VERIFIED: { fg: colors.success, bg: colors.successSoft },
  DISPUTED: { fg: colors.danger, bg: "#FDECEC" },
  RESOLVED: { fg: colors.tealDark, bg: colors.tealSoft },
};

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ReportForm() {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () => noShowService.notTraveling({ reason: reason === "Other" && notes.trim() ? notes.trim() : reason, notes: notes.trim() }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["employee"] });
      qc.invalidateQueries({ queryKey: ["no-shows"] });
      setReason("");
      setNotes("");
      Alert.alert("Updated", res?.message || "Your driver has been informed you are not traveling today.");
    },
    onError: (e) => Alert.alert("Could not update", getErrorMessage(e)),
  });

  const submit = () =>
    Alert.alert("Not traveling today?", "You will be removed from today's trips and the driver will be notified.", [
      { text: "Keep my seat", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: () => mutation.mutate() },
    ]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Not traveling today?</Text>
      <Text style={styles.muted}>Let your driver know in advance so the route can be adjusted.</Text>
      <View style={styles.reasons} accessibilityRole="radiogroup">
        {REASONS.map((r) => {
          const active = r === reason;
          return (
            <Pressable
              key={r}
              onPress={() => setReason(r)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={[styles.reason, active && styles.reasonActive]}
            >
              <Text style={[styles.reasonText, active && { color: "#fff" }]}>{r}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder={reason === "Other" ? "Please describe your reason" : "Additional notes (optional)"}
        placeholderTextColor={colors.subtle}
        multiline
        maxLength={500}
        style={styles.textarea}
        accessibilityLabel="Notes"
      />
      <Button
        title="Inform Driver"
        icon="send"
        loading={mutation.isPending}
        disabled={!reason || (reason === "Other" && !notes.trim())}
        onPress={submit}
      />
    </View>
  );
}

function NoShowItem({ item }) {
  const status = String(item.status || "REPORTED").toUpperCase();
  const tone = STATUS_TONE[status] || STATUS_TONE.REPORTED;
  const trip = item.tripId || {};
  return (
    <View style={styles.item}>
      <View style={styles.itemHead}>
        <Ionicons name="calendar-outline" size={16} color={colors.tealDark} />
        <Text style={styles.itemDate}>{longDate(item.date || trip.tripDate)}</Text>
        <View style={[styles.pill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.pillText, { color: tone.fg }]}>{status}</Text>
        </View>
      </View>
      {trip.fromLocation || trip.toLocation ? (
        <Text style={styles.route} numberOfLines={1}>
          {`${placeName(trip.fromLocation) || "Pickup"} \u2192 ${placeName(trip.toLocation) || "Dropoff"}`}
          {trip.startTime ? `  \u00B7  ${toTime12(trip.startTime)}` : ""}
        </Text>
      ) : null}
      <Text style={styles.muted}>{`Reason: ${item.customReason || item.reason || "Not specified"}`}</Text>
    </View>
  );
}

export function NoShowScreen() {
  const query = useQuery({ queryKey: ["no-shows", "mine"], queryFn: () => noShowService.mine({ limit: 50 }) });
  const data = query.data?.data || query.data || {};
  const list = data.noShows || [];
  const stats = data.statistics || {};

  return (
    <SubScreen
      eyebrow="Attendance"
      title="Not Traveling & No-Shows"
      subtitle="Inform your driver and review your no-show history."
      icon="close-circle-outline"
      refreshing={query.isRefetching}
      onRefresh={query.refetch}
      keyboard
    >
      <ReportForm />
      <View style={styles.stats}>
        <Stat label="Total" value={stats.totalNoShows ?? list.length} />
        <Stat label="This Month" value={stats.thisMonth} />
        <Stat label="Recurring" value={stats.recurringNoShows} />
      </View>
      <Text style={styles.section}>History</Text>
      {query.isLoading ? (
        <Loading label="Loading history..." />
      ) : query.isError ? (
        <EmptyState icon="alert-circle-outline" title="Could not load" message={getErrorMessage(query.error)} />
      ) : list.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" title="No records" message="You have no no-show records." />
      ) : (
        list.map((n) => <NoShowItem key={n._id} item={n} />)
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: radius.xl, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.navy },
  muted: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reason: { paddingHorizontal: 12, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.tealTint, justifyContent: "center" },
  reasonActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  reasonText: { fontSize: 12, fontWeight: "700", color: colors.navy },
  textarea: { minHeight: 70, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 14, color: colors.navy, textAlignVertical: "top", backgroundColor: "#fff" },
  stats: { flexDirection: "row", gap: 10, marginBottom: 14 },
  stat: { flex: 1, backgroundColor: colors.tealSoft, borderRadius: radius.lg, paddingVertical: 12, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.navy },
  statLabel: { fontSize: 11, color: colors.muted, fontWeight: "700", marginTop: 2 },
  section: { fontSize: 15, fontWeight: "800", color: colors.navy, marginBottom: 10 },
  item: { backgroundColor: "#fff", borderRadius: radius.lg, padding: 14, gap: 6, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  itemHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemDate: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.navy },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  pillText: { fontSize: 11, fontWeight: "800" },
  route: { fontSize: 13, fontWeight: "600", color: colors.navy },
});
