import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { AppHeader } from "../../src/components/AppHeader";
import { RouteCard } from "../../src/components/RouteCard";
import { Button, Chip, EmptyState, Loading, SectionTitle } from "../../src/components/ui";
import { useRoutes } from "../../src/hooks/useRoutes";
import { routeStore } from "../../src/lib/routeStore";
import { WEEK_DAYS } from "../../src/utils/format";
import { colors, radius, shadow, type } from "../../src/theme";

const DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const daysLabel = (days) => {
  if (days.length === 7) return "Every day";
  if (days.join() === DEFAULT_DAYS.join()) return "Mon – Fri";
  return days.join(", ");
};

export default function Home() {
  const router = useRouter();
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [daysOpen, setDaysOpen] = useState(false);
  const { data, isLoading, refetch, isRefetching } = useRoutes();

  const featured = useMemo(() => {
    const all = data?.routes || [];
    const flagged = all.filter((r) => r.isFeatured);
    return (flagged.length ? flagged : all).slice(0, 4);
  }, [data]);

  const toggleDay = (d) =>
    setDays((prev) => {
      const next = prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d];
      return WEEK_DAYS.filter((x) => next.includes(x));
    });

  const search = () =>
    router.push({
      pathname: "/(tabs)/routes",
      params: { pickup: pickup.trim(), dropoff: dropoff.trim(), days: JSON.stringify(days) },
    });

  const book = (route) => {
    routeStore.setRoute(route);
    router.push(`/booking/${route.routeId || route._id}`);
  };

  return (
    <Screen header={<AppHeader />} tabBarSpace refreshing={isRefetching} onRefresh={refetch} contentStyle={{ paddingHorizontal: 0 }}>
      <View style={styles.hero}>
        <View style={{ flex: 1, paddingLeft: 20, zIndex: 1 }}>
          <Text style={[type.display, { fontSize: 32, lineHeight: 38 }]}>We Are</Text>
          <Text style={[type.display, { fontSize: 32, lineHeight: 38, color: colors.teal }]}>Drive Me Go.</Text>
          <Text style={[type.small, { marginTop: 8, color: colors.navySoft }]} numberOfLines={4}>
            Opening new possibilities — freedom to go anywhere, every day.
          </Text>
        </View>
        <Image source={require("../../assets/images/hero-bus.png")} style={styles.heroBus} contentFit="cover" />
      </View>

      <View style={[styles.searchCard, shadow]}>
        <View style={styles.searchHead}>
          <View style={styles.searchIcon}>
            <Ionicons name="navigate" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.h2}>Find your daily commute</Text>
            <Text style={type.small}>Set your route and days to match verified rides.</Text>
          </View>
        </View>

        <LocationInput label="From" placeholder="Enter pickup location" value={pickup} onChangeText={setPickup} />
        <LocationInput label="To" placeholder="Enter drop location" value={dropoff} onChangeText={setDropoff} />

        <Pressable onPress={() => setDaysOpen(true)} style={styles.input} accessibilityLabel="Select commute days">
          <Ionicons name="calendar-outline" size={22} color={colors.teal} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.inputLabel}>Commute Days</Text>
            <Text style={styles.inputValue}>{daysLabel(days)}</Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.navySoft} />
        </Pressable>

        <View style={styles.perks}>
          {["Verified providers", "Fixed monthly pass"].map((p) => (
            <View key={p} style={styles.perk}>
              <Ionicons name="checkmark-circle" size={15} color={colors.teal} />
              <Text style={styles.perkText}>{p}</Text>
            </View>
          ))}
        </View>

        <Button title="Search Commutes" icon="search" onPress={search} />
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
        <SectionTitle
          icon="star"
          title="Featured Routes"
          subtitle="Curated commutes with verified providers"
          right={
            <Pressable onPress={() => router.push("/(tabs)/routes")} hitSlop={8}>
              <Text style={{ color: colors.teal, fontWeight: "700" }}>View All</Text>
            </Pressable>
          }
        />
        <View style={{ height: 14 }} />
        {isLoading ? (
          <Loading />
        ) : featured.length ? (
          featured.map((route) => <RouteCard key={route.routeId || route._id} route={route} onBook={book} />)
        ) : (
          <EmptyState icon="bus-outline" title="No routes available yet" message="Check back soon — new verified routes are added regularly." />
        )}
      </View>

      <Modal visible={daysOpen} transparent animationType="slide" onRequestClose={() => setDaysOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setDaysOpen(false)} />
        <View style={styles.sheet}>
          <Text style={[type.h2, { marginBottom: 14 }]}>Commute days</Text>
          <ScrollView horizontal={false} contentContainerStyle={styles.dayWrap}>
            {WEEK_DAYS.map((d) => (
              <Chip key={d} label={d} active={days.includes(d)} onPress={() => toggleDay(d)} />
            ))}
          </ScrollView>
          <View style={{ height: 18 }} />
          <Button title="Done" icon="checkmark" onPress={() => setDaysOpen(false)} disabled={!days.length} />
        </View>
      </Modal>
    </Screen>
  );
}

function LocationInput({ label, ...props }) {
  return (
    <View style={styles.input}>
      <Ionicons name="location" size={22} color={colors.teal} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TextInput {...props} placeholderTextColor={colors.subtle} style={styles.inputValue} returnKeyType="search" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", minHeight: 190, marginBottom: 6, overflow: "hidden" },
  heroBus: { position: "absolute", right: -30, top: 0, bottom: 0, width: "62%", opacity: 0.95 },
  searchCard: { marginHorizontal: 20, backgroundColor: "#fff", borderRadius: radius.xl, padding: 16, borderWidth: 1, borderColor: colors.border },
  searchHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  searchIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.tealDark, alignItems: "center", justifyContent: "center" },
  input: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.tealTint,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  inputLabel: { fontSize: 11, color: colors.muted, fontWeight: "600" },
  inputValue: { fontSize: 15, fontWeight: "600", color: colors.navy, paddingVertical: 2 },
  perks: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 },
  perk: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.tealSoft },
  perkText: { fontSize: 12, fontWeight: "600", color: colors.tealDark },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32 },
  dayWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});

export const _unused = LinearGradient;
