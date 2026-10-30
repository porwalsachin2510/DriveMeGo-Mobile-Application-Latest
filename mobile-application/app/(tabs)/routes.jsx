import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "../../src/components/AppHeader";
import { FilterSelect } from "../../src/components/FilterSelect";
import { Chip, EmptyState, Loading } from "../../src/components/ui";
import { ROUTE_FILTERS } from "../../src/hooks/useRoutes";
import { routeService } from "../../src/services";
import { routeStore } from "../../src/lib/routeStore";
import { getErrorMessage } from "../../src/api/client";
import { formatDateNumeric, formatMoney } from "../../src/utils/format";
import { colors, gradients, radius, shadow, type } from "../../src/theme";
import { LinearGradient } from "expo-linear-gradient";

const STATUS_OPTIONS = [
  { value: "all", label: "All Routes" },
  { value: "booked", label: "My Booked" },
  { value: "saved", label: "Saved" },
  { value: "available", label: "Available" },
];

const matchesChip = (route, key) => {
  const chip = ROUTE_FILTERS.find((f) => f.key === key);
  if (!chip?.match) return true;
  const text = [
    route.name,
    route.tripType,
    ...(route.tags || []).map((t) => t.label || t),
    ...(route.pricing?.features || []),
  ]
    .join(" ")
    .toLowerCase();
  return chip.match.some((m) => text.includes(m));
};

export default function FindRoutes() {
  const router = useRouter();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [chip, setChip] = useState("all");

  const q = useQuery({ queryKey: ["commuter-routes"], queryFn: () => routeService.commuterRoutes() });
  const all = q.data?.routes || [];

  const routes = useMemo(() => {
    const term = query.trim().toLowerCase();
    return all.filter((r) => {
      if (term && !`${r.name} ${r.startPoint} ${r.endPoint}`.toLowerCase().includes(term)) return false;
      if (status === "booked" && !r.isBooked) return false;
      if (status === "saved" && !r.isSaved) return false;
      if (status === "available" && r.isBooked) return false;
      return matchesChip(r, chip);
    });
  }, [all, query, status, chip]);

  const toggleSave = useMutation({
    mutationFn: (r) => (r.isSaved ? routeService.unsave(r._id) : routeService.save(r._id)),
    onMutate: async (r) => {
      await qc.cancelQueries({ queryKey: ["commuter-routes"] });
      const prev = qc.getQueryData(["commuter-routes"]);
      qc.setQueryData(["commuter-routes"], (old) =>
        old ? { ...old, routes: old.routes.map((x) => (x._id === r._id ? { ...x, isSaved: !x.isSaved } : x)) } : old,
      );
      return { prev };
    },
    onError: (e, _r, ctx) => {
      if (ctx?.prev) qc.setQueryData(["commuter-routes"], ctx.prev);
      Alert.alert("Could not update", getErrorMessage(e));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["commuter-routes"] });
      qc.invalidateQueries({ queryKey: ["saved-routes"] });
    },
  });

  const book = (route) => {
    routeStore.setRoute(route);
    router.push(`/booking/${route._id}`);
  };

  const header = (
    <View>
      <View style={styles.hero}>
        <View style={{ flex: 1, zIndex: 1 }}>
          <Text style={styles.eyebrow}>COMMUTER</Text>
          <Text style={styles.title}>
            Find <Text style={{ color: colors.teal }}>Routes</Text>
          </Text>
          <Text style={[type.small, { marginTop: 4, maxWidth: 200 }]}>Browse, verify and plan your daily commute with ease.</Text>
        </View>
        <Image source={require("../../assets/images/hero-bus.png")} style={styles.heroImg} contentFit="contain" />
      </View>

      <View style={[styles.search, shadow]}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search routes..."
          placeholderTextColor={colors.subtle}
          style={styles.searchInput}
          returnKeyType="search"
        />
        <FilterSelect value={status} options={STATUS_OPTIONS} onChange={setStatus} title="Show routes" style={styles.select} />
      </View>

      <View style={styles.chips}>
        {ROUTE_FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} icon={f.icon} active={chip === f.key} onPress={() => setChip(f.key)} />
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={gradients.soft} style={StyleSheet.absoluteFill} />
      <AppHeader transparent />
      <FlatList
        data={q.isLoading ? [] : routes}
        keyExtractor={(item) => String(item._id)}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <FindRouteCard
            route={item}
            onBook={() => book(item)}
            onSave={() => toggleSave.mutate(item)}
            saving={toggleSave.isPending && toggleSave.variables?._id === item._id}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.teal} />}
        ListEmptyComponent={
          q.isLoading ? (
            <Loading label="Loading routes..." />
          ) : (
            <EmptyState
              icon="map-outline"
              title={query || status !== "all" || chip !== "all" ? "No routes match" : "No partner routes yet"}
              message={query || status !== "all" || chip !== "all" ? "Try adjusting your search or filter." : "Check back later for available routes."}
            />
          )
        }
      />
    </View>
  );
}

