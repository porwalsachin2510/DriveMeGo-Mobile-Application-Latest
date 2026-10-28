import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { AppHeader } from "../src/components/AppHeader";
import { Button, EmptyState } from "../src/components/ui";
import { bookingService, routeService, walletService } from "../src/services";
import { routeStore } from "../src/lib/routeStore";
import { formatDateNumeric, formatMoney } from "../src/utils/format";
import { colors, radius, shadow, type } from "../src/theme";

export default function Payment() {
  const router = useRouter();
  const qc = useQueryClient();
  const [draft] = useState(() => routeStore.getDraft());
  const [method, setMethod] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const { data: wallet } = useQuery({ queryKey: ["wallet", "balance"], queryFn: walletService.balance });
  const { data: settings } = useQuery({ queryKey: ["payment-settings"], queryFn: routeService.paymentSettings });
  const balance = Number(wallet?.balance ?? wallet?.data?.balance ?? wallet?.wallet?.balance ?? 0);
  const onlineEnabled = (settings?.data?.onlinePaymentsEnabled ?? settings?.onlinePaymentsEnabled) !== false;

  const total = Number(draft?.payload?.totalAmount || 0);
  const walletOk = balance >= total && total > 0;

  useEffect(() => {
    if (method) return;
    setMethod(onlineEnabled ? "STRIPE" : walletOk ? "WALLET" : "CASH");
  }, [onlineEnabled, walletOk]);

  if (!draft && !result) {
    return (
      <Screen header={<AppHeader onBack={() => router.back()} />}>
        <EmptyState
          icon="card-outline"
          title="No booking in progress"
          message="Pick a route to start a booking."
          action={<Button title="Find Routes" onPress={() => router.replace("/(tabs)/routes")} />}
        />
      </Screen>
    );
  }

  if (result) return <Success result={result} onDone={(path) => router.replace(path)} />;

  const { payload, currency, summary, route } = draft;

  const options = [
    {
      key: "STRIPE",
      icon: "card",
      title: "Credit/Debit Card",
      sub: onlineEnabled ? "Pay securely with Stripe" : "Online payments are temporarily disabled",
      color: colors.tealDark,
      bg: colors.tealSoft,
      disabled: !onlineEnabled,
    },
    {
      key: "WALLET",
      icon: "wallet",
      title: "Wallet Balance",
      sub: walletOk
        ? `${formatMoney(balance, currency)} available`
        : `Insufficient balance (${formatMoney(balance, currency)} available)`,
      color: colors.navySoft,
      bg: "#EEF2F6",
      disabled: !walletOk,
    },
    { key: "CASH", icon: "cash", title: "Cash Payment", sub: "Pay to driver on ride", color: colors.success, bg: colors.successSoft },
  ];

  const refresh = () => {
    ["bookings", "wallet", "notifications", "routes", "route-seats", "subscriptions"].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] }),
    );
  };

  const pay = async () => {
    if (!method) return Alert.alert("Select a method", "Please choose a payment method.");
    setBusy(true);
    try {
      const res = await bookingService.createMonthlyPass({ ...payload, paymentMethod: method });
      if (!res?.success) throw new Error(res?.message || "Failed to create monthly pass");
      const bookingId = res.monthlyPassBooking?.bookingId;
      const url = res.payment?.paymentUrl;

      if (url) {
        await WebBrowser.openBrowserAsync(url);
        refresh();
        routeStore.clear();
        setResult({ method, bookingId, pending: true, amount: total, currency, summary, route });
        return;
      }
      if (method === "STRIPE") throw new Error(res.message || "Payment gateway is not configured. Please try another method.");

      refresh();
      routeStore.clear();
      setResult({ method, bookingId, pending: false, amount: total, currency, summary, route });
    } catch (e) {
      Alert.alert("Booking failed", e?.response?.data?.message || e.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<AppHeader />} footer={<Button title="Continue" onPress={pay} loading={busy} disabled={!method} />}>
      <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to booking">
        <Ionicons name="arrow-back" size={20} color={colors.navy} />
        <Text style={[type.caption, { color: colors.teal, fontSize: 13 }]}>PAYMENT</Text>
      </Pressable>
      <Text style={type.display}>Select Payment Method</Text>
      <Text style={[type.body, { color: colors.muted, marginBottom: 18 }]}>
        Choose your preferred payment method to complete the booking.
      </Text>

      <LinearGradient colors={["#FFFFFF", "#E6F7F9"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.amountCard, shadow]}>
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { color: colors.navySoft }]}>Amount to Pay</Text>
          <Text style={styles.amount}>
            <Text style={{ color: colors.navy }}>{currency} </Text>
            {Number(total).toLocaleString("en-US", { minimumFractionDigits: currency === "KWD" ? 3 : 2 })}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <Ionicons name="shield-checkmark" size={16} color={colors.navy} />
            <Text style={type.small}>Secured by</Text>
            <Text style={styles.stripe}>stripe</Text>
          </View>
        </View>
        <View style={styles.cardArt}>
          <Ionicons name="card" size={44} color="#fff" />
          <View style={styles.cardShield}>
            <Ionicons name="checkmark" size={18} color="#fff" />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.tripSummary}>
        <Ionicons name="bus-outline" size={16} color={colors.tealDark} />
        <Text style={[type.small, { flex: 1, color: colors.navySoft }]} numberOfLines={2}>
          {route?.fromLocation} → {route?.toLocation} · {summary?.passType === "ROUND_TRIP" ? "Round Trip" : "One Way"} ·{" "}
          {formatDateNumeric(summary?.start)} - {formatDateNumeric(summary?.end)}
        </Text>
      </View>

      <Text style={[type.caption, { marginBottom: 10, marginTop: 18, fontSize: 13 }]}>CHOOSE PAYMENT METHOD</Text>
      {options.map((o) => {
        const selected = method === o.key;
        return (
          <Pressable
            key={o.key}
            disabled={o.disabled}
            onPress={() => setMethod(o.key)}
            style={[styles.option, selected && styles.selected, o.disabled && { opacity: 0.55 }]}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !!o.disabled }}
          >
            <View style={[styles.icon, { backgroundColor: o.bg }]}>
              <Ionicons name={o.icon} size={26} color={o.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.h3, o.disabled && { color: colors.muted }]}>{o.title}</Text>
              <Text style={type.small}>{o.sub}</Text>
            </View>
            <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={28} color={selected ? colors.tealDark : colors.subtle} />
            <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
          </Pressable>
        );
      })}

      <View style={styles.note}>
        <Ionicons name="shield-half-outline" size={24} color={colors.navy} />
        <Text style={[type.small, { flex: 1 }]}>Your payment information is encrypted and secure with Stripe.</Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.stripe}>stripe</Text>
          <Text style={[type.small, { fontSize: 11 }]}>PCI DSS Compliant</Text>
        </View>
      </View>

      <Pressable onPress={() => router.push("/(tabs)/wallet")} style={styles.info} accessibilityRole="link">
        <Ionicons name="information-circle-outline" size={22} color={colors.info} />
        <Text style={[type.small, { flex: 1, color: colors.info }]}>
          Low on wallet balance? Top up your wallet to pay instantly next time.
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.info} />
      </Pressable>
    </Screen>
  );
}

