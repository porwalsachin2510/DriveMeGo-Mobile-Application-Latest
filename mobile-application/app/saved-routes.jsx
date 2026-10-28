import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SubScreen, errorMessage } from "../src/components/SubScreen";
import { Badge, Button, Card, Chip, EmptyState, Loading } from "../src/components/ui";
import { routeService } from "../src/services";
import { formatMoney } from "../src/utils/format";
import { colors, radius, type } from "../src/theme";

export default function SavedRoutes() {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState("saved");
  const routesQ = useQuery({ queryKey: ["commuter", "routes"], queryFn: () => routeService.commuterRoutes() });
  const statsQ = useQuery({ queryKey: ["commuter", "stats"], queryFn: routeService.commuterStats });
  const routes = routesQ.data?.routes || [];
  const stats = statsQ.data?.stats || {};

  const saved = routes.filter((r) => r.isSaved);
  const visible = useMemo(() => (tab === "saved" ? saved : routes), [tab, routes, saved]);

  const toggle = useMutation({
    mutationFn: (r) => (r.isSaved ? routeService.unsave(r._id) : routeService.save(r._id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commuter"] }),
    onError: (e) => Alert.alert("Could not update route", errorMessage(e)),
  });

  const refresh = () => {
    routesQ.refetch();
    statsQ.refetch();
  };

  return (
    <SubScreen
      eyebrow="My commute"
      title="Saved Routes"
      subtitle="Bookmark routes you travel often and book them quickly."
      icon="bookmark-outline"
      refreshing={routesQ.isRefetching}
      onRefresh={refresh}
    >
      <View style={styles.stats}>
        <Stat icon="car-outline" label="Total rides" value={stats.totalRides ?? 0} />
        <Stat icon="leaf-outline" label="CO2 saved" value={stats.savedCO2 || "0kg"} />
        <Stat icon="calendar-outline" label="Active plans" value={stats.activeSubscriptions ?? 0} />
      </View>

      <View style={styles.tabs}>
        <Chip label={`Saved (${saved.length})`} active={tab === "saved"} onPress={() => setTab("saved")} icon="bookmark" />
        <Chip label={`All routes (${routes.length})`} active={tab === "all"} onPress={() => setTab("all")} icon="map-outline" />
      </View>

      {routesQ.isLoading ? (
        <Loading />
      ) : routesQ.isError ? (
        <EmptyState icon="alert-circle-outline" title="Could not load routes" message={errorMessage(routesQ.error)} action={<Button title="Retry" onPress={refresh} />} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          title={tab === "saved" ? "No saved routes" : "No routes available"}
          message={tab === "saved" ? "Tap the bookmark on any route to save it here." : "There are no active routes in your country yet."}
          action={tab === "saved" && routes.length ? <Button title="Browse routes" onPress={() => setTab("all")} /> : null}
        />
      ) : (
        visible.map((r) => {
          const busy = toggle.isPending && toggle.variables?._id === r._id;
          return (
            <Card key={r._id} style={styles.card}>
              <View style={styles.head}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={type.h3} numberOfLines={2}>
                    {r.fromLocation || r.startPoint} {"\u2192"} {r.toLocation || r.endPoint}
                  </Text>
                  <Text style={[type.small, { fontSize: 12 }]} numberOfLines={1}>
                    {r.partnerName}
                  </Text>
                </View>
                <Pressable
                  onPress={() => toggle.mutate(r)}
                  disabled={busy}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={r.isSaved ? "Remove from saved" : "Save route"}
                  style={[styles.bookmark, r.isSaved && { backgroundColor: colors.teal }]}
                >
                  <Ionicons name={r.isSaved ? "bookmark" : "bookmark-outline"} size={18} color={r.isSaved ? "#fff" : colors.tealDark} />
                </Pressable>
              </View>

              <View style={styles.meta}>
                <Badge label={r.tripType || "One Way"} tone="teal" />
                <Badge label={`${r.availableSeats ?? 0}/${r.totalSeats ?? 0} seats`} tone={(r.availableSeats ?? 0) > 0 ? "success" : "danger"} />
                {r.distance ? <Badge label={String(r.distance)} tone="muted" /> : null}
              </View>

              <View style={styles.footer}>
                <View>
                  <Text style={type.caption}>From / month</Text>
                  <Text style={styles.price}>{formatMoney(r.monthlyOneWayPrice || r.price || 0, r.currency)}</Text>
                </View>
                <Button title="View & Book" small onPress={() => router.push(`/booking/${r._id}`)} style={{ minWidth: 130 }} />
              </View>
            </Card>
          );
        })
      )}
    </SubScreen>
  );
}

function Stat({ icon, label, value }) {
  return (
    <Card style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.teal} />
      <Text style={styles.statValue}>{String(value)}</Text>
      <Text style={[type.caption, { textAlign: "center" }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", gap: 8, marginBottom: 12 },
  stat: { flex: 1, alignItems: "center", padding: 12, gap: 4 },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.navy },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 12 },
  card: { padding: 14, marginBottom: 12, gap: 10 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bookmark: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.tealSoft },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  price: { fontSize: 17, fontWeight: "800", color: colors.success, marginTop: 2 },
});
