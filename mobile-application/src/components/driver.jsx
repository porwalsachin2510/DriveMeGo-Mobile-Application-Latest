import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, gradients, radius, shadow, shadowStrong } from "../theme";
import { useAuth } from "../context/AuthContext";
import { useLocationSharing } from "../context/LocationContext";
import { resolveImage } from "./AppHeader";
import { initials } from "../utils/format";
import { ROLE_LABELS } from "../utils/roles";

export function DriverBanner({ showSharing = true, liveHref }) {
  const router = useRouter();
  const { user } = useAuth();
  const { sharing } = useLocationSharing();
  const avatar = resolveImage(user?.profileImage);
  return (
    <LinearGradient colors={["#DDF5F8", "#F2FBFC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
      <View style={styles.avatar}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text style={styles.avatarText}>{initials(user?.fullName || "")}</Text>
        )}
        <View style={[styles.dot, { backgroundColor: sharing ? colors.success : colors.subtle }]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {user?.fullName || "Driver"}
        </Text>
        <Text style={styles.role}>{ROLE_LABELS[user?.role] || "Driver"}</Text>
        <Text style={styles.login} numberOfLines={1}>
          Last login: Today, {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
      {showSharing ? (
        <Pressable
          onPress={() => liveHref && router.push(liveHref)}
          style={[styles.sharePill, !sharing && styles.sharePillOff]}
        >
          <Ionicons name={sharing ? "location" : "location-outline"} size={13} color={sharing ? "#fff" : colors.danger} />
          <Text style={[styles.shareText, !sharing && { color: colors.danger }]}>
            {sharing ? "Sharing Live Location" : "Location Off"}
          </Text>
          <Ionicons name="chevron-forward" size={12} color={sharing ? "#fff" : colors.danger} />
        </Pressable>
      ) : null}
    </LinearGradient>
  );
}

export function PageTitle({ title, subtitle, icon, onBack }) {
  return (
    <View style={styles.titleRow}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={10} style={styles.titleBack}>
          <Ionicons name="arrow-back" size={24} color={colors.navy} />
        </Pressable>
      ) : null}
      {icon ? (
        <View style={styles.titleIcon}>
          <Ionicons name={icon} size={26} color={colors.teal} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function SegmentTabs({ items, value, onChange }) {
  return (
    <View style={styles.segWrap}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} style={styles.segItem}>
            {active ? <LinearGradient colors={gradients.primary} style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]} /> : null}
            <Text style={[styles.segText, active && { color: "#fff" }]} numberOfLines={1}>
              {it.label}
            </Text>
            {it.count !== undefined ? (
              <View style={[styles.segCount, active && { backgroundColor: "#fff" }]}>
                <Text style={[styles.segCountText, active && { color: colors.tealDark }]}>{it.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatTile({ icon, value, label, tone = "teal" }) {
  const tones = {
    teal: [colors.tealSoft, colors.teal],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    info: [colors.infoSoft, colors.info],
  };
  const [bg, fg] = tones[tone] || tones.teal;
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={fg} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function MetaCell({ icon, label, value }) {
  return (
    <View style={styles.metaCell}>
      <Ionicons name={icon} size={22} color={colors.navy} />
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function StatusPill({ label, tone = "success", dot = true }) {
  const tones = {
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    info: [colors.infoSoft, colors.info],
    danger: [colors.dangerSoft, colors.danger],
    muted: ["#EEF2F6", colors.muted],
    teal: [colors.tealSoft, colors.tealDark],
  };
  const [bg, fg] = tones[tone] || tones.muted;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {dot ? <View style={[styles.pillDot, { backgroundColor: fg }]} /> : null}
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function TripCard({ children, style }) {
  return <View style={[styles.tripCard, style]}>{children}</View>;
}

export function GradientAction({ title, icon = "play", onPress, loading, disabled, danger, style }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={[{ opacity: disabled ? 0.55 : 1 }, style]}>
      <LinearGradient
        colors={danger ? ["#F2686C", "#E5484D"] : gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.action}
      >
        <View style={styles.actionIcon}>
          <Ionicons name={loading ? "hourglass-outline" : icon} size={18} color="#fff" />
        </View>
        <Text style={styles.actionText}>{loading ? "Please wait..." : title}</Text>
        <Ionicons name="chevron-forward" size={18} color="#fff" />
      </LinearGradient>
    </Pressable>
  );
}

export function HelpStrip({ title = "Need help or have a change in your travel?", subtitle = "Contact your transport coordinator.", onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.help}>
      <View style={styles.helpIcon}>
        <Ionicons name="document-text-outline" size={20} color={colors.teal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.helpTitle}>{title}</Text>
        <Text style={styles.helpSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 20,
    borderRadius: radius.xl,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#CFEFF3",
    flexWrap: "wrap",
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  dot: { position: "absolute", right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: "#fff" },
  name: { fontSize: 16, fontWeight: "800", color: colors.navy },
  role: { fontSize: 13, fontWeight: "700", color: colors.tealDark, marginTop: 1 },
  login: { fontSize: 11, color: colors.muted, marginTop: 2 },
  sharePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.tealDark,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  sharePillOff: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#F7C9CB" },
  shareText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18, marginBottom: 14 },
  titleBack: { marginRight: -2 },
  titleIcon: { width: 54, height: 54, borderRadius: radius.lg, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800", color: colors.navy, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  segWrap: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  segItem: { flex: 1, paddingVertical: 11, paddingHorizontal: 4, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  segText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  segCount: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  segCountText: { fontSize: 11, fontWeight: "800", color: colors.tealDark },
  stat: { flex: 1, backgroundColor: "#fff", borderRadius: radius.lg, padding: 12, gap: 6, borderWidth: 1, borderColor: colors.border, ...shadow },
  statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.navy },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  metaCell: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  metaLabel: { fontSize: 11, color: colors.muted },
  metaValue: { fontSize: 14, fontWeight: "800", color: colors.navy, marginTop: 1 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  tripCard: { backgroundColor: "#fff", borderRadius: radius.xl, padding: 14, gap: 12, borderWidth: 1, borderColor: colors.border, ...shadow },
  action: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 14, borderRadius: radius.lg, ...shadowStrong },
  actionIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  actionText: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "800" },
  help: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.border },
  helpIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  helpTitle: { fontSize: 13, fontWeight: "800", color: colors.navy },
  helpSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
});
