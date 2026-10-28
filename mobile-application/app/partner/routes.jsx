import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { FilterRow, InfoCell, PartnerHeader } from "../../src/components/partner";
import { Badge, Button, Card, EmptyState, Loading } from "../../src/components/ui";
import { partnerService } from "../../src/services/partner";
import { getErrorMessage } from "../../src/api/client";
import { colors, radius, type } from "../../src/theme";

const dayLabel = (d) => String(d).slice(0, 3).replace(/^./, (c) => c.toUpperCase()).toLowerCase().replace(/^./, (c) => c.toUpperCase());

export default function PartnerRoutes() {
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const q = useQuery({ queryKey: ["partner", "routes"], queryFn: partnerService.routes });
  const routes = q.data?.routes || [];

  const isActive = (r) => r.isActive !== false && String(r.status || "Active").toLowerCase() === "active";
  const active = routes.filter(isActive).length;

  const visible = useMemo(
    () => routes.filter((r) => (filter === "all" ? true : filter === "active" ? isActive(r) : !isActive(r))),
    [routes, filter]
  );

  const del = useMutation({
    mutationFn: (id) => partnerService.deleteRoute(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner"] }),
    onError: (e) => Alert.alert("Could not delete route", getErrorMessage(e)),
  });

  const confirmDelete = (r) =>
    Alert.alert("Delete route?", `${r.fromLocation} to ${r.toLocation} will be removed permanently.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => del.mutate(r._id) },
    ]);

  return (
    <Screen header={<PartnerHeader />} tabBarSpace refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Text style={type.h1}>Route Management</Text>
      <Text style={[type.small, { marginBottom: 14 }]}>Manage your public transport routes and schedules</Text>

      <Card style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={type.caption}>Total routes</Text>
          <Text style={styles.big}>{routes.length}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.caption}>Active</Text>
          <Text style={[styles.big, { color: colors.success }]}>{active}</Text>
        </View>
        <Button title="Add Route" icon="add" small onPress={() => router.push("/partner/add-route")} style={{ minWidth: 130 }} />
      </Card>

      <FilterRow
        items={[
          { key: "all", label: "All", count: routes.length },
          { key: "active", label: "Active", count: active },
          { key: "inactive", label: "Inactive", count: routes.length - active },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {q.isLoading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="map-outline"
          title="No routes yet"
          message="Create your first route to start receiving bookings."
          action={<Button title="Add New Route" onPress={() => router.push("/partner/add-route")} />}
        />
      ) : (
        visible.map((r) => {
          const p = r.pricing || {};
          const cur = p.currency || "AED";
          const days = (r.availableDays || []).map(dayLabel);
          return (
            <Card key={r._id} style={styles.card}>
              <View style={styles.head}>
                <Ionicons name="location" size={20} color={colors.teal} />
                <Text style={[type.h3, { flex: 1 }]} numberOfLines={2}>
                  {r.fromLocation} {"\u2192"} {r.toLocation}
                </Text>
                <Badge label={isActive(r) ? "Active" : "Inactive"} tone={isActive(r) ? "success" : "muted"} />
              </View>

              <View style={styles.grid}>
                <InfoCell icon="time-outline" label="Start time" value={r.startTime || "-"} />
                <InfoCell icon="calendar-outline" label="Days" value={days.length ? days.slice(0, 3).join(", ") + (days.length > 3 ? ` +${days.length - 3}` : "") : "-"} />
              </View>
              <View style={styles.grid}>
                <InfoCell icon="bus-outline" label="Total seats" value={String(r.totalSeats ?? 0)} />
                <InfoCell icon="person-outline" label="Available" value={String(r.availableSeats ?? 0)} />
              </View>
              <View style={styles.grid}>
                <View style={[styles.price, { backgroundColor: colors.successSoft }]}>
                  <Text style={type.caption}>One way / month</Text>
                  <Text style={styles.priceText}>{cur} {Number(p.monthlyOneWayPrice || 0).toFixed(0)}</Text>
                </View>
                <View style={[styles.price, { backgroundColor: colors.successSoft }]}>
                  <Text style={type.caption}>Round trip / month</Text>
                  <Text style={styles.priceText}>{cur} {Number(p.monthlyRoundTripPrice || 0).toFixed(0)}</Text>
                </View>
              </View>
              <View style={styles.grid}>
                <InfoCell icon="car-outline" label="Vehicle" value={r.effectiveVehicle?.model || "Not assigned"} />
                <InfoCell icon="person-circle-outline" label="Driver" value={r.driverInfo?.name || "Not assigned"} />
              </View>

              <View style={styles.actions}>
                <Pressable style={[styles.action, { backgroundColor: colors.tealSoft }]} onPress={() => router.push({ pathname: "/partner/add-schedule", params: { routeId: r._id } })}>
                  <Ionicons name="add-circle-outline" size={16} color={colors.tealDark} />
                  <Text style={[styles.actionText, { color: colors.tealDark }]}>Add Schedule</Text>
                </Pressable>
                <Pressable style={[styles.action, { backgroundColor: colors.dangerSoft }]} onPress={() => confirmDelete(r)}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
                </Pressable>
              </View>
              <Text style={[type.small, { textAlign: "center", marginTop: 8, fontSize: 12 }]}>
                {(r.schedules || []).length} schedule{(r.schedules || []).length === 1 ? "" : "s"} configured
              </Text>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 12 },
  big: { fontSize: 24, fontWeight: "800", color: colors.navy },
  card: { padding: 14, marginBottom: 14, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  grid: { flexDirection: "row", gap: 8 },
  price: { flex: 1, borderRadius: radius.md, padding: 10 },
  priceText: { fontSize: 15, fontWeight: "800", color: colors.success, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  action: { flex: 1, height: 42, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  actionText: { fontSize: 13, fontWeight: "700" },
});
