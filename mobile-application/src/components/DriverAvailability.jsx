import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { b2cDriverService } from "../services/driver";
import { placeName, toTime12 } from "../utils/driver";
import { colors, radius, shadow } from "../theme";

const OPTIONS = [
  { key: "available", label: "Available", icon: "checkmark-circle", color: colors.success, soft: colors.successSoft },
  { key: "busy", label: "Busy", icon: "time", color: colors.warning, soft: colors.warningSoft },
  { key: "offline", label: "Offline", icon: "moon", color: colors.muted, soft: "#EEF2F6" },
];

const optionOf = (k) => OPTIONS.find((o) => o.key === k) || OPTIONS[0];
const errText = (e) => e?.response?.data?.message || "Failed to update availability status";

export function DriverAvailabilityCard() {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [popup, setPopup] = useState(false);

  const query = useQuery({
    queryKey: ["b2c-driver", "availability"],
    queryFn: async () => {
      await b2cDriverService.checkAvailability().catch(() => null);
      return b2cDriverService.availability();
    },
    refetchInterval: 15000,
  });
  const status = String(query.data?.availability?.status || query.data?.status || "available").toLowerCase();
  const current = optionOf(status);

  const detailed = useQuery({
    queryKey: ["b2c-driver", "availability", "detailed"],
    queryFn: b2cDriverService.availabilityDetailed,
    enabled: popup,
  });

  const mutation = useMutation({
    mutationFn: (next) => b2cDriverService.setAvailability(next),
    onSuccess: () => {
      setPopup(false);
      qc.invalidateQueries({ queryKey: ["b2c-driver", "availability"] });
    },
    onError: (e) => {
      const data = e?.response?.data;
      if (data?.hasIncompleteTrips || data?.hasInProgressTrip) {
        setPopup(true);
        return;
      }
      Alert.alert("Could not update", errText(e));
    },
  });

  const choose = (next) => {
    if (next === status || mutation.isPending) return;
    if (next === "available" && status === "busy") {
      setPopup(true);
      return;
    }
    mutation.mutate(next);
  };

  const info = detailed.data || {};
  const completed = info.completedTripsToday || [];
  const nextTrip = info.nextScheduledTrip;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.dotWrap, { backgroundColor: current.soft }]}>
          <Ionicons name={current.icon} size={20} color={current.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Availability Status</Text>
          <Text style={[styles.value, { color: current.color }]}>{query.isLoading ? "Checking..." : current.label}</Text>
        </View>
        {mutation.isPending ? <ActivityIndicator color={colors.teal} /> : null}
      </View>
      <View style={styles.row} accessibilityRole="radiogroup">
        {OPTIONS.map((o) => {
          const active = o.key === status;
          return (
            <Pressable
              key={o.key}
              onPress={() => choose(o.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={[styles.option, active && { backgroundColor: o.color, borderColor: o.color }]}
            >
              <Ionicons name={o.icon} size={15} color={active ? "#fff" : o.color} />
              <Text style={[styles.optionText, active && { color: "#fff" }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Modal visible={popup} transparent animationType="slide" onRequestClose={() => setPopup(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPopup(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Change to Available?</Text>
          <Text style={styles.sheetSub}>Review today&apos;s trips before switching your status.</Text>
          {detailed.isLoading ? (
            <ActivityIndicator color={colors.teal} style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 12, paddingVertical: 12 }}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{`Completed today (${completed.length})`}</Text>
                {completed.length === 0 ? (
                  <Text style={styles.muted}>No trips completed yet today.</Text>
                ) : (
                  completed.map((t) => (
                    <View key={t._id} style={styles.tripRow}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <Text style={styles.tripText} numberOfLines={1}>
                        {`${placeName(t.fromLocation)} \u2192 ${placeName(t.toLocation)}`}
                      </Text>
                      <Text style={styles.muted}>{toTime12(t.departureTime)}</Text>
                    </View>
                  ))
                )}
              </View>
              <View style={[styles.section, nextTrip && { backgroundColor: colors.warningSoft }]}>
                <Text style={styles.sectionTitle}>Next scheduled trip</Text>
                {nextTrip ? (
                  <View style={styles.tripRow}>
                    <Ionicons name="time" size={16} color={colors.warning} />
                    <Text style={styles.tripText} numberOfLines={1}>
                      {`${placeName(nextTrip.fromLocation)} \u2192 ${placeName(nextTrip.toLocation)}`}
                    </Text>
                    <Text style={styles.muted}>{toTime12(nextTrip.departureTime)}</Text>
                  </View>
                ) : (
                  <Text style={styles.muted}>No more scheduled trips today.</Text>
                )}
              </View>
              {nextTrip ? (
                <Text style={styles.warn}>
                  You still have a scheduled trip. You can be available in the gap, but please be on time for your next departure.
                </Text>
              ) : null}
            </ScrollView>
          )}
          <View style={styles.actions}>
            <Pressable onPress={() => setPopup(false)} style={[styles.btn, styles.btnGhost]}>
              <Text style={[styles.btnText, { color: colors.navy }]}>Stay Busy</Text>
            </Pressable>
            <Pressable
              onPress={() => mutation.mutate("available")}
              disabled={mutation.isPending}
              style={[styles.btn, { backgroundColor: colors.success, opacity: mutation.isPending ? 0.6 : 1 }]}
            >
              {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Set Available</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: radius.xl, padding: 14, gap: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 14, ...shadow },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  dotWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, color: colors.muted, fontWeight: "700", letterSpacing: 0.4 },
  value: { fontSize: 16, fontWeight: "800" },
  row: { flexDirection: "row", gap: 8 },
  option: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.tealTint },
  optionText: { fontSize: 13, fontWeight: "700", color: colors.navy },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: "#FBFEFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10 },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: "#C8D6E0", marginBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: colors.navy },
  sheetSub: { fontSize: 13, color: colors.muted, marginTop: 4 },
  section: { padding: 12, borderRadius: radius.lg, backgroundColor: colors.tealSoft, gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: colors.navy },
  tripRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tripText: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.navy },
  muted: { fontSize: 12, color: colors.muted },
  warn: { fontSize: 12, color: colors.warning, lineHeight: 17 },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  btn: { flex: 1, height: 50, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: "#EEF2F6" },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
