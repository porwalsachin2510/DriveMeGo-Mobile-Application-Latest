import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppHeader } from "./AppHeader";
import { colors, radius, shadow, type } from "../theme";

export function PartnerHeader({ back = false }) {
  const router = useRouter();
  return <AppHeader onBack={back ? () => (router.canGoBack() ? router.back() : router.replace("/partner/home")) : undefined} />;
}

export function StatTile({ icon, tint = colors.teal, soft = colors.tealSoft, value, label, onPress, style }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.tile, shadow, style]}>
      <View style={[styles.tileIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text style={styles.tileLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.subtle} /> : null}
    </Pressable>
  );
}

export function InfoCell({ icon, label, value, style }) {
  return (
    <View style={[styles.cell, style]}>
      {icon ? <Ionicons name={icon} size={18} color={colors.tealDark} style={{ marginRight: 8 }} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.cellLabel}>{label}</Text>
        <Text style={styles.cellValue} numberOfLines={2}>
          {value ?? "-"}
        </Text>
      </View>
    </View>
  );
}

export function SegTabs({ tabs, value, onChange }) {
  return (
    <View style={styles.seg}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} style={[styles.segItem, active && styles.segActive]}>
            {t.icon ? <Ionicons name={t.icon} size={16} color={active ? "#fff" : colors.tealDark} style={{ marginRight: 6 }} /> : null}
            <Text style={[styles.segText, active && { color: "#fff" }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FilterRow({ items, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }} style={{ marginBottom: 12 }}>
      {items.map((i) => {
        const active = i.key === value;
        return (
          <Pressable key={i.key} onPress={() => onChange(i.key)} style={[styles.filter, active && styles.filterActive]}>
            <Text style={[styles.filterText, active && { color: "#fff" }]}>{i.label}</Text>
            {i.count != null ? (
              <View style={[styles.count, active && { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                <Text style={[styles.countText, active && { color: "#fff" }]}>{i.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function RouteLine({ from, to, size = 15 }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, flex: 1 }}>
      <Text style={[type.h3, { fontSize: size }]} numberOfLines={1}>
        {from || "-"}
      </Text>
      <Ionicons name="arrow-forward" size={14} color={colors.teal} />
      <Text style={[type.h3, { fontSize: size }]} numberOfLines={1}>
        {to || "-"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(227,238,243,0.7)",
  },
  tileIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  tileValue: { fontSize: 20, fontWeight: "800", color: colors.navy },
  tileLabel: { fontSize: 12, color: colors.muted, marginTop: 1 },
  cell: { flexDirection: "row", alignItems: "center", flex: 1, backgroundColor: colors.tealTint, borderRadius: radius.md, padding: 10 },
  cellLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  cellValue: { fontSize: 13, fontWeight: "700", color: colors.navy, marginTop: 2 },
  seg: { flexDirection: "row", backgroundColor: "#fff", borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border, marginBottom: 14 },
  segItem: { flex: 1, height: 42, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  segActive: { backgroundColor: colors.teal },
  segText: { fontSize: 14, fontWeight: "700", color: colors.navy },
  filter: { flexDirection: "row", alignItems: "center", height: 38, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  filterText: { fontSize: 13, fontWeight: "700", color: colors.navy },
  count: { marginLeft: 6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  countText: { fontSize: 11, fontWeight: "800", color: colors.tealDark },
});
