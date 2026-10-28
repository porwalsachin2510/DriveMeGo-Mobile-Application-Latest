import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { FilterRow, PartnerHeader } from "../../src/components/partner";
import { Badge, Card, EmptyState, Loading } from "../../src/components/ui";
import { partnerService } from "../../src/services/partner";
import { formatDate, formatMoney } from "../../src/utils/format";
import { colors, radius, type } from "../../src/theme";

const PERIODS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

export default function PartnerEarnings() {
  const [period, setPeriod] = useState("monthly");
  const q = useQuery({ queryKey: ["partner", "earnings", period], queryFn: () => partnerService.earnings(period) });
  const e = q.data?.earnings || {};
  const txns = q.data?.transactions || [];
  const cur = e.currency || "AED";
  const money = (v) => formatMoney(v, cur);

  return (
    <Screen header={<PartnerHeader back />} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Text style={type.h1}>Earnings Overview</Text>
      <Text style={[type.small, { marginBottom: 14 }]}>Track your earnings and commissions with complete transparency.</Text>
      <FilterRow items={PERIODS} value={period} onChange={setPeriod} />

      {q.isLoading ? (
        <Loading />
      ) : (
        <>
          <Card style={styles.hero}>
            <Text style={type.caption}>Net earnings</Text>
            <Text style={styles.heroValue}>{money(e.totalNet ?? e.total)}</Text>
            <View style={styles.sep} />
            <Line label="Total payments" value={money(e.totalGross)} />
            <Line label="Admin commission" value={`-${money(e.totalCommission)}`} danger />
          </Card>

          <View style={styles.pair}>
            <MiniCard title="This week" net={e.thisWeekNet} gross={e.thisWeekGross} comm={e.thisWeekCommission} change={e.thisWeekChange} money={money} />
            <MiniCard title="Today" net={e.todayNet} gross={e.todayGross} comm={e.todayCommission} money={money} />
          </View>

          <Text style={[type.h2, { marginTop: 8, marginBottom: 4 }]}>Transaction History</Text>
          <Text style={[type.small, { marginBottom: 12 }]}>Your past transactions and earnings</Text>
          {txns.length === 0 ? (
            <EmptyState icon="receipt-outline" title="No transactions yet" message="Completed payments will be listed here." />
          ) : (
            txns.map((t, i) => (
              <Card key={t._id || i} style={styles.txn}>
                <View style={styles.txnHead}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="calendar-outline" size={16} color={colors.tealDark} />
                    <Text style={type.h3}>{formatDate(t.date)}</Text>
                  </View>
                  <Badge label={t.status || "Paid"} tone={String(t.status).toLowerCase() === "paid" ? "success" : "warning"} />
                </View>
                <Line label="Trips" value={`${t.trips ?? 1} trip${(t.trips ?? 1) === 1 ? "" : "s"}`} />
                <Line label="Total payment" value={money(t.totalPayment ?? t.gross)} />
                <Line label="Admin commission" value={`-${money(t.adminCommission ?? t.commission)}`} danger />
                <Line label="Net earnings" value={money(t.netEarnings ?? t.net)} success />
              </Card>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

function Line({ label, value, danger, success }) {
  return (
    <View style={styles.line}>
      <Text style={type.small}>{label}</Text>
      <Text style={[styles.lineValue, danger && { color: colors.danger }, success && { color: colors.success }]}>{value}</Text>
    </View>
  );
}

function MiniCard({ title, net, gross, comm, change, money }) {
  const up = Number(change) >= 0;
  return (
    <Card style={styles.mini}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="time-outline" size={16} color={colors.tealDark} />
        <Text style={type.caption}>{title}</Text>
      </View>
      <Text style={styles.miniValue}>{money(net)}</Text>
      {change != null ? (
        <Text style={{ fontSize: 11, fontWeight: "700", color: up ? colors.success : colors.danger }}>
          {up ? "\u2191" : "\u2193"} {Math.abs(Number(change)).toFixed(0)}%
        </Text>
      ) : null}
      <View style={[styles.sep, { marginVertical: 8 }]} />
      <Line label="Payments" value={money(gross)} />
      <Line label="Commission" value={`-${money(comm)}`} danger />
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 18, marginBottom: 12 },
  heroValue: { fontSize: 32, fontWeight: "800", color: colors.navy, marginTop: 4 },
  sep: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  pair: { flexDirection: "row", gap: 10 },
  mini: { flex: 1, padding: 12 },
  miniValue: { fontSize: 17, fontWeight: "800", color: colors.navy, marginTop: 6 },
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3, gap: 8 },
  lineValue: { fontSize: 13, fontWeight: "700", color: colors.navy },
  txn: { padding: 14, marginBottom: 10, gap: 2, borderRadius: radius.lg },
  txnHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
});
