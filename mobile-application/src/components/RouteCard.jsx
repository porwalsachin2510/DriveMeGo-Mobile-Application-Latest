import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow, type } from "../theme";
import { WEEK_DAYS, formatDateNumeric, formatMoney, normalizeDay } from "../utils/format";
import { routeCurrency, uniqueTripTimes } from "../hooks/useRoutes";
import { resolveImage } from "./AppHeader";

const WEEKEND = new Set(["Sat", "Sun"]);

export const routeRating = (route) => {
  const r = Number(route?.rating ?? route?.averageRating ?? route?.partnerRating);
  return Number.isFinite(r) && r > 0 ? r.toFixed(1) : null;
};

export const routeStops = (route) =>
  (route?.allStops || route?.scheduleStops || route?.stops || [])
    .map((s) => (typeof s === "string" ? s : s?.location))
    .filter(Boolean);

export function RouteCard({ route, onBook }) {
  const currency = routeCurrency(route);
  const days = new Set((route.availableDays || []).map(normalizeDay).filter(Boolean));
  const times = uniqueTripTimes(route);
  const stops = Array.from(new Set(routeStops(route)));
  const logo = resolveImage(route.companyLogo);
  const rating = routeRating(route);
  const soldOut = route.availableSeats === 0;

  return (
    <View style={[styles.card, shadow]}>
      <LinearGradient colors={["rgba(255,255,255,0)", "#D8F3F6"]} start={{ x: 0.35, y: 0 }} end={{ x: 1, y: 0.2 }} style={styles.corner}>
        <Image source={require("../../assets/images/hero-bus.png")} style={styles.cornerImg} contentFit="cover" />
      </LinearGradient>

      <View style={styles.topRow}>
        {route.isFeatured ? (
          <View style={styles.featured}>
            <Ionicons name="star" size={12} color={colors.success} />
            <Text style={styles.featuredText}>FEATURED</Text>
          </View>
        ) : (
          <View />
        )}
        <View style={styles.verified}>
          <Ionicons name="shield-checkmark" size={13} color={colors.teal} />
          <Text style={styles.verifiedText}>VERIFIED</Text>
        </View>
      </View>

      <View style={styles.operatorRow}>
        <View style={styles.logo}>
          {logo ? (
            <Image source={{ uri: logo }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Ionicons name="business" size={22} color={colors.warning} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.operator} numberOfLines={1}>{route.operator || "Verified partner"}</Text>
          <Text style={type.small}>Verified provider</Text>
        </View>
        {rating ? (
          <View style={styles.rating}>
            <Ionicons name="star" size={13} color="#F59E0B" />
            <Text style={styles.ratingText}>{rating}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.divider} />

      <View style={styles.pathRow}>
        <Ionicons name="location" size={20} color={colors.teal} />
        <View style={{ flex: 1 }}>
          <Text style={styles.metaLabel}>From</Text>
          <Text style={styles.place} numberOfLines={1}>{route.fromLocation}</Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color={colors.subtle} />
        <View style={{ flex: 1 }}>
          <Text style={styles.metaLabel}>To</Text>
          <Text style={styles.place} numberOfLines={1}>{route.toLocation}</Text>
        </View>
        <View style={styles.startBox}>
          <Text style={styles.metaLabel}>Start Date</Text>
          <Text style={styles.startDate}>{formatDateNumeric(route.startDate)}</Text>
        </View>
      </View>

      <Label icon="calendar-clear-outline" text="Available Days" />
      <View style={styles.wrap}>
        {WEEK_DAYS.map((d) => {
          const on = days.size === 0 || days.has(d);
          const weekend = WEEKEND.has(d);
          return (
            <View
              key={d}
              style={[styles.dayPill, { backgroundColor: !on ? "#F1F5F9" : weekend ? colors.warningSoft : colors.tealSoft }]}
            >
              <Text style={[styles.dayText, { color: !on ? colors.subtle : weekend ? colors.warning : colors.tealDark }]}>{d}</Text>
            </View>
          );
        })}
      </View>

      <Label icon="time-outline" text="Trip Times" />
      <View style={styles.wrap}>
        {times.length ? (
          times.slice(0, 6).map((t) => (
            <View key={t} style={styles.timePill}>
              <Text style={styles.timeText}>{t}</Text>
            </View>
          ))
        ) : (
          <Text style={type.small}>Arranged with provider</Text>
        )}
      </View>

      {stops.length ? (
        <>
          <Label icon="location-outline" text="Route Stops" />
          <View style={styles.wrap}>
            {stops.slice(0, 3).map((s) => (
              <View key={s} style={styles.stopPill}>
                <Text style={styles.stopText} numberOfLines={1}>{s}</Text>
              </View>
            ))}
            {stops.length > 3 ? (
              <View style={styles.stopPill}>
                <Text style={styles.stopText}>+{stops.length - 3}</Text>
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      <View style={styles.footer}>
        <View>
          <Text style={styles.priceLabel}>Monthly Price</Text>
          <Text style={styles.price}>{formatMoney(route.monthlyPrice ?? route.pricing?.monthlyOneWayPrice, currency)}</Text>
          {typeof route.availableSeats === "number" ? (
            <Text style={[type.small, { color: soldOut ? colors.danger : colors.muted }]}>
              {soldOut ? "Fully booked" : `${route.availableSeats} seats left`}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => onBook(route)}
          disabled={soldOut}
          accessibilityRole="button"
          accessibilityLabel={`Book route from ${route.fromLocation} to ${route.toLocation}`}
          style={({ pressed }) => [{ opacity: soldOut ? 0.5 : pressed ? 0.85 : 1 }]}
        >
          <LinearGradient colors={["#19C3CF", "#0AA5B3"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.book}>
            <Text style={styles.bookText}>{soldOut ? "Full" : "Book This Route"}</Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function Label({ icon, text }) {
  return (
    <View style={styles.label}>
      <Ionicons name={icon} size={15} color={colors.muted} />
      <Text style={styles.labelText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    padding: 16,
  },
  corner: { position: "absolute", top: 0, right: 0, width: "48%", height: 128, borderBottomLeftRadius: 80, overflow: "hidden" },
  cornerImg: { ...StyleSheet.absoluteFillObject, opacity: 0.5 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  featured: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
  },
  featuredText: { fontSize: 11, fontWeight: "800", color: colors.success, letterSpacing: 0.4 },
  verified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "#fff",
  },
  verifiedText: { fontSize: 11, fontWeight: "800", color: colors.teal, letterSpacing: 0.4 },
  operatorRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.warningSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  operator: { fontSize: 16, fontWeight: "800", color: colors.navy },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "#fff",
  },
  ratingText: { fontSize: 13, fontWeight: "800", color: colors.warning },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  pathRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaLabel: { fontSize: 12, color: colors.muted },
  place: { fontSize: 14, fontWeight: "700", color: colors.navy, marginTop: 1 },
  startBox: { paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: colors.border },
  startDate: { fontSize: 13, fontWeight: "700", color: colors.navy, marginTop: 1 },
  label: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, marginBottom: 8 },
  labelText: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dayPill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.pill },
  dayText: { fontSize: 12, fontWeight: "700" },
  timePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.successSoft },
  timeText: { fontSize: 12, fontWeight: "700", color: colors.success },
  stopPill: {
    maxWidth: 140,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.tealTint,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stopText: { fontSize: 11, fontWeight: "600", color: colors.navySoft },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, gap: 10 },
  priceLabel: { fontSize: 13, color: colors.muted },
  price: { fontSize: 22, fontWeight: "800", color: colors.navy, marginTop: 1 },
  book: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 46,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
  },
  bookText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
