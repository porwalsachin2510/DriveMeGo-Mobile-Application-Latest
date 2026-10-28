import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { PartnerHeader } from "../../src/components/partner";
import { Badge, Card, Loading } from "../../src/components/ui";
import { commissionService } from "../../src/services/partner";
import { formatDate } from "../../src/utils/format";
import { colors, type } from "../../src/theme";

export default function PartnerCommission() {
  const q = useQuery({ queryKey: ["partner", "commission"], queryFn: commissionService.mine });
  const d = q.data?.data;

  return (
    <Screen header={<PartnerHeader back />} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Text style={type.h1}>My Commission</Text>
      <Text style={[type.small, { marginBottom: 14 }]}>The platform commission applied to your payments.</Text>

      {q.isLoading || !d ? (
        <Loading />
      ) : (
        <>
          <Card style={styles.hero}>
            <View style={styles.icon}>
              <Ionicons name="pricetag-outline" size={26} color={colors.tealDark} />
            </View>
            <Text style={type.caption}>{d.primary?.label || "Commission rate"}</Text>
            <Text style={styles.rate}>{Number(d.primary?.rate ?? 0)}%</Text>
            <Text style={[type.small, { textAlign: "center" }]}>{d.primary?.description}</Text>
            {d.isDefault ? <Badge label="Platform default" tone="info" style={{ marginTop: 10 }} /> : null}
          </Card>

          {d.customRules?.length ? (
            <>
              <Text style={[type.h2, { marginVertical: 10 }]}>Special rates</Text>
              {d.customRules.map((r, i) => (
                <Card key={`${r.rateType}-${i}`} style={styles.rule}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={type.h3}>{r.label}</Text>
                    {r.description ? <Text style={type.small}>{r.description}</Text> : null}
                    <Text style={[type.small, { fontSize: 12 }]}>
                      {r.effectiveFrom ? formatDate(r.effectiveFrom) : "Now"} {"\u2192"} {r.effectiveUntil ? formatDate(r.effectiveUntil) : "Open"}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <Text style={styles.ruleRate}>{r.rate}%</Text>
                    <Badge label={r.status} tone={r.status === "active" ? "success" : r.status === "scheduled" ? "info" : "muted"} />
                  </View>
                </Card>
              ))}
            </>
          ) : null}

          {d.emiSettings ? (
            <Card style={{ padding: 14, marginTop: 10, gap: 6 }}>
              <Text style={type.h3}>EMI commission settings</Text>
              {Object.entries(d.emiSettings)
                .filter(([, v]) => typeof v !== "object")
                .map(([k, v]) => (
                  <View key={k} style={styles.kv}>
                    <Text style={type.small}>{k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</Text>
                    <Text style={styles.kvValue}>{String(v)}</Text>
                  </View>
                ))}
            </Card>
          ) : null}

          {d.notes ? <Text style={[type.small, { marginTop: 12 }]}>{d.notes}</Text> : null}
          {d.lastUpdated ? <Text style={[type.small, { marginTop: 6, fontSize: 12 }]}>Last updated {formatDate(d.lastUpdated)}</Text> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", padding: 22, gap: 4 },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  rate: { fontSize: 44, fontWeight: "800", color: colors.navy },
  rule: { flexDirection: "row", gap: 12, padding: 14, marginBottom: 10, alignItems: "center" },
  ruleRate: { fontSize: 20, fontWeight: "800", color: colors.tealDark },
  kv: { flexDirection: "row", justifyContent: "space-between" },
  kvValue: { fontSize: 13, fontWeight: "700", color: colors.navy },
});
