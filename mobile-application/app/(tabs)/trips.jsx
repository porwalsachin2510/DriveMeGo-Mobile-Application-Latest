import { useMemo, useState } from "react";
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "../../src/components/AppHeader";
import { Badge, Button, Card, Chip, EmptyState, Loading } from "../../src/components/ui";
import { bookingService } from "../../src/services";
import { bookingStatusMeta, formatDate, formatMoney } from "../../src/utils/format";
import { colors, gradients, radius, type } from "../../src/theme";

export const bookingListFrom = (data) => data?.bookings || data?.data?.bookings || data?.data || (Array.isArray(data) ? data : []);

const TABS = [
  { key: "all", label: "All Bookings", match: () => true },
  { key: "pending", label: "Pending Approval", match: (s) => ["PENDING", "PENDING_APPROVAL"].includes(s) },
  { key: "confirmed", label: "Confirmed", match: (s) => ["CONFIRMED", "ACCEPTED", "ACTIVE", "BOOKED"].includes(s) },
  { key: "completed", label: "Completed", match: (s) => s === "COMPLETED" },
];

export default function Trips() {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["bookings", "passenger"],
    queryFn: () => bookingService.passenger({}),
  });

  const bookings = useMemo(() => bookingListFrom(data), [data]);
  const statusOf = (b) => String(b.status || b.bookingStatus || "").toUpperCase();
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, bookings.filter((b) => t.match(statusOf(b))).length])), [bookings]);
  const list = bookings.filter((b) => TABS.find((t) => t.key === tab).match(statusOf(b)));

  const cancel = useMutation({
    mutationFn: (id) => bookingService.cancel(id, "Cancelled by commuter"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
    onError: (e) => Alert.alert("Could not cancel", e?.response?.data?.message || "Please try again."),
  });

  const confirmCancel = (b) =>
    Alert.alert("Cancel request", "Do you want to cancel this booking request?", [
      { text: "Keep", style: "cancel" },
      { text: "Cancel Request", style: "destructive", onPress: () => cancel.mutate(b._id) },
    ]);

  const header = (
    <View>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
        <View style={styles.bannerIcon}><Ionicons name="people" size={26} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={[type.h1, { color: "#fff" }]}>My Rides</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 2 }}>View and manage your ride bookings</Text>
        </View>
      </LinearGradient>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 14 }} style={{ flexGrow: 0 }}>
        {TABS.map((t) => (
          <Chip key={t.key} label={`${t.label}  ${counts[t.key]}`} active={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <FlatList
        data={list}
        keyExtractor={(b) => String(b._id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.teal} />}
        renderItem={({ item }) => <BookingCard booking={item} status={statusOf(item)} onOpen={() => router.push(`/booking-details/${item._id}`)} onCancel={() => confirmCancel(item)} />}
        ListEmptyComponent={isLoading ? <Loading /> : <EmptyState icon="calendar-outline" title="No bookings yet" message="Book a verified route and it will appear here." action={<Button title="Find Routes" onPress={() => router.push("/(tabs)/routes")} />} />}
      />
    </View>
  );
}

function BookingCard({ booking: b, status, onOpen, onCancel }) {
  const meta = bookingStatusMeta(status);
  const round = String(b.bookingType || b.passType || "").toUpperCase().includes("ROUND");
  const from = b.pickupLocation || b.routeId?.fromLocation || b.fromLocation || "-";
  const to = b.dropoffLocation || b.routeId?.toLocation || b.toLocation || "-";
  const pending = ["PENDING", "PENDING_APPROVAL"].includes(status);
  const amount = b.totalAmount ?? b.amount ?? b.price ?? 0;

  return (
    <Card style={{ marginBottom: 14 }}>
      <View style={styles.rowBetween}>
        <Badge label={meta.label} tone={meta.tone} />
        <Badge label={round ? "Round Trip" : "One Way"} tone="teal" icon={round ? "repeat" : "arrow-forward"} />
      </View>
      <Text style={[type.h2, { marginTop: 12 }]} numberOfLines={2}>{from} → {to}</Text>
      <View style={styles.meta}>
        <Ionicons name="calendar-outline" size={14} color={colors.teal} />
        <Text style={type.small}>{formatDate(b.travelDate || b.passStartDate || b.createdAt)}</Text>
        <Text style={type.small}>·  {b.numberOfSeats || 1} seat{(b.numberOfSeats || 1) > 1 ? "s" : ""}</Text>
      </View>
      <View style={[styles.rowBetween, styles.priceBox]}>
        <View>
          <Text style={styles.caption}>PAYMENT</Text>
          <Text style={{ fontWeight: "700", color: colors.navy }}>{b.paymentMethod || "-"}</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.navy }}>{formatMoney(amount, b.currency || "AED")}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button title="View Details" variant="soft" icon="eye-outline" onPress={onOpen} small /></View>
        {pending ? (
          <View style={{ flex: 1 }}><Button title="Cancel Request" variant="outline" icon="close" onPress={onCancel} small /></View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: radius.xl, marginBottom: 16 },
  bannerIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  priceBox: { backgroundColor: colors.tealTint, borderRadius: radius.md, padding: 12, marginVertical: 14 },
  caption: { fontSize: 10, fontWeight: "700", color: colors.muted, letterSpacing: 0.6 },
});
