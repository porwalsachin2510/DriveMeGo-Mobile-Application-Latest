import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { PartnerHeader } from "../../src/components/partner";
import { Badge, Card, EmptyState, Loading } from "../../src/components/ui";
import { settlementService } from "../../src/services/partner";
import { formatDate, formatMoney } from "../../src/utils/format";
import { colors, type } from "../../src/theme";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function PartnerSettlements() {
  const now = new Date();
  const [cursor, setCursor] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const q = useQuery({ queryKey: ["partner", "settlement", cursor], queryFn: () => settlementService.mine(cursor) });
  const s = q.data?.settlement;
  const cur = s?.currency || "AED";
  const money = (v) => formatMoney(v, cur);

  const step = (delta) =>
    setCursor(({ month, year }) => {
      const idx = year * 12 + (month - 1) + delta;
      return { month: (idx % 12) + 1, year: Math.floor(idx / 12) };
    });

  const settled = s?.status === "SETTLED" || s?.status === "PAID";

  return (
    <Screen header={<PartnerHeader back />} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Text style={type.h1}>Settlements</Text>
      <Text style={[type.small, { marginBottom: 14 }]}>Monthly payout statement for your account.</Text>

      <Card style={styles.picker}>
        <Pressable onPress={() => step(-1)} hitSlop={10} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={22} color={colors.tealDark} />
        </Pressable>
        <Text style={type.h3}>
          {MONTHS[cursor.month - 1]} {cursor.year}
        </Text>
        <Pressable onPress={() => step(1)} hitSlop={10} accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={22} color={colors.tealDark} />
        </Pressable>
      </Card>

      {q.isLoading ? (
        <Loading />
      ) : !s ? (
        <EmptyState icon="business-outline" title="No settlement data" message="Nothing to show for this month." />
      ) : (
        <>
          <Card style={styles.hero}>
            <View style={styles.rowBetween}>
              <Text style={type.caption}>Net payable</Text>
              <Badge label={String(s.status || "").replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())} tone={settled ? "success" : "warning"} />
            </View>
            <Text style={styles.heroValue}>{money(s.netPayable)}</Text>
            <View style={styles.sep} />
            <Line label="Gross earnings" value={money(s.grossEarnings)} />
            <Line label="Commission collected" value={`-${money(s.commissionCollected)}`} danger />
            <Line label="Outstanding commission debt" value={money(s.commissionDebt)} />
            <Line label="Balance" value={money(s.balance)} bold />
            <Line label="Bookings" value={String(s.bookingCount ?? 0)} />
            {s.settledAt ? <Line label="Settled on" value={formatDate(s.settledAt)} /> : null}
          </Card>

          <Text style={[type.h2, { marginVertical: 10 }]}>Transactions</Text>
          {(s.transactions || []).length === 0 ? (
            <EmptyState icon="receipt-outline" title="No transactions" message="No payments recorded for this month." />
          ) : (
            s.transactions.map((t, i) => (
              <Card key={t._id || i} style={styles.txn}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={type.h3} numberOfLines={1}>
                    {t.description || t.type || "Payment"}
                  </Text>
                  <Text style={[type.small, { fontSize: 12 }]}>{formatDate(t.date || t.createdAt)}</Text>
                </View>
                <Text style={styles.txnAmount}>{money(t.amount ?? t.netAmount)}</Text>
              </Card>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

function Line({ label, value, danger, bold }) {
  return (
    <View style={styles.line}>
      <Text style={type.small}>{label}</Text>
      <Text style={[styles.lineValue, danger && { color: colors.danger }, bold && { fontSize: 15 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, marginBottom: 12 },
  hero: { padding: 18 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroValue: { fontSize: 32, fontWeight: "800", color: colors.navy, marginTop: 4 },
  sep: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 8 },
  lineValue: { fontSize: 13, fontWeight: "700", color: colors.navy },
  txn: { flexDirection: "row", alignItems: "center", padding: 14, marginBottom: 10 },
  txnAmount: { fontSize: 15, fontWeight: "800", color: colors.success },
});
