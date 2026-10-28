import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { FilterRow, InfoCell, PartnerHeader } from "../../src/components/partner";
import { Badge, Button, Card, EmptyState, Loading } from "../../src/components/ui";
import { partnerService } from "../../src/services/partner";
import { getErrorMessage } from "../../src/api/client";
import { formatDate } from "../../src/utils/format";
import { colors, type } from "../../src/theme";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "PENDING", label: "Pending" },
  { key: "FULFILLED", label: "Fulfilled" },
];

const tone = (s) => ({ OPEN: "info", PENDING: "warning", UNDER_REVIEW: "warning", APPROVED: "success", FULFILLED: "success" }[s] || "muted");
const label = (s) => String(s || "").replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export default function PartnerRequests() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const q = useQuery({ queryKey: ["partner", "requests"], queryFn: () => partnerService.routeRequests({ limit: 50 }) });
  const all = q.data?.data?.routeRequests || [];
  const rows = filter === "all" ? all : all.filter((r) => r.status === filter);
  const count = (s) => all.filter((r) => r.status === s).length;

  const respond = useMutation({
    mutationFn: ({ id, status }) => partnerService.respondRouteRequest(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner", "requests"] }),
    onError: (e) => Alert.alert("Could not update", getErrorMessage(e)),
  });

  return (
    <Screen header={<PartnerHeader back />} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Text style={type.h1}>Route Requests</Text>
      <Text style={[type.small, { marginBottom: 14 }]}>Commuter demand you can serve. Show interest to get discovered.</Text>

      <FilterRow
        items={FILTERS.map((f) => ({ ...f, count: f.key === "all" ? all.length : count(f.key) }))}
        value={filter}
        onChange={setFilter}
      />

      {q.isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon="chatbubble-ellipses-outline" title="No route requests" message="New commuter demand in your country will appear here." />
      ) : (
        rows.map((r) => {
          const interested = r.myInterestStatus && r.myInterestStatus !== "REJECTED";
          const closed = r.status === "FULFILLED";
          return (
            <Card key={r._id} style={styles.card}>
              <View style={styles.head}>
                <Text style={[type.h3, { flex: 1 }]} numberOfLines={2}>
                  {r.pickupLocation} {"\u2192"} {r.dropoffLocation}
                </Text>
                <Badge label={label(r.status)} tone={tone(r.status)} />
              </View>
              <View style={styles.grid}>
                <InfoCell icon="people-outline" label="Demand" value={`${r.demandCount || 1} commuter${(r.demandCount || 1) > 1 ? "s" : ""}`} />
                <InfoCell icon="time-outline" label="Preferred" value={r.preferredTime || "-"} />
              </View>
              <View style={styles.grid}>
                <InfoCell icon="repeat-outline" label="Type" value={label(r.requestType) || "-"} />
                <InfoCell icon="calendar-outline" label="Start" value={formatDate(r.expectedStartDate)} />
              </View>
              {r.travelDays?.length ? (
                <View style={styles.days}>
                  {r.travelDays.map((d) => (
                    <View key={d} style={styles.day}>
                      <Text style={styles.dayText}>{String(d).slice(0, 3)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.foot}>
                <View style={styles.row}>
                  <Ionicons name="hand-right-outline" size={14} color={colors.muted} />
                  <Text style={type.small}>{r.interestedCount || 0} partner{r.interestedCount === 1 ? "" : "s"} interested</Text>
                </View>
              </View>
              {closed ? null : interested ? (
                <Button title="Withdraw Interest" variant="outline" small loading={respond.isPending} onPress={() => respond.mutate({ id: r._id, status: "REJECTED" })} />
              ) : (
                <Button title="I Can Serve This Route" icon="checkmark" small loading={respond.isPending} onPress={() => respond.mutate({ id: r._id, status: "INTERESTED" })} />
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginBottom: 12, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  grid: { flexDirection: "row", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  days: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  day: { backgroundColor: colors.tealSoft, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  dayText: { color: colors.tealDark, fontSize: 12, fontWeight: "700" },
  foot: { flexDirection: "row", justifyContent: "space-between" },
});
