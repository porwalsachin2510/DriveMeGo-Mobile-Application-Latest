import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { FilterRow, PartnerHeader, SegTabs } from "../../src/components/partner";
import { Badge, Button, Card, EmptyState, Loading } from "../../src/components/ui";
import { partnerBookingService } from "../../src/services/partner";
import { bookingStatusMeta, formatDateTime, formatMoney } from "../../src/utils/format";
import { getErrorMessage } from "../../src/api/client";
import { colors, radius, type } from "../../src/theme";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const bucket = (s) => {
  const v = String(s || "").toUpperCase();
  if (v === "PENDING" || v === "PENDING_APPROVAL") return "pending";
  if (["ACCEPTED", "CONFIRMED", "ACTIVE", "BOOKED"].includes(v)) return "accepted";
  if (v === "COMPLETED") return "completed";
  return "cancelled";
};

export default function PartnerBookings() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["partner", "bookings", tab],
    queryFn: tab === "all" ? partnerBookingService.list : partnerBookingService.history,
  });

  const rows = useMemo(() => {
    const d = q.data?.data || q.data || {};
    return d.allBookings || d.bookings || [];
  }, [q.data]);

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, accepted: 0, completed: 0, cancelled: 0 };
    rows.forEach((r) => (c[bucket(r.status)] += 1));
    return c;
  }, [rows]);

  const visible = rows.filter((r) => {
    if (filter !== "all" && bucket(r.status) !== filter) return false;
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return [r.passengerName, r.pickup, r.dropoff, r.bookingId, r.passengerPhone].some((v) => String(v || "").toLowerCase().includes(s));
  });

  const update = useMutation({
    mutationFn: ({ id, status }) => partnerBookingService.updateStatus(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner"] }),
    onError: (e) => Alert.alert("Could not update booking", getErrorMessage(e)),
  });

  const confirm = (id, status) =>
    Alert.alert(status === "ACCEPTED" ? "Accept booking?" : "Reject booking?", "The passenger will be notified.", [
      { text: "Cancel", style: "cancel" },
      { text: status === "ACCEPTED" ? "Accept" : "Reject", style: status === "ACCEPTED" ? "default" : "destructive", onPress: () => update.mutate({ id, status }) },
    ]);

  return (
    <Screen header={<PartnerHeader />} tabBarSpace refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Text style={[type.h1, { marginBottom: 12 }]}>Booking Management</Text>
      <SegTabs
        tabs={[
          { key: "all", label: "All Bookings", icon: "calendar-outline" },
          { key: "history", label: "History", icon: "time-outline" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.tealDark} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search passenger, location or ID" placeholderTextColor={colors.subtle} style={styles.searchInput} />
      </View>
      <FilterRow items={FILTERS.map((f) => ({ ...f, count: counts[f.key] }))} value={filter} onChange={setFilter} />

      {q.isLoading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <EmptyState icon="ticket-outline" title="No bookings found" message="Bookings from passengers will appear here." />
      ) : (
        visible.map((b) => {
          const meta = bookingStatusMeta(b.status);
          const pending = bucket(b.status) === "pending";
          return (
            <Card key={b._id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.idPill}>
                  <Text style={styles.idText}>#{String(b.bookingId || b._id).slice(-8).toLowerCase()}</Text>
                </View>
                <Badge label={meta.label} tone={meta.tone} />
              </View>
              <View style={styles.row}>
                <Ionicons name="person" size={18} color={colors.navy} />
                <View style={{ flex: 1 }}>
                  <Text style={type.h3} numberOfLines={1}>
                    {b.passengerName}
                  </Text>
                  {b.passengerPhone ? <Text style={type.small}>{b.passengerPhone}</Text> : null}
                </View>
              </View>
              <View style={styles.row}>
                <Ionicons name="location" size={18} color={colors.teal} />
                <Text style={[type.body, { flex: 1, fontWeight: "600" }]} numberOfLines={2}>
                  {b.pickup} {"\u2192"} <Text style={{ color: colors.danger }}>{b.dropoff}</Text>
                </Text>
              </View>
              <View style={styles.meta}>
                <Meta icon="car-outline" label="Driver" value={b.driverName} />
                <Meta icon="people-outline" label="Seats" value={String(b.numberOfSeats)} />
                <Meta icon="wallet-outline" label="Amount" value={formatMoney(b.amount, b.currency)} accent />
              </View>
              <Text style={[type.small, { marginTop: 8 }]}>
                {formatDateTime(b.date)} {b.isMonthlyPass ? "\u00B7 Monthly Pass" : ""}
              </Text>
              {pending ? (
                <View style={[styles.row, { marginTop: 12, gap: 10 }]}>
                  <Button title="Reject" variant="outline" small icon="close" onPress={() => confirm(b._id, "REJECTED")} style={{ flex: 1 }} />
                  <Button title="Accept" small icon="checkmark" loading={update.isPending} onPress={() => confirm(b._id, "ACCEPTED")} style={{ flex: 1 }} />
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

function Meta({ icon, label, value, accent }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={type.caption}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
        <Ionicons name={icon} size={14} color={colors.tealDark} />
        <Text style={{ fontSize: 13, fontWeight: "700", color: accent ? colors.success : colors.navy, flexShrink: 1 }} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 48, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: colors.navy },
  card: { padding: 14, marginBottom: 12, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  idPill: { backgroundColor: colors.tealSoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  idText: { color: colors.navy, fontWeight: "800", fontSize: 13 },
  meta: { flexDirection: "row", gap: 8, backgroundColor: colors.tealTint, borderRadius: radius.md, padding: 10 },
});
