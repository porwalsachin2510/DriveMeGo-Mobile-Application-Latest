import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { AppHeader } from "../src/components/AppHeader";
import { Button, Card, EmptyState } from "../src/components/ui";
import { bookingService, walletService } from "../src/services";
import { routeStore } from "../src/lib/routeStore";
import { formatMoney } from "../src/utils/format";
import { colors, radius, type } from "../src/theme";

export default function Payment() {
  const router = useRouter();
  const qc = useQueryClient();
  const draft = routeStore.getDraft();
  const [method, setMethod] = useState("STRIPE");
  const [busy, setBusy] = useState(false);

  const { data: wallet } = useQuery({ queryKey: ["wallet", "balance"], queryFn: walletService.balance });
  const balance = Number(wallet?.balance ?? wallet?.data?.balance ?? wallet?.wallet?.balance ?? 0);

  if (!draft) {
    return (
      <Screen header={<AppHeader onBack={() => router.back()} />}>
        <EmptyState icon="card-outline" title="No booking in progress" message="Pick a route to start a booking." action={<Button title="Find Routes" onPress={() => router.replace("/(tabs)/routes")} />} />
      </Screen>
    );
  }

  const { payload, currency } = draft;
  const walletOk = balance >= payload.totalAmount;

  const options = [
    { key: "STRIPE", icon: "card", title: "Credit/Debit Card", sub: "Pay securely with Stripe", color: colors.tealDark, bg: colors.tealSoft },
    {
      key: "WALLET",
      icon: "wallet",
      title: "Wallet Balance",
      sub: walletOk ? `${formatMoney(balance, currency)} available` : `Insufficient balance (${formatMoney(balance, currency)} available)`,
      color: colors.navySoft,
      bg: "#EEF2F6",
      disabled: !walletOk,
    },
    { key: "CASH", icon: "cash", title: "Cash Payment", sub: "Pay to driver on ride", color: colors.success, bg: colors.successSoft },
  ];

  const pay = async () => {
    setBusy(true);
    try {
      const res = await bookingService.createMonthlyPass({ ...payload, paymentMethod: method });
      if (!res.success) throw new Error(res.message || "Failed to create monthly pass");
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      const url = res.payment?.paymentUrl;
      if (url) {
        await WebBrowser.openBrowserAsync(url);
      }
      routeStore.clear();
      router.replace("/(tabs)/trips");
    } catch (e) {
      Alert.alert("Booking failed", e?.response?.data?.message || e.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<AppHeader onBack={() => router.back()} />}
      footer={<Button title="Continue" onPress={pay} loading={busy} />}
    >
      <Text style={[type.caption, { color: colors.teal }]}>PAYMENT</Text>
      <Text style={type.display}>Select Payment Method</Text>
      <Text style={[type.body, { color: colors.muted, marginBottom: 18 }]}>Choose your preferred payment method to complete the booking.</Text>

      <Card style={{ marginBottom: 22 }}>
        <Text style={type.small}>Amount to Pay</Text>
        <Text style={styles.amount}>{formatMoney(payload.totalAmount, currency)}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
          <Ionicons name="shield-checkmark" size={16} color={colors.navy} />
          <Text style={type.small}>Secured by Stripe</Text>
        </View>
      </Card>

      <Text style={[type.caption, { marginBottom: 10 }]}>CHOOSE PAYMENT METHOD</Text>
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
              <Ionicons name={o.icon} size={24} color={o.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>{o.title}</Text>
              <Text style={type.small}>{o.sub}</Text>
            </View>
            <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={26} color={selected ? colors.teal : colors.subtle} />
          </Pressable>
        );
      })}

      <View style={styles.note}>
        <Ionicons name="lock-closed" size={18} color={colors.tealDark} />
        <Text style={[type.small, { flex: 1 }]}>Your payment information is encrypted and secure. PCI DSS compliant.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  amount: { fontSize: 34, fontWeight: "800", color: colors.teal, marginTop: 2 },
  option: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: radius.lg, backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.border, marginBottom: 12 },
  selected: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  note: { flexDirection: "row", gap: 10, alignItems: "center", padding: 14, borderRadius: radius.md, backgroundColor: colors.tealSoft, marginTop: 6 },
});
