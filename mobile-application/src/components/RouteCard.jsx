import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, radius, shadow, type } from "../theme";
import { Badge } from "./ui";
import { WEEK_DAYS, formatDateNumeric, formatMoney, normalizeDay } from "../utils/format";
import { routeCurrency, uniqueTripTimes } from "../hooks/useRoutes";
import { resolveImage } from "./AppHeader";

export function RouteCard({ route, onBook }) {
  const currency = routeCurrency(route);
  const days = new Set((route.availableDays || []).map(normalizeDay));
  const times = uniqueTripTimes(route);
  const stops = (route.allStops || route.scheduleStops || []).map((s) => s.location || s).filter(Boolean);
  const logo = resolveImage(route.companyLogo);

  return (
    <View style={[styles.card, shadow]}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
        <Image source={require("../../assets/images/hero-bus.png")} style={styles.bannerImg} contentFit="cover" />
        <View style={styles.bannerTop}>
          {route.isFeatured ? <Badge label="FEATURED" icon="star" tone="warning" /> : <View />}
          <Badge label="VERIFIED" icon="shield-checkmark" tone="success" />
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.operatorRow}>
          <View style={styles.logo}>
            {logo ? <Image source={{ uri: logo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="business" size={20} color={colors.warning} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.h3} numberOfLines={1}>{route.operator}</Text>
            <Text style={type.small}>Verified provider</Text>
          </View>
          <View style={styles.seats}>
            <Ionicons name="people" size={13} color={colors.tealDark} />
            <Text style={styles.seatsText}>
              {route.availableSeats ?? "-"}/{route.totalSeats ?? "-"}
            </Text>
          </View>
        </View>

        <View style={styles.pathRow}>
          <View style={{ flex: 1 }}>
            <Text style={type.caption}>From</Text>
            <Text style={styles.place} numberOfLines={1}>{route.fromLocation}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={colors.teal} />
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={type.caption}>To</Text>
            <Text style={styles.place} numberOfLines={1}>{route.toLocation}</Text>
          </View>
        </View>

        <View style={styles.daysRow}>
          {WEEK_DAYS.map((d) => (
            <View key={d} style={[styles.day, days.has(d) ? styles.dayOn : styles.dayOff]}>
              <Text style={[styles.dayText, { color: days.has(d) ? colors.tealDark : colors.subtle }]}>{d[0]}</Text>
            </View>
          ))}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <Ionicons name="time-outline" size={15} color={colors.tealDark} />
            <Text style={styles.metaText} numberOfLines={1}>{times.slice(0, 3).join("  |  ") || "Flexible"}</Text>
          </View>
          <View style={styles.meta}>
            <Ionicons name="calendar-outline" size={15} color={colors.tealDark} />
            <Text style={styles.metaText}>{formatDateNumeric(route.startDate)}</Text>
          </View>
        </View>

        {stops.length ? (
          <Text style={[type.small, { marginTop: 8 }]} numberOfLines={1}>
            Stops: {stops.slice(0, 2).join(", ")}
            {stops.length > 2 ? `  +${stops.length - 2}` : ""}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <View>
            <Text style={type.caption}>Monthly pass</Text>
            <Text style={styles.price}>{formatMoney(route.monthlyPrice, currency)}</Text>
          </View>
          <Pressable onPress={() => onBook(route)} style={({ pressed }) => [styles.book, pressed && { opacity: 0.85 }]}>
            <Text style={styles.bookText}>Book This Route</Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  banner: { height: 84, justifyContent: "flex-start" },
  bannerImg: { ...StyleSheet.absoluteFillObject, opacity: 0.55 },
  bannerTop: { flexDirection: "row", justifyContent: "space-between", padding: 12 },
  body: { padding: 16 },
  operatorRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.warningSoft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  seats: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.tealSoft },
  seatsText: { fontSize: 12, fontWeight: "800", color: colors.tealDark },
  pathRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16, padding: 12, borderRadius: radius.md, backgroundColor: colors.tealTint },
  place: { fontSize: 15, fontWeight: "700", color: colors.navy, marginTop: 2 },
  daysRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  day: { width: 36, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dayOn: { backgroundColor: colors.tealSoft },
  dayOff: { backgroundColor: "#F1F5F9" },
  dayText: { fontSize: 11, fontWeight: "800" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, gap: 12 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  metaText: { fontSize: 13, color: colors.navySoft, fontWeight: "600" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  price: { fontSize: 20, fontWeight: "800", color: colors.navy, marginTop: 2 },
  book: { flexDirection: "row", alignItems: "center", gap: 4, height: 44, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: colors.teal },
  bookText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
