import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, gradients } from "../theme";

export function Screen({
  children,
  header,
  scroll = true,
  refreshing,
  onRefresh,
  footer,
  tabBarSpace = false,
  contentStyle,
  decor = false,
  keyboard = false,
}) {
  const insets = useSafeAreaInsets();
  const bottomPad = (tabBarSpace ? 96 : 24) + (tabBarSpace ? 0 : insets.bottom);

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ paddingHorizontal: 20, paddingBottom: bottomPad }, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.teal} /> : undefined}
    >
      {children}
      {decor ? <Image source={require("../../assets/images/city-footer.png")} style={styles.decor} contentFit="cover" /> : null}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingHorizontal: 20 }, contentStyle]}>{children}</View>
  );

  const content = (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <LinearGradient colors={gradients.soft} style={StyleSheet.absoluteFill} />
      {header}
      {body}
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View> : null}
    </View>
  );

  if (!keyboard) return content;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  decor: { width: "130%", height: 150, marginTop: 24, alignSelf: "center", opacity: 0.9 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "rgba(244,250,252,0.96)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