function Success({ result, onDone }) {
  const { method, bookingId, pending, amount, currency, summary, route } = result;
  const title = pending ? "Payment Submitted" : method === "CASH" ? "Booking Request Submitted" : "Booking Confirmed";
  const message = pending
    ? "Once your payment is confirmed, your monthly pass will become active. You can track it in My Trips."
    : method === "CASH"
      ? "Your pass is booked. Please pay the driver in cash on your first ride."
      : "Your monthly pass was paid from your wallet and is now active.";

  return (
    <Screen header={<AppHeader />}>
      <View style={{ alignItems: "center", marginTop: 24 }}>
        <View style={styles.successIcon}>
          <Ionicons name={pending ? "time" : "checkmark"} size={44} color="#fff" />
        </View>
        <Text style={[type.h1, { marginTop: 18, textAlign: "center" }]}>{title}</Text>
        <Text style={[type.body, { color: colors.muted, textAlign: "center", marginTop: 6 }]}>{message}</Text>
      </View>

      <View style={[styles.successCard, shadow]}>
        <Row k="Route" v={`${route?.fromLocation} → ${route?.toLocation}`} />
        <Row k="Pass Type" v={summary?.passType === "ROUND_TRIP" ? "Round Trip Monthly Pass" : "One Way Monthly Pass"} />
        <Row k="Period" v={`${formatDateNumeric(summary?.start)} - ${formatDateNumeric(summary?.end)}`} />
        <Row k="Payment" v={method === "STRIPE" ? "Card (Stripe)" : method === "WALLET" ? "Wallet" : "Cash"} />
        <Row k="Amount" v={formatMoney(amount, currency)} strong />
      </View>

      <View style={{ gap: 12, marginTop: 24 }}>
        {bookingId ? <Button title="View Booking" icon="document-text-outline" onPress={() => onDone(`/booking-details/${bookingId}`)} /> : null}
        <Button title="Go to My Trips" variant="outline" onPress={() => onDone("/(tabs)/trips")} />
      </View>
    </Screen>
  );
}

function Row({ k, v, strong }) {
  return (
    <View style={styles.row}>
      <Text style={type.small}>{k}</Text>
      <Text style={[type.body, { fontWeight: strong ? "800" : "600", flexShrink: 1, textAlign: "right", color: strong ? colors.tealDark : colors.navy }]}>
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6, alignSelf: "flex-start" },
  amountCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amount: { fontSize: 30, fontWeight: "800", color: colors.teal, marginTop: 4 },
  stripe: { fontSize: 16, fontWeight: "900", color: "#635BFF", letterSpacing: -0.3 },
  cardArt: {
    width: 86,
    height: 64,
    borderRadius: 14,
    backgroundColor: "#1D8FE1",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
  },
  cardShield: {
    position: "absolute",
    right: -10,
    bottom: -12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.teal,
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  tripSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.tealTint,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 12,
  },
  selected: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  icon: { width: 54, height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  note: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: "#EEF4F8",
    marginTop: 6,
  },
  info: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.infoSoft,
    marginTop: 12,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  successCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 8 },
});
