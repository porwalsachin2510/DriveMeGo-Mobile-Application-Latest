import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { PartnerHeader, StatTile } from "../../src/components/partner";
import { Badge, Card, Loading } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { partnerService } from "../../src/services/partner";
import { formatDate, formatDateNumeric, formatMoney } from "../../src/utils/format";
import { colors, radius, shadow, type } from "../../src/theme";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good Morning," : h < 17 ? "Good Afternoon," : "Good Evening,";
};

export default function PartnerHome() {
  const router = useRouter();
  const { user } = useAuth();
  const [showRenewals, setShowRenewals] = useState(true);

  const stats = useQuery({ queryKey: ["partner", "stats"], queryFn: partnerService.dashboardStats });
  const renewals = useQuery({ queryKey: ["partner", "renewals"], queryFn: partnerService.renewals });
  const routes = useQuery({ queryKey: ["partner", "routes"], queryFn: partnerService.routes });

  const s = stats.data?.stats || {};
  const currency = s.currency || "AED";
  const money = (v) => formatMoney(v, currency).replace(/\.00(?= )/, "");
  const summary = renewals.data?.data?.summary || {};
  const renewalRows = (renewals.data?.data?.renewals || []).slice(0, 5);
  const recent = (routes.data?.routes || []).slice(0, 3);
  const perRoute = Object.fromEntries((s.subscribersPerRoute || []).map((r) => [String(r.routeId), r]));
  const refreshing = stats.isRefetching || renewals.isRefetching || routes.isRefetching;
  const refresh = () => {
    stats.refetch();
    renewals.refetch();
    routes.refetch();
  };

  return (
    <Screen header={<PartnerHeader />} tabBarSpace refreshing={refreshing} onRefresh={refresh}>
      <LinearGradient colors={["#DDF4F8", "#F1FAFC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={{ flex: 1, zIndex: 1 }}>
          <Text style={[type.small, { color: colors.navySoft }]}>{greeting()}</Text>
          <Text style={[type.h1, { fontSize: 24 }]} numberOfLines={1}>
            {user?.fullName || "Partner"}
          </Text>
          <Text style={{ color: colors.tealDark, fontWeight: "700", marginTop: 2 }}>B2C Partner</Text>
          <Text style={[type.small, { marginTop: 10, fontSize: 11 }]}>Last login: {formatDate(user?.lastLogin || new Date())}</Text>
        </View>
        <Image source={require("../../assets/images/hero-bus.png")} style={styles.bus} contentFit="cover" />
      </LinearGradient>

      {stats.isLoading ? (
        <Loading />
      ) : (
        <>
          <View style={styles.grid}>
            <StatTile icon="home-outline" value={s.activeRoutes ?? 0} label="Active Routes" onPress={() => router.push("/partner/routes")} style={styles.half} />
            <StatTile icon="people-outline" tint={colors.success} soft={colors.successSoft} value={s.activeSubscribers ?? 0} label="Active Subscribers" style={styles.half} />
            <StatTile icon="cash-outline" tint={colors.warning} soft={colors.warningSoft} value={money(s.monthlyRevenue || 0)} label="Monthly Revenue" onPress={() => router.push("/partner/earnings")} style={styles.half} />
            <StatTile icon="calendar-outline" tint={colors.info} soft={colors.infoSoft} value={s.upcomingTrips ?? 0} label="Upcoming Trips" onPress={() => router.push("/partner/trips")} style={styles.half} />
            <StatTile icon="chatbox-ellipses-outline" tint={colors.danger} soft={colors.dangerSoft} value={s.pendingRouteRequests ?? 0} label="Pending Route Requests" onPress={() => router.push("/partner/requests")} style={styles.half} />
            <StatTile icon="refresh-outline" tint="#7C3AED" soft="#F1EAFE" value={s.renewalsPending ?? 0} label="Renewals Due (7d)" style={styles.half} />
          </View>

          <View style={styles.rowBetween}>
            <View style={styles.row}>
              <Ionicons name="location" size={20} color={colors.teal} />
              <Text style={type.h2}>Recent Routes</Text>
            </View>
            <Pressable onPress={() => router.push("/partner/routes")} hitSlop={8}>
              <Text style={styles.link}>View All</Text>
            </Pressable>
          </View>

          {recent.length === 0 && !routes.isLoading ? (
            <Card style={{ alignItems: "center", paddingVertical: 24 }}>
              <Text style={type.small}>You have not created any routes yet.</Text>
            </Card>
          ) : (
            recent.map((r) => {
              const subs = perRoute[String(r._id)]?.activeSubscribers ?? 0;
              return (
                <Pressable key={r._id} onPress={() => router.push("/partner/routes")} style={[styles.routeRow, shadow]}>
                  <View style={styles.pins}>
                    <Ionicons name="location" size={20} color={colors.teal} />
                    <Ionicons name="location" size={20} color={colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.h3} numberOfLines={1}>
                      {r.fromLocation} {"\u2192"} {r.toLocation}
                    </Text>
                    <Text style={type.small}>
                      {subs} Active Subscriber{subs === 1 ? "" : "s"} {"\u00B7"} {r.totalSeats || 0} Seats
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
                </Pressable>
              );
            })
          )}

          <View style={styles.totals}>
            <Card style={styles.total}>
              <Text style={type.caption}>Total Revenue</Text>
              <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>
                {money(s.totalRevenue || 0)}
              </Text>
            </Card>
            <Card style={styles.total}>
              <Text style={type.caption}>Subscribers</Text>
              <Text style={styles.totalValue}>{s.totalSubscribers ?? 0}</Text>
            </Card>
            <Card style={styles.total}>
              <Text style={type.caption}>Route Requests</Text>
              <Text style={styles.totalValue}>{s.totalRouteRequests ?? 0}</Text>
            </Card>
          </View>

          <View style={styles.rowBetween}>
            <View style={styles.row}>
              <Ionicons name="refresh" size={20} color={colors.teal} />
              <Text style={type.h2}>Subscription Renewals</Text>
            </View>
            <Pressable onPress={() => setShowRenewals((v) => !v)} hitSlop={8} style={styles.row}>
              <Text style={styles.link}>{showRenewals ? "Hide Details" : "Show Details"}</Text>
              <Ionicons name={showRenewals ? "chevron-up" : "chevron-down"} size={14} color={colors.teal} />
            </Pressable>
          </View>

          <View style={styles.summary}>
            <Summary icon="checkmark-circle-outline" value={summary.active ?? 0} label="Active" tint={colors.success} bg={colors.successSoft} />
            <Summary icon="time-outline" value={summary.expiringSoon ?? 0} label="Expiring" tint={colors.warning} bg={colors.warningSoft} />
            <Summary icon="calendar-outline" value={summary.renewalUpcoming ?? 0} label="Due" tint={colors.info} bg={colors.infoSoft} />
            <Summary icon="alert-circle-outline" value={summary.expired ?? 0} label="Expired" tint={colors.danger} bg={colors.dangerSoft} />
            <Summary icon="repeat-outline" value={summary.autoRenewalEnabled ?? 0} label="Auto-Renew" tint="#7C3AED" bg="#F1EAFE" />
          </View>

          {showRenewals ? (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {renewalRows.length === 0 ? (
                <Text style={[type.small, { padding: 18, textAlign: "center" }]}>No active subscriptions yet.</Text>
              ) : (
                renewalRows.map((r, i) => (
                  <View key={r.passId} style={[styles.renewalRow, i > 0 && styles.divider]}>
                    <View style={{ flex: 1 }}>
                      <Text style={type.h3} numberOfLines={1}>
                        {r.passenger?.name || r.passenger?.email || "Passenger"}
                      </Text>
                      <Text style={type.small} numberOfLines={1}>
                        {r.route?.fromLocation} {"\u2192"} {r.route?.toLocation}
                      </Text>
                      <Text style={[type.small, { fontSize: 12 }]}>
                        Ends {formatDateNumeric(r.endDate)} {"\u00B7"} {r.passType === "ROUND_TRIP" ? "Round Trip" : "One Way"}
                      </Text>
                    </View>
                    <Badge
                      label={r.renewalStatus === "active" ? "Active" : r.renewalStatus === "expired" ? "Expired" : r.renewalStatus === "expiring_soon" ? "Expiring" : "Due"}
                      tone={r.renewalStatus === "active" ? "success" : r.renewalStatus === "expired" ? "danger" : "warning"}
                    />
                  </View>
                ))
              )}
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Summary({ icon, value, label, tint, bg }) {
  return (
    <View style={[styles.sum, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={[styles.sumValue, { color: tint }]}>{value}</Text>
      <Text style={styles.sumLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", padding: 18, borderRadius: 24, overflow: "hidden", marginBottom: 16, minHeight: 130 },
  bus: { position: "absolute", right: -20, bottom: 0, width: 190, height: 120, opacity: 0.95 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  half: { width: "47.8%" },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, marginTop: 4 },
  link: { color: colors.teal, fontWeight: "700", fontSize: 14 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: "#fff", marginBottom: 10, borderWidth: 1, borderColor: "rgba(227,238,243,0.7)" },
  pins: { width: 36, alignItems: "center", gap: 2 },
  totals: { flexDirection: "row", gap: 10, marginVertical: 12 },
  total: { flex: 1, padding: 12, borderRadius: radius.lg },
  totalValue: { fontSize: 16, fontWeight: "800", color: colors.navy, marginTop: 4 },
  summary: { flexDirection: "row", gap: 6, marginBottom: 12 },
  sum: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.md, gap: 2 },
  sumValue: { fontSize: 16, fontWeight: "800" },
  sumLabel: { fontSize: 9, color: colors.muted, fontWeight: "600" },
  renewalRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
