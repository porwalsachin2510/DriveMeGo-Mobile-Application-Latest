import { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { AppHeader } from "../../src/components/AppHeader";
import { Badge, Button, Card, EmptyState, Loading, SectionTitle } from "../../src/components/ui";
import { walletService } from "../../src/services";
import { formatDateTime, formatMoney } from "../../src/utils/format";
import { colors, gradients, radius, type } from "../../src/theme";

const PRESETS = [50, 100, 200, 500];

export const txListFrom = (d) => d?.transactions || d?.data?.transactions || d?.data || [];

export default function Wallet() {
  const qc = useQueryClient();
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);

  const bal = useQuery({ queryKey: ["wallet", "balance"], queryFn: walletService.balance });
  const tx = useQuery({ queryKey: ["wallet", "transactions"], queryFn: () => walletService.transactions(1, 20) });
  const refresh = () => Promise.all([bal.refetch(), tx.refetch()]);

  const b = bal.data?.data || bal.data || {};
  const balance = Number(b.balance ?? b.wallet?.balance ?? 0);
  const currency = b.currency || b.wallet?.currency || "AED";
  const list = txListFrom(tx.data);
  const spent = list.filter((t) => ["DEBIT", "PAYMENT", "PURCHASE"].includes(String(t.type).toUpperCase()) || Number(t.amount) < 0);
  const totalSpent = spent.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

  const topUp = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 1) return Alert.alert("Invalid amount", "Enter a valid amount to add.");
    setBusy(true);
    try {
      const res = await walletService.createPaymentSession({ amount: value, currency });
      const url = res.paymentUrl || res.url || res.data?.paymentUrl || res.data?.url;
      if (!url) throw new Error(res.message || "Payment session unavailable");
      setOpen(false);
      await WebBrowser.openBrowserAsync(url);
      qc.invalidateQueries({ queryKey: ["wallet"] });
    } catch (e) {
      Alert.alert("Top up failed", e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<AppHeader />} tabBarSpace refreshing={bal.isRefetching || tx.isRefetching} onRefresh={refresh}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
        <View style={styles.bannerIcon}><Ionicons name="wallet" size={26} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={[type.caption, { color: "rgba(255,255,255,0.8)" }]}>Your money, sorted</Text>
          <Text style={[type.h1, { color: "#fff" }]}>My Wallet</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>Top up and pay for every ride in a tap.</Text>
        </View>
      </LinearGradient>

      <Card>
        <Pressable onPress={() => setHidden((h) => !h)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[type.h3, { color: colors.info }]}>Current Balance</Text>
          <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={18} color={colors.info} />
        </Pressable>
        {bal.isLoading ? <Loading /> : <Text style={styles.balance}>{hidden ? "••••••" : formatMoney(balance, currency)}</Text>}
        <View style={{ flexDirection: "row", gap: 10, marginVertical: 14 }}>
          <Stat icon="time-outline" label="Transactions" value={String(list.length)} />
          <Stat icon="wallet-outline" label="Total Spent" value={formatMoney(totalSpent, currency)} />
        </View>
        <Button title="Add Funds" icon="add" onPress={() => setOpen(true)} />
      </Card>

      <View style={{ marginTop: 26 }}>
        <SectionTitle title="Recent Transactions" />
        <View style={{ height: 8 }} />
        {tx.isLoading ? (
          <Loading />
        ) : list.length ? (
          <Card style={{ paddingVertical: 4 }}>
            {list.map((t, i) => <TxRow key={String(t._id || i)} tx={t} currency={currency} last={i === list.length - 1} />)}
          </Card>
        ) : (
          <EmptyState icon="receipt-outline" title="No transactions yet" message="Your wallet activity will show up here." />
        )}
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Text style={[type.h2, { marginBottom: 4 }]}>Add Funds</Text>
          <Text style={[type.small, { marginBottom: 14 }]}>Top up securely with Stripe.</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={styles.amountInput} placeholder="Amount" placeholderTextColor={colors.subtle} />
          <View style={{ flexDirection: "row", gap: 8, marginVertical: 14 }}>
            {PRESETS.map((p) => (
              <Pressable key={p} onPress={() => setAmount(String(p))} style={[styles.preset, Number(amount) === p && { backgroundColor: colors.teal }]}>
                <Text style={{ fontWeight: "700", color: Number(amount) === p ? "#fff" : colors.tealDark }}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <Button title="Continue to Payment" onPress={topUp} loading={busy} />
        </View>
      </Modal>
    </Screen>
  );
}

function Stat({ icon, label, value }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={20} color={colors.teal} />
      <View style={{ flex: 1 }}>
        <Text style={type.small}>{label}</Text>
        <Text style={{ fontWeight: "800", color: colors.navy }} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function TxRow({ tx, currency, last }) {
  const type_ = String(tx.type || "").toUpperCase();
  const credit = ["CREDIT", "TOPUP", "TOP_UP", "REFUND", "DEPOSIT"].includes(type_) || Number(tx.amount) > 0;
  const status = String(tx.status || "completed").toLowerCase();
  return (
    <View style={[styles.tx, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <View style={[styles.txIcon, { backgroundColor: credit ? colors.infoSoft : colors.successSoft }]}>
        <Ionicons name={credit ? "arrow-down" : "bus"} size={20} color={credit ? colors.info : colors.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type.h3} numberOfLines={1}>{tx.description || tx.title || (credit ? "Wallet Top Up" : "Payment")}</Text>
        <Text style={type.small}>{formatDateTime(tx.createdAt)}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={{ fontWeight: "800", color: credit ? colors.success : colors.danger }}>
          {credit ? "+" : "-"} {formatMoney(Math.abs(Number(tx.amount) || 0), tx.currency || currency)}
        </Text>
        <Badge label={status === "completed" || status === "success" ? "Completed" : status} tone={status === "failed" ? "danger" : status === "pending" ? "warning" : "success"} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: radius.xl, marginBottom: 16 },
  bannerIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  balance: { fontSize: 36, fontWeight: "800", color: colors.navy, marginTop: 6 },
  stat: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.tealTint, borderWidth: 1, borderColor: colors.border },
  tx: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  txIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34 },
  amountInput: { height: 56, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, fontSize: 22, fontWeight: "800", color: colors.navy, backgroundColor: colors.tealTint },
  preset: { flex: 1, height: 42, borderRadius: radius.pill, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
});
