import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { FilterRow, InfoCell, PartnerHeader } from "../../src/components/partner";
import { Badge, Button, Card, EmptyState, Loading } from "../../src/components/ui";
import { scheduleService } from "../../src/services/partner";
import { getErrorMessage } from "../../src/api/client";
import { colors, radius, type } from "../../src/theme";

const isActive = (s) => s.isActive !== false && String(s.status || "Active").toLowerCase() === "active";

export default function PartnerSchedules() {
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const q = useQuery({ queryKey: ["partner", "schedules"], queryFn: () => scheduleService.schedules() });
  const schedules = q.data?.schedules || [];
  const active = schedules.filter(isActive).length;

  const visible = useMemo(
    () => schedules.filter((s) => (filter === "all" ? true : filter === "active" ? isActive(s) : !isActive(s))),
    [schedules, filter]
  );

  const del = useMutation({
    mutationFn: (id) => scheduleService.deleteSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner"] }),
    onError: (e) => Alert.alert("Could not delete schedule", getErrorMessage(e)),
  });

  const confirmDelete = (s) =>
    Alert.alert("Delete schedule?", "This schedule and all trips generated from it will be removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => del.mutate(s._id) },
    ]);

  return (
    <Screen header={<PartnerHeader back />} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Text style={type.h1}>Schedule Management</Text>
      <Text style={[type.small, { marginBottom: 14 }]}>Manage your daily trip timings, drivers and vehicles</Text>

      <Card style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={type.caption}>Schedules</Text>
          <Text style={styles.big}>{schedules.length}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.caption}>Active</Text>
          <Text style={[styles.big, { color: colors.success }]}>{active}</Text>
        </View>
        <Button title="Add" icon="add" small onPress={() => router.push("/partner/add-schedule")} style={{ minWidth: 100 }} />
      </Card>

      <FilterRow
        items={[
          { key: "all", label: "All", count: schedules.length },
          { key: "active", label: "Active", count: active },
          { key: "inactive", label: "Inactive", count: schedules.length - active },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <EmptyState icon="alert-circle-outline" title="Could not load schedules" message={getErrorMessage(q.error)} action={<Button title="Retry" onPress={q.refetch} />} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No schedules"
          message="Add a schedule to a route to start generating daily trips."
          action={<Button title="Add Schedule" onPress={() => router.push("/partner/add-schedule")} />}
        />
      ) : (
        visible.map((s) => {
          const route = s.routeId || {};
          const trips = s.tripTimes || [];
          return (
            <Card key={s._id} style={styles.card}>
              <View style={styles.head}>
                <Ionicons name="calendar" size={20} color={colors.teal} />
                <View style={{ flex: 1 }}>
                  <Text style={type.h3} numberOfLines={1}>
                    {s.scheduleName || "Route Schedule"}
                  </Text>
                  <Text style={[type.small, { fontSize: 12 }]} numberOfLines={1}>
                    {route.fromLocation || "-"} {"\u2192"} {route.toLocation || "-"}
                  </Text>
                </View>
                <Badge label={isActive(s) ? "Active" : "Inactive"} tone={isActive(s) ? "success" : "muted"} />
              </View>

              <View style={styles.grid}>
                <InfoCell icon="car-outline" label="Vehicle" value={s.assignedVehicle?.model ? `${s.assignedVehicle.model} ${s.assignedVehicle.licensePlate || ""}`.trim() : "Not assigned"} />
                <InfoCell icon="person-circle-outline" label="Driver" value={s.driverInfo?.name || "Not assigned"} />
              </View>

              <Text style={[type.caption, { marginTop: 2 }]}>Trip times ({trips.length})</Text>
              {trips.length === 0 ? (
                <Text style={type.small}>No trip times configured.</Text>
              ) : (
                trips.map((t, i) => (
                  <View key={t._id || i} style={styles.trip}>
                    <Ionicons name="time-outline" size={16} color={colors.tealDark} />
                    <Text style={styles.tripTime}>
                      {t.departureTime}
                      {t.arrivalTime || t.destinationArrivalTime ? ` - ${t.arrivalTime || t.destinationArrivalTime}` : ""}
                    </Text>
                    <Text style={[type.small, { fontSize: 12, flex: 1, textAlign: "right" }]} numberOfLines={1}>
                      {t.tripType || "One Way"}
                      {t.driverInfo?.name ? ` · ${t.driverInfo.name}` : ""}
                    </Text>
                  </View>
                ))
              )}

              <Pressable
                style={[styles.action, { backgroundColor: colors.dangerSoft }]}
                onPress={() => confirmDelete(s)}
                disabled={del.isPending}
                accessibilityRole="button"
                accessibilityLabel="Delete schedule"
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={[styles.actionText, { color: colors.danger }]}>Delete Schedule</Text>
              </Pressable>
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
  trip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.tealSoft, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8 },
  tripTime: { fontSize: 13, fontWeight: "700", color: colors.navy },
  action: { height: 42, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 },
  actionText: { fontSize: 13, fontWeight: "700" },
});