function FindRouteCard({ route, onBook, onSave, saving }) {
  const [open, setOpen] = useState(false);
  const cur = route.pricing?.currency || route.currency || "AED";
  const oneWay = Number(route.monthlyOneWayPrice ?? route.price ?? 0);
  const roundTrip = Number(route.monthlyRoundTripPrice ?? 0);
  const full = Number(route.availableSeats) <= 0;
  const statusLabel = route.isBooked ? "Booked" : "Available";

  return (
    <View style={[styles.card, shadow]}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.cardTop} accessibilityRole="button" accessibilityLabel={`${route.name}, show details`}>
        <View style={styles.thumb}>
          <Image source={require("../../assets/images/city-footer.png")} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.statusPill}>
            <View style={[styles.dot, { backgroundColor: route.isBooked ? colors.info : colors.success }]} />
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {route.name}
          </Text>
          <Text style={[type.small, { fontSize: 12 }]} numberOfLines={1}>
            {route.partnerName}
          </Text>
          <View style={{ marginTop: 6 }}>
            <Text style={styles.priceLabel}>ONE WAY</Text>
            <Text style={styles.price}>
              {formatMoney(oneWay, cur)}
              <Text style={styles.per}>/month</Text>
            </Text>
            {roundTrip > 0 ? (
              <>
                <Text style={[styles.priceLabel, { marginTop: 4 }]}>ROUND TRIP</Text>
                <Text style={[styles.price, { color: colors.navy }]}>
                  {formatMoney(roundTrip, cur)}
                  <Text style={styles.per}>/month</Text>
                </Text>
              </>
            ) : null}
          </View>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.tealDark} />
      </Pressable>

      <View style={styles.details}>
        <Cell icon="location" label="From" value={route.startPoint} />
        <Cell icon="location" label="To" value={route.endPoint} />
        <Cell icon="calendar-outline" label="Start Date" value={route.startDate ? formatDateNumeric(route.startDate) : "-"} />
      </View>

      {open ? (
        <View style={[styles.details, { marginTop: 8 }]}>
          <Cell icon="time-outline" label="Duration" value={route.estimatedTime || "-"} />
          <Cell icon="navigate-outline" label="Departure" value={route.departureTime || "-"} />
          <Cell icon="flag-outline" label="Arrival" value={route.arrivalTime || "-"} />
          {route.operatingDays?.length ? (
            <View style={styles.daysRow}>
              {route.operatingDays.map((d) => (
                <View key={d} style={styles.day}>
                  <Text style={styles.dayText}>{String(d).slice(0, 3)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.seats}>
          <Ionicons name="people-outline" size={16} color={colors.muted} />
          <Text style={type.small}>
            Seats: <Text style={{ fontWeight: "800", color: colors.navy }}>{`${route.availableSeats ?? 0}/${route.totalSeats ?? 0}`}</Text>
          </Text>
        </View>
        <Pressable onPress={onSave} disabled={saving} style={[styles.saveBtn, route.isSaved && styles.saveBtnActive]} accessibilityRole="button" accessibilityLabel={route.isSaved ? "Unsave route" : "Save route"}>
          <Ionicons name={route.isSaved ? "bookmark" : "bookmark-outline"} size={16} color={colors.tealDark} />
          <Text style={styles.saveText}>{route.isSaved ? "Saved" : "Save"}</Text>
        </Pressable>
        <Pressable onPress={onBook} disabled={full} style={{ flex: 1.4, opacity: full ? 0.5 : 1 }} accessibilityRole="button">
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bookBtn}>
            <Text style={styles.bookText}>{full ? "Full" : "Book This Route"}</Text>
            {!full ? <Ionicons name="chevron-forward" size={16} color="#fff" /> : null}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function Cell({ icon, label, value }) {
  return (
    <View style={styles.cell}>
      <Ionicons name={icon} size={16} color={colors.teal} />
      <View style={{ flex: 1 }}>
        <Text style={styles.cellLabel}>{label}</Text>
        <Text style={styles.cellValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", minHeight: 140, marginTop: 4, marginBottom: 10 },
  heroImg: { position: "absolute", right: -30, top: 0, width: 220, height: 140, opacity: 0.95 },
  eyebrow: { fontSize: 13, fontWeight: "700", color: colors.teal, letterSpacing: 1 },
  title: { fontSize: 34, fontWeight: "800", color: colors.navy, letterSpacing: -0.6 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: radius.xl,
    paddingLeft: 16,
    paddingRight: 6,
    height: 58,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.navy },
  select: { minWidth: 130, height: 44, backgroundColor: colors.tealTint, borderWidth: 0 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: radius.xl, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  thumb: { width: 96, height: 96, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.tealSoft },
  statusPill: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: "800", color: colors.navy },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.navy },
  priceLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, letterSpacing: 0.5 },
  price: { fontSize: 15, fontWeight: "800", color: colors.tealDark },
  per: { fontSize: 11, fontWeight: "600", color: colors.muted },
  details: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: colors.tealTint,
    borderRadius: radius.lg,
    padding: 10,
    marginTop: 12,
    rowGap: 10,
  },
  cell: { width: "33.33%", flexDirection: "row", gap: 6, paddingRight: 6 },
  cellLabel: { fontSize: 11, color: colors.muted },
  cellValue: { fontSize: 13, fontWeight: "700", color: colors.navy },
  daysRow: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  day: { backgroundColor: "#fff", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  dayText: { fontSize: 12, fontWeight: "700", color: colors.tealDark },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  seats: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.tealTint,
  },
  saveBtnActive: { backgroundColor: colors.tealSoft },
  saveText: { fontSize: 13, fontWeight: "700", color: colors.tealDark },
  bookBtn: { height: 42, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 12 },
  bookText: { color: "#fff", fontSize: 13, fontWeight: "800" },
});
