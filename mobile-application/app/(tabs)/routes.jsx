import { useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TextInput, View, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "../../src/components/AppHeader";
import { RouteCard } from "../../src/components/RouteCard";
import { Chip, EmptyState, Loading } from "../../src/components/ui";
import { ROUTE_FILTERS, filterRoutes, useRoutes } from "../../src/hooks/useRoutes";
import { routeStore } from "../../src/lib/routeStore";
import { colors, gradients, radius, shadow, type } from "../../src/theme";

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
  const { data, isLoading, refetch, isRefetching } = useRoutes({ pickup, dropoff, days });

  const routes = useMemo(() => filterRoutes(data?.routes || [], filter, query), [data, filter, query]);

  const book = (route) => {
    routeStore.setRoute(route);
    router.push(`/booking/${route.routeId || route._id}`);
  };

  const header = (
    <View>
      <LinearGradient colors={gradients.soft} style={styles.hero}>
        <Text style={[type.caption, { color: colors.teal, fontSize: 12 }]}>Commuter</Text>
        <Text style={[type.display, { fontSize: 32 }]}>
          Find <Text style={{ color: colors.teal }}>Routes</Text>
        </Text>
        <Text style={[type.body, { color: colors.muted, marginTop: 4 }]}>Browse, verify and plan your daily commute with ease.</Text>
      </LinearGradient>

      <View style={[styles.search, shadow]}>
        <Ionicons name="search" size={20} color={colors.tealDark} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search routes..."
          placeholderTextColor={colors.subtle}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {pickup || dropoff ? (
          <Ionicons name="close-circle" size={20} color={colors.subtle} onPress={() => router.setParams({ pickup: "", dropoff: "", days: "" })} />
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        {ROUTE_FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} icon={f.icon} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ScrollView>

      <Text style={[type.small, { marginBottom: 12, marginTop: 4 }]}>
        {isLoading ? "Searching..." : `${routes.length} route${routes.length === 1 ? "" : "s"} available`}
        {pickup || dropoff ? ` for ${[pickup, dropoff].filter(Boolean).join(" → ")}` : ""}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <FlatList
        data={routes}
        keyExtractor={(item) => String(item.routeId || item._id)}
        ListHeaderComponent={header}
        renderItem={({ item }) => <RouteCard route={item} onBook={book} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.teal} />}
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : (
            <EmptyState
              icon="search-outline"
              title="No routes found"
              message={data?.message || "Try changing your filters or search to see more verified routes."}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 20, marginBottom: 16 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    height: 54,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.navy },
  chips: { gap: 10, paddingBottom: 14 },
});
