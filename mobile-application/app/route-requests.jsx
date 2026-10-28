import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Screen } from "../src/components/Screen";
import { AppHeader } from "../src/components/AppHeader";
import { PageHero } from "../src/components/PageHero";
import { Badge, Button, Card, Chip, EmptyState, Loading } from "../src/components/ui";
import { routeRequestService } from "../src/services";
import { formatDate, formatMoney } from "../src/utils/format";
import { colors, radius } from "../src/theme";

const TABS = [
  { key: "all", label: "All Requests" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
];

const bucket = (status) => {
  const s = String(status || "").toUpperCase();
  if (["COMPLETED", "FULFILLED"].includes(s)) return "completed";
  if (["CONFIRMED", "ACCEPTED", "APPROVED", "IN_PROGRESS", "MARKETPLACE"].includes(s)) return "confirmed";
  return "pending";
};

const statusMeta = (status) => {
  const b = bucket(status);
  const raw = String(status || "").replace(/_/g, " ").toLowerCase();
  const label = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Pending";
  const s = String(status || "").toUpperCase();
  if (["CANCELLED", "REJECTED", "EXPIRED"].includes(s)) return { label, tone: "danger" };
  return { label, tone: b === "completed" ? "success" : b === "confirmed" ? "teal" : "warning" };
};

const pickList = (res) => {
  const candidates = [res?.data?.requests, res?.requests, res?.data?.routeRequests, res?.data];
  return candidates.find(Array.isArray) || [];
};

const requestTypeLabel = (t) => {
  const v = String(t || "").replace(/_/g, " ").toLowerCase();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "-";
};

function Detail({ icon, label, value }) {
  return (
    <View style={styles.detail}>
      <Ionicons name={icon} size={18} color={colors.tealDark} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={2}>
          {value || "-"}
        </Text>
      </View>
    </View>
  );
}

function RequestCard({ req }) {
  const meta = statusMeta(req.status);
  const provider = req.assignedProviderId?.companyName || req.assignedProviderId?.fullName;
  const days = Array.isArray(req.travelDays) ? req.travelDays.join(", ") : req.travelDays;
  return (
    <Card style={{ padding: 14 }}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.route} numberOfLines={2}>
            {req.pickupLocation}
            <Text style={{ color: colors.teal }}> {"\u2192"} </Text>
            {req.dropoffLocation}
          </Text>
          <Text style={styles.date}>{formatDate(req.expectedStartDate || req.createdAt)}</Text>
        </View>
        <Badge label={meta.label} tone={meta.tone} />
      </View>
      <View style={styles.grid}>
        <Detail icon="person-outline" label="Provider" value={provider || "Awaiting provider"} />
        <Detail icon="swap-horizontal-outline" label="Request type" value={requestTypeLabel(req.requestType)} />
        <Detail icon="time-outline" label="Preferred time" value={req.preferredTime} />
        <Detail icon="calendar-outline" label="Travel days" value={days} />
        {req.estimatedPrice ? <Detail icon="wallet-outline" label="Estimated price" value={formatMoney(req.estimatedPrice, req.currency || "AED")} /> : null}
      </View>
    </Card>
  );
}

export default function RouteRequestsScreen() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      setItems(pickList(await routeRequestService.mine({ page: 1, limit: 100 })));
    } catch (e) {
      setError(e?.response?.data?.message || "Could not load your route requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const counts = useMemo(() => {
    const c = { all: items.length, pending: 0, confirmed: 0, completed: 0 };
    items.forEach((i) => (c[bucket(i.status)] += 1));
    return c;
  }, [items]);

  const visible = tab === "all" ? items : items.filter((i) => bucket(i.status) === tab);

  return (
    <Screen header={<AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/more"))} />} refreshing={refreshing} onRefresh={() => load(true)} decor>
      <PageHero eyebrow="Route Requests" title="My Route Requests" subtitle="View and manage your route requests easily." icon="navigate-outline" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={{ marginHorizontal: -20 }}>
        {TABS.map((t) => (
          <Chip key={t.key} label={`${t.label} (${counts[t.key]})`} active={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </ScrollView>

      {loading ? (
        <Loading label="Loading requests..." />
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Something went wrong" message={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="chatbox-ellipses-outline"
          title="No requests yet"
          message="Can't find your route? Request one from the Routes tab."
          action={<Button title="Explore Routes" onPress={() => router.push("/(tabs)/routes")} />}
        />
      ) : (
        <View style={{ gap: 14 }}>
          {visible.map((r) => (
            <RequestCard key={String(r._id)} req={r} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: 20, gap: 8, paddingBottom: 14 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  route: { fontSize: 15.5, fontWeight: "800", color: colors.navy },
  date: { fontSize: 12.5, color: colors.muted, marginTop: 3 },
  grid: { marginTop: 12, padding: 12, gap: 12, borderRadius: radius.lg, backgroundColor: colors.tealTint },
  detail: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailLabel: { fontSize: 10.5, color: colors.muted, textTransform: "uppercase" },
  detailValue: { fontSize: 13.5, fontWeight: "700", color: colors.navy },
});
