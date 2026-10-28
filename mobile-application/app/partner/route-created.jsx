import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { PartnerHeader } from "../../src/components/partner";
import { Button, Card } from "../../src/components/ui";
import { formatDate, formatMoney } from "../../src/utils/format";
import { colors, gradients, shadowStrong, type } from "../../src/theme";

function Row({ icon, label, value }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={colors.tealDark} />
      </View>
      <Text style={[type.small, { flex: 1 }]}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function RouteCreated() {
  const router = useRouter();
  const p = useLocalSearchParams();
  return (
    <Screen header={<PartnerHeader />} decor>
      <View style={{ alignItems: "center", marginTop: 20 }}>
        <LinearGradient colors={gradients.primary} style={[styles.check, shadowStrong]}>
          <Ionicons name="checkmark" size={46} color="#fff" />
        </LinearGradient>
        <Text style={[type.h1, { textAlign: "center", marginTop: 20 }]}>Route Created Successfully!</Text>
        <Text style={[type.small, { textAlign: "center", marginTop: 6, marginBottom: 22 }]}>Your new route has been added and is now ready to be assigned.</Text>
      </View>
      <Card style={{ padding: 16, marginBottom: 18 }}>
        <Text style={[type.h3, { marginBottom: 8 }]}>Route Summary</Text>
        <Row icon="navigate-outline" label="From" value={p.from} />
        <Row icon="location-outline" label="To" value={p.to} />
        <Row icon="calendar-outline" label="Start Date" value={formatDate(p.start)} />
        <Row icon="cash-outline" label="Monthly Price (One Way)" value={formatMoney(Number(p.oneWay || 0))} />
        <Row icon="repeat-outline" label="Monthly Price (Round Trip)" value={formatMoney(Number(p.roundTrip || 0))} />
        <Row icon="bus-outline" label="Total Weekly Trips" value={p.weekly} />
      </Card>
      <Button title="Go to Routes" onPress={() => router.replace("/partner/routes")} />
      <Button title="Add Another Route" variant="outline" icon="add" onPress={() => router.replace("/partner/add-route")} style={{ marginTop: 12 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  check: { width: 104, height: 104, borderRadius: 52, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  value: { fontWeight: "800", color: colors.navy, fontSize: 13, maxWidth: "50%", textAlign: "right" },
});
