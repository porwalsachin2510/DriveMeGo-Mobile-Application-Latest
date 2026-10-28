import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "./Screen";
import { colors } from "../theme";

export function AuthShell({ children, onBack, backLabel = "Back to Login", right }) {
  const insets = useSafeAreaInsets();
  return (
    <Screen
      keyboard
      decor
      header={
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Image source={require("../../assets/images/logo-full.png")} style={styles.logo} contentFit="contain" />
          {right}
        </View>
      }
    >
      {onBack ? (
        <Pressable onPress={onBack} style={styles.back} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.teal} />
          <Text style={styles.backText}>{backLabel}</Text>
        </Pressable>
      ) : null}
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 8 },
  logo: { width: 170, height: 48 },
  back: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 8 },
  backText: { color: colors.teal, fontSize: 16, fontWeight: "600" },
});
