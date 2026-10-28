import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useFocusEffect } from "expo-router";
import { Screen } from "../src/components/Screen";
import { AppHeader } from "../src/components/AppHeader";
import { PageHero } from "../src/components/PageHero";
import { Badge, Button, Card, Chip, EmptyState, Field, Loading } from "../src/components/ui";
import { subscriptionService } from "../src/services";
import { formatDateNumeric, formatMoney } from "../src/utils/format";
import { colors, radius } from "../src/theme";

const BENEFITS = [
  { icon: "location-outline", title: "Unlimited Rides", sub: "Travel on all your pass days" },
  { icon: "star-outline", title: "Priority Booking", sub: "Get priority for your preferred routes" },
  { icon: "notifications-outline", title: "Exclusive Updates", sub: "Receive latest services and route updates" },
  { icon: "shield-checkmark-outline", title: "Secure & Reliable", sub: "Enjoy a safe and comfortable journey" },
];

const METHODS = [
  { value: "SAME_CARD", label: "Card", icon: "card-outline" },
  { value: "WALLET", label: "Wallet", icon: "wallet-outline" },
  { value: "CASH", label: "Cash", icon: "cash-outline" },
];

const MONTH_OPTIONS = [1, 3, 6, 12];

export default function SubscriptionsScreen() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const res = await subscriptionService.settings();
      setData(res?.data || null);
      const passes = res?.data?.settings?.activePasses || [];
      setSelectedId((prev) => (prev && passes.some((p) => String(p._id) === prev) ? prev : passes[0] ? String(passes[0]._id) : ""));
    } catch (e) {
      setError(e?.response?.data?.message || "Could not load subscription settings.");
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

  const settings = data?.settings;
  const passes = settings?.activePasses || [];
  const pass = passes.find((p) => String(p._id) === selectedId) || settings?.activePass || null;
  const method = settings?.renewalPaymentMethod || "SAME_CARD";

  const save = async (patch) => {
    if (!settings) return;
    const payload = {
      autoRenewal: settings.autoRenewal,
      renewalReminderDays: Number(settings.renewalReminderDays) || 7,
      renewalPaymentMethod: method,
      emailNotifications: settings.emailNotifications?.renewalReminder ?? true,
      smsNotifications: settings.smsNotifications?.renewalReminder ?? false,
      ...patch,
    };
    setData((d) => ({
      ...d,
      settings: {
        ...d.settings,
        autoRenewal: payload.autoRenewal,
        renewalPaymentMethod: payload.renewalPaymentMethod,
      },
    }));
    try {
      await subscriptionService.update(payload);
    } catch (e) {
      Alert.alert("Could not save", e?.response?.data?.message || "Please try again.");
      load(false);
    }
  };

  const renew = async () => {
    if (!pass) return;
    setBusy(true);
    try {
      const res = await subscriptionService.renew({ paymentMethod: method, passId: String(pass._id), renewalMonths: months });
      const payment = res?.data?.payment;
      if (res?.data?.paymentRequired && payment?.paymentUrl) {
        await WebBrowser.openBrowserAsync(payment.paymentUrl);
      } else {
        Alert.alert("Renewed", res?.message || "Monthly pass renewed successfully.");
      }
      load(false);
    } catch (e) {
      Alert.alert("Could not renew", e?.response?.data?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!reason.trim()) {
      Alert.alert("Reason required", "Please tell us why you are cancelling.");
      return;
    }
    setBusy(true);
    try {
      await subscriptionService.cancel({ reason: reason.trim() });
      setCancelling(false);
      setReason("");
      load(false);
    } catch (e) {
      Alert.alert("Could not cancel", e?.response?.data?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/more"))} />} refreshing={refreshing} onRefresh={() => load(true)} decor>
      <PageHero eyebrow="Subscription" title="Subscription Settings" subtitle="View and manage your current plan, benefits and payment details." icon="ribbon-outline" />

      {loading ? (
        <Loading label="Loading subscription..." />
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Something went wrong" message={error} />
      ) : !pass ? (
        <EmptyState
          icon="ribbon-outline"
          title="No active plan"
          message="Book a monthly route to start a commuter pass."
          action={<Button title="Browse Routes" onPress={() => router.push("/(tabs)/routes")} />}
        />
      ) : (
        <>
          <View style={styles.rowBetween}>
            <Text style={styles.section}>Current Plan</Text>
            <Badge label="Active" tone="success" icon="ellipse" />
          </View>

          {passes.length > 1 ? (
            <View style={styles.chips}>
              {passes.map((p, i) => (
                <Chip key={String(p._id)} label={p.routeLabel || `Pass ${i + 1}`} active={String(p._id) === selectedId} onPress={() => setSelectedId(String(p._id))} />
              ))}
            </View>
          ) : null}

          <Card style={{ padding: 14 }}>
            <View style={styles.planTop}>
              <View style={styles.planIcon}>
                <Ionicons name="ribbon" size={28} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>Commuter Pass</Text>
                <Text style={styles.planSub} numberOfLines={1}>
                  {pass.routeLabel || "Monthly Subscription"}
                </Text>
              </View>
            </View>
            <View style={styles.planStats}>
              <Stat icon="calendar-outline" label="Valid until" value={formatDateNumeric(pass.endDate)} />
              <Stat icon="refresh-outline" label="Next renewal" value={settings.autoRenewal ? "Auto-renews" : "Manual"} />
              <Stat icon="wallet-outline" label="Amount" value={formatMoney(pass.totalAmount, pass.currency || "AED")} />
            </View>
          </Card>

          <Text style={[styles.section, { marginTop: 22 }]}>Subscription Benefits</Text>
          <Card style={{ padding: 4 }}>
            {BENEFITS.map((b, i) => (
              <View key={b.title} style={[styles.benefit, i > 0 && styles.benefitBorder]}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={b.icon} size={22} color={colors.teal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitSub}>{b.sub}</Text>
                </View>
              </View>
            ))}
          </Card>

          <Text style={[styles.section, { marginTop: 22 }]}>Payment Method</Text>
          <View style={styles.chips}>
            {METHODS.map((m) => (
              <Chip key={m.value} label={m.label} icon={m.icon} active={method === m.value} onPress={() => save({ renewalPaymentMethod: m.value })} />
            ))}
          </View>
          {method === "WALLET" ? (
            <Text style={styles.hint}>Wallet balance: {formatMoney(data?.walletBalance || 0, data?.walletCurrency || "AED")}</Text>
          ) : null}

          <Text style={[styles.section, { marginTop: 22 }]}>Auto-Renewal</Text>
          <Card style={styles.switchCard}>
            <View style={styles.planIconSoft}>
              <Ionicons name="sync" size={24} color={colors.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.benefitTitle}>Enable Auto-Renewal</Text>
              <Text style={styles.benefitSub}>Your subscription renews automatically at the end of the current cycle.</Text>
            </View>
            <Switch value={!!settings.autoRenewal} onValueChange={(v) => save({ autoRenewal: v })} trackColor={{ true: colors.teal, false: colors.border }} thumbColor="#fff" />
          </Card>

          <Text style={[styles.section, { marginTop: 22 }]}>Renew Pass</Text>
          <View style={styles.chips}>
            {MONTH_OPTIONS.map((m) => (
              <Chip key={m} label={`${m} ${m > 1 ? "months" : "month"}`} active={months === m} onPress={() => setMonths(m)} />
            ))}
          </View>
          <Button title={method === "SAME_CARD" ? "Renew with Card" : method === "WALLET" ? "Renew from Wallet" : "Request Cash Renewal"} onPress={renew} loading={busy} />

          {cancelling ? (
            <Card style={{ marginTop: 18 }}>
              <Field label="Reason for cancelling" placeholder="Tell us why" value={reason} onChangeText={setReason} multiline />
              <Button title="Confirm Cancellation" variant="danger" onPress={cancel} loading={busy} />
              <Pressable onPress={() => setCancelling(false)} style={styles.link}>
                <Text style={styles.linkText}>Keep my subscription</Text>
              </Pressable>
            </Card>
          ) : (
            <Pressable onPress={() => setCancelling(true)} style={styles.link}>
              <Text style={[styles.linkText, { color: colors.danger }]}>Cancel Subscription</Text>
            </Pressable>
          )}

          <Pressable onPress={() => Linking.openURL("mailto:support@drivemego.com")} style={styles.help}>
            <Ionicons name="information-circle-outline" size={22} color={colors.tealDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.benefitTitle}>Need help with your subscription?</Text>
              <Text style={styles.benefitSub}>Contact support for any assistance or queries.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.navy} />
          </Pressable>
        </>
      )}
    </Screen>
  );
}

function Stat({ icon, label, value }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={20} color={colors.navy} />
      <View style={{ flex: 1 }}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  section: { fontSize: 17, fontWeight: "800", color: colors.navy, marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  planTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  planIcon: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center" },
  planIconSoft: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  planTitle: { fontSize: 18, fontWeight: "800", color: colors.navy },
  planSub: { fontSize: 13, color: colors.muted },
  planStats: { flexDirection: "row", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  stat: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  statLabel: { fontSize: 10.5, color: colors.muted, textTransform: "uppercase" },
  statValue: { fontSize: 12.5, fontWeight: "800", color: colors.navy },
  benefit: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  benefitBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  benefitIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  benefitTitle: { fontSize: 14.5, fontWeight: "800", color: colors.navy },
  benefitSub: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  switchCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  hint: { fontSize: 12.5, color: colors.muted, marginBottom: 8 },
  link: { alignItems: "center", paddingVertical: 14 },
  linkText: { fontSize: 14, fontWeight: "700", color: colors.tealDark },
  help: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: colors.tealSoft, marginTop: 4 },
});
