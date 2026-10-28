import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "../../src/components/AppHeader";
import { RouteCard } from "../../src/components/RouteCard";
import { Button, Chip, EmptyState, Loading } from "../../src/components/ui";
import { ROUTE_FILTERS, filterRoutes, useRoutes } from "../../src/hooks/useRoutes";
import { routeStore } from "../../src/lib/routeStore";
import { colors, radius, shadow, type } from "../../src/theme";

const SORTS = [
  { key: "recommended", label: "Recommended", icon: "sparkles-outline" },
  { key: "price-asc", label: "Price: Low to High", icon: "trending-up-outline" },
  { key: "price-desc", label: "Price: High to Low", icon: "trending-down-outline" },
  { key: "start", label: "Earliest Start Date", icon: "calendar-outline" },
  { key: "seats", label: "Most Seats Available", icon: "people-outline" },
];

const price = (r) => Number(r.monthlyPrice ?? r.pricing?.monthlyOneWayPrice ?? 0);

const sortRoutes = (routes, key) => {
  const list = [...routes];
  switch (key) {
    case "price-asc":
      return list.sort((a, b) => price(a) - price(b));
    case "price-desc":
      return list.sort((a, b) => price(b) - price(a));
    case "start":
      return list.sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
    case "seats":
      return list.sort((a, b) => (b.availableSeats ?? 0) - (a.availableSeats ?? 0));
    default:
      return list.sort((a, b) => Number(!!b.isFeatured) - Number(!!a.isFeatured));
  }
};

export default function Routes() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const pickup = String(params.pickup || "");
  const dropoff = String(params.dropoff || "");
  const days = useMemo(() => {
    try {
      return params.days ? JSON.parse(String(params.days)) : undefined;
    } catch {
      return undefined;
    }
  }, [params.days]);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recommended");
  const [sortOpen, setSortOpen] = useState(false);
  const { data, isLoading, refetch, isRefetching } = useRoutes({ pickup, dropoff, days });

  const searched = !!(pickup || dropoff);
  const routes = useMemo(
    () => sortRoutes(filterRoutes(data?.routes || [], filter, query), sort),
    [data, filter, query, sort],
  );
  const country = data?.routes?.[0]?.pricing?.currency === "KWD" ? "Kuwait" : "UAE";

  const book = (route) => {
    routeStore.setRoute(route);
    router.push(`/booking/${route.routeId || route._id}`);
  };

  const header = (
    <View>
      <View style={styles.titleRow}>
        <View style={styles.titleIcon}>
          <Ionicons name="bus" size={26} color={colors.tealDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.h1, { fontSize: 22 }]}>Available B2C Routes</Text>
          <Text style={type.small}>
            {isLoading
              ? "Searching routes..."
              : `Showing ${routes.length} route${routes.length === 1 ? "" : "s"}${searched ? " based on your search" : ""}.`}
          </Text>
        </View>
        <View style={styles.country}>
          <Ionicons name="location" size={14} color={colors.teal} />
          <Text style={styles.countryText}>{country}</Text>
        </View>
      </View>

      {searched ? (
        <View style={styles.searchSummary}>
          <Ionicons name="navigate-outline" size={16} color={colors.tealDark} />
          <Text style={[type.small, { flex: 1, color: colors.navySoft }]} numberOfLines={1}>
            {[pickup || "Any pickup", dropoff || "Any drop"].join("  →  ")}
          </Text>
          <Pressable onPress={() => router.setParams({ pickup: "", dropoff: "", days: "" })} hitSlop={8} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.subtle} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.chips}>
        {ROUTE_FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} icon={f.icon} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </View>

      <View style={[styles.search, shadow]}>
        <Ionicons name="search" size={18} color={colors.tealDark} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by location or provider"
          placeholderTextColor={colors.subtle}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      <Pressable onPress={() => setSortOpen(true)} style={styles.sortBar} accessibilityRole="button" accessibilityLabel="Sort and filter">
        <Ionicons name="options-outline" size={20} color={colors.navySoft} />
        <Text style={styles.sortText}>Sort / Filter</Text>
        <Text style={[type.small, { flex: 1 }]} numberOfLines={1}>
          {sort !== "recommended" ? `· ${SORTS.find((s) => s.key === sort)?.label}` : ""}
        </Text>
        <Ionicons name="grid-outline" size={16} color={colors.muted} />
        <Text style={type.small}>{routes.length} Routes</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader onBack={router.canGoBack() ? () => router.back() : undefined} />
      <FlatList
        data={isLoading ? [] : routes}
        keyExtractor={(item) => String(item.routeId || item._id)}
        ListHeaderComponent={header}
        renderItem={({ item }) => <RouteCard route={item} onBook={book} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.teal} />}
        ListEmptyComponent={
          isLoading ? (
            <Loading label="Finding verified routes..." />
          ) : (
            <EmptyState
              icon="search-outline"
              title="No routes found"
              message={
                data?.serviceAvailable === false
                  ? data?.message || "Service is not available in this area yet."
                  : data?.message || "Try changing your filters or search to see more verified routes."
              }
              action={
                searched ? (
                  <Button title="Request This Route" icon="add-circle-outline" onPress={() => router.push("/route-requests")} />
                ) : null
              }
            />
          )
        }
      />

      <Modal visible={sortOpen} transparent animationType="slide" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSortOpen(false)} />
        <View style={styles.sheet}>
          <Text style={[type.h2, { marginBottom: 12 }]}>Sort routes</Text>
          {SORTS.map((s) => {
            const active = sort === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => {
                  setSort(s.key);
                  setSortOpen(false);
                }}
                style={[styles.sortOption, active && styles.sortOptionActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={s.icon} size={18} color={active ? colors.tealDark : colors.muted} />
                <Text style={[type.body, { flex: 1, fontWeight: active ? "700" : "500" }]}>{s.label}</Text>
                {active ? <Ionicons name="checkmark-circle" size={20} color={colors.teal} /> : null}
              </Pressable>
            );
          })}
          <Text style={[type.h3, { marginTop: 14, marginBottom: 10 }]}>Filter</Text>
          <View style={styles.chips}>
            {ROUTE_FILTERS.map((f) => (
              <Chip key={f.key} label={f.label} icon={f.icon} active={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </View>
          <Button title="Show Routes" icon="checkmark" onPress={() => setSortOpen(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6, marginBottom: 14 },
  titleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  country: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.tealSoft,
  },
  countryText: { fontSize: 14, fontWeight: "800", color: colors.navy },
  searchSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.tealTint,
    marginBottom: 12,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.navy },
  sortBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  sortText: { fontSize: 15, fontWeight: "600", color: colors.navySoft },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: "#fff",
    padding: 20,
    paddingBottom: 36,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    marginBottom: 6,
  },
  sortOptionActive: { backgroundColor: colors.tealTint },
});
