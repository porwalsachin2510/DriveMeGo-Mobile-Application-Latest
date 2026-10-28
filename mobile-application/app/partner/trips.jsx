import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { PartnerHeader, SegTabs } from "../../src/components/partner";
import { Badge, Button, Card, EmptyState, Loading } from "../../src/components/ui";
import { dailyTripService } from "../../src/services/partner";
import { getErrorMessage } from "../../src/api/client";
import { dayParts } from "../../src/utils/format";
import { colors, radius, type } from "../../src/theme";

const norm = (s) => String(s || "").toUpperCase().replace(/\s+/g, "_");
const statusTone = (s) => ({ SCHEDULED: "info", IN_PROGRESS: "warning", STARTED: "warning", COMPLETED: "success", CANCELLED: "danger" }[norm(s)] || "muted");
const statusLabel = (s) => ({ SCHEDULED: "Scheduled", IN_PROGRESS: "In Progress", STARTED: "In Progress", COMPLETED: "Completed", CANCELLED: "Cancelled" }[norm(s)] || s || "Scheduled");

const fetchers = {
  today: dailyTripService.today,
  upcoming: dailyTripService.upcoming,
  all: dailyTripService.selfDriverTrips,
};

export default function PartnerTrips() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("today");
  const q = useQuery({ queryKey: ["partner", "trips", tab], queryFn: fetchers[tab] });
  const trips = q.data?.data?.trips || q.data?.trips || [];

  const todayQ = useQuery({ queryKey: ["partner", "trips", "today"], queryFn: dailyTripService.today });
  const todayTrips = todayQ.data?.data?.trips || todayQ.data?.trips || [];
  const count = (st) => todayTrips.filter((t) => st.includes(norm(t.status))).length;

  const act = useMutation({
    mutationFn: ({ id, kind }) => (kind === "start" ? dailyTripService.start(id) : dailyTripService.complete(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner"] }),
    onError: (e) => Alert.alert("Action failed", getErrorMessage(e)),
  });

  return (
    <Screen header={<PartnerHeader />} tabBarSpace refreshing={q.isRefetching} onRefresh={() => { q.refetch(); todayQ.refetch(); }}>
      <Text style={type.h1}>Daily Trip Management</Text>
      <Text style={[type.small, { marginBottom: 14 }]}>Start and complete your trips for all passengers at once</Text>

      <Card style={styles.stats}>
        <Stat icon="calendar-outline" value={todayTrips.length} label="Today" />
        <Stat icon="time-outline" value={count(["IN_PROGRESS", "STARTED"])} label="In Progress" tint={colors.warning} />
        <Stat icon="checkmark-circle-outline" value={count(["COMPLETED"])} label="Completed" tint={colors.success} />
      </Card>

      <SegTabs
        tabs={[
          { key: "today", label: "Today" },
          { key: "upcoming", label: "Upcoming" },
          { key: "all", label: "All Trips" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {q.isLoading ? (
        <Loading />
      ) : trips.length === 0 ? (
        <EmptyState icon="bus-outline" title="No trips" message="Trips with passenger bookings will show up here." />
      ) : (
        trips.map((t) => {
          const st = norm(t.status);
          const dp = dayParts(t.tripDate);
          const from = t.fromLocation || t.routeId?.fromLocation;
          const to = t.toLocation || t.routeId?.toLocation;
          const passengers = t.totalPassengers ?? t.bookedSeats ?? 0;
          return (
            <Card key={t._id} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.date}>
                  <Text style={styles.dateDay}>{dp.day}</Text>
                  <Text style={styles.dateNum}>{dp.date}</Text>
                  <Text style={styles.dateDay}>{dp.month}</Text>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={type.h3} numberOfLines={2}>
                    {from} {"\u2192"} {to}
                  </Text>
                  <View style={styles.row}>
                    <Ionicons name="time-outline" size={14} color={colors.tealDark} />
                    <Text style={type.small}>{t.startTime}</Text>
                    <Text style={type.small}>{"\u00B7"} {t.bookedSeats ?? 0}/{t.totalSeats ?? 0} seats</Text>
                  </View>
                  <Badge label={statusLabel(t.status)} tone={statusTone(t.status)} style={{ alignSelf: "flex-start" }} />
                </View>
              </View>

              <View style={styles.meta}>
                <Text style={type.small}>{passengers} passenger{passengers === 1 ? "" : "s"}</Text>
                <Text style={type.small}>{t.vehicleId?.model || t.vehicleModel || "Vehicle"}</Text>
              </View>

              {st === "SCHEDULED" ? (
                <Button title={`Start Trip (${passengers} passenger${passengers === 1 ? "" : "s"})`} icon="play" small loading={act.isPending} onPress={() => act.mutate({ id: t._id, kind: "start" })} />
              ) : st === "IN_PROGRESS" || st === "STARTED" ? (
                <Button title="Complete Trip" icon="checkmark" small loading={act.isPending} onPress={() => act.mutate({ id: t._id, kind: "complete" })} />
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

function Stat({ icon, value, label, tint = colors.tealDark }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Ionicons name={icon} size={22} color={tint} />
      <Text style={{ fontSize: 20, fontWeight: "800", color: colors.navy }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", padding: 14, marginBottom: 14 },
  card: { padding: 14, marginBottom: 12, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  date: { width: 62, borderRadius: radius.md, backgroundColor: colors.tealSoft, alignItems: "center", paddingVertical: 8, marginRight: 4 },
  dateDay: { fontSize: 10, fontWeight: "700", color: colors.tealDark, textTransform: "uppercase" },
  dateNum: { fontSize: 22, fontWeight: "800", color: colors.navy },
  meta: { flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.tealTint, borderRadius: radius.md, padding: 10 },
});
