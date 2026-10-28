import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, type } from "../theme";

export function PageHero({ eyebrow, title, subtitle, icon = "bus-outline", right }) {
  return (
    <LinearGradient colors={["#DDF4F8", "#F1FAFC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={type.h1}>{title}</Text>
        {subtitle ? <Text style={[type.small, { marginTop: 4 }]}>{subtitle}</Text> : null}
      </View>
      {right || (
        <View style={styles.icon}>
          <Ionicons name={icon} size={30} color={colors.teal} />
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18, borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: "rgba(18,179,193,0.12)" },
  eyebrow: { color: colors.tealDark, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.8)", alignItems: "center", justifyContent: "center" },
});
