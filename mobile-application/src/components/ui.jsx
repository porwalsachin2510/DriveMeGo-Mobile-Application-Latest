import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, radius, shadow, shadowStrong, type } from "../theme";

export function Button({ title, onPress, loading, disabled, variant = "primary", icon = "arrow-forward", style, small }) {
  const inactive = disabled || loading;
  const handle = () => {
    if (inactive) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  if (variant === "primary") {
    return (
      <Pressable onPress={handle} disabled={inactive} style={({ pressed }) => [{ opacity: inactive ? 0.55 : pressed ? 0.9 : 1 }, style]}>
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.btn, small && styles.btnSmall, shadowStrong]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={[styles.btnText, small && { fontSize: 14 }]}>{title}</Text>
              {icon ? <Ionicons name={icon} size={small ? 16 : 20} color="#fff" /> : null}
            </>
          )}
        </LinearGradient>
      </Pressable>
    );
  }

  const outline = variant === "outline";
  return (
    <Pressable
      onPress={handle}
      disabled={inactive}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        outline ? styles.btnOutline : styles.btnGhost,
        { opacity: inactive ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.tealDark} />
      ) : (
        <>
          {icon && variant !== "ghost" ? null : null}
          <Text style={[styles.btnText, { color: variant === "danger" ? colors.danger : colors.tealDark }, small && { fontSize: 14 }]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, required, icon, error, right, style, containerStyle, ...inputProps }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: 16 }, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <View style={[styles.field, focused && styles.fieldFocused, !!error && { borderColor: colors.danger }, style]}>
        {icon ? <Ionicons name={icon} size={20} color={focused ? colors.teal : colors.tealDark} style={{ marginRight: 12 }} /> : null}
        <TextInput
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          placeholderTextColor={colors.subtle}
          style={styles.input}
        />
        {right}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, shadow, style]}>{children}</View>;
}

export function Chip({ label, active, onPress, icon, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive, style]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      {icon ? <Ionicons name={icon} size={15} color={active ? "#fff" : colors.tealDark} style={{ marginRight: 6 }} /> : null}
      <Text style={[styles.chipText, active && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

const TONES = {
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
  teal: { bg: colors.tealSoft, fg: colors.tealDark },
  muted: { bg: "#EEF2F6", fg: colors.muted },
};

export function Badge({ label, tone = "teal", icon, style }) {
  const t = TONES[tone] || TONES.teal;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={t.fg} style={{ marginRight: 4 }} /> : null}
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Loading({ label }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.teal} />
      {label ? <Text style={[type.small, { marginTop: 12 }]}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ icon = "file-tray-outline", title, message, action }) {
  return (
    <View style={[styles.center, { paddingHorizontal: 32 }]}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.tealDark} />
      </View>
      <Text style={[type.h3, { marginTop: 16, textAlign: "center" }]}>{title}</Text>
      {message ? <Text style={[type.small, { marginTop: 6, textAlign: "center" }]}>{message}</Text> : null}
      {action ? <View style={{ marginTop: 18, alignSelf: "stretch" }}>{action}</View> : null}
    </View>
  );
}

export function SectionTitle({ icon, title, subtitle, right }) {
  return (
    <View style={styles.sectionTitle}>
      {icon ? (
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={18} color={colors.tealDark} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={type.h3}>{title}</Text>
        {subtitle ? <Text style={type.small}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  btnSmall: { height: 44 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnOutline: { borderWidth: 1.5, borderColor: colors.teal, backgroundColor: "rgba(255,255,255,0.7)" },
  btnGhost: { backgroundColor: colors.tealSoft },
  label: { fontSize: 14, fontWeight: "700", color: colors.navy, marginBottom: 8 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldFocused: { borderColor: colors.teal, backgroundColor: "#fff" },
  input: { flex: 1, fontSize: 15, color: colors.navy, paddingVertical: 12 },
  error: { color: colors.danger, fontSize: 12, marginTop: 6, marginLeft: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(227,238,243,0.7)",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.navy },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
