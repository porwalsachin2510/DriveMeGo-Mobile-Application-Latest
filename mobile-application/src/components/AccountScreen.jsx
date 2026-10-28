import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { Screen } from "./Screen";
import { AppHeader, resolveImage } from "./AppHeader";
import { Card } from "./ui";
import { useAuth } from "../context/AuthContext";
import { useLocationSharing } from "../context/LocationContext";
import { WEB_URL } from "../config/env";
import { initials } from "../utils/format";
import { ROLE_LABELS } from "../utils/roles";
import { colors, radius, shadow } from "../theme";

const open = (path) => WebBrowser.openBrowserAsync(`${WEB_URL}${path}`);

const ITEMS = [
  { icon: "document-text-outline", title: "Terms & Conditions", sub: "Read our terms and conditions", onPress: () => open("/terms-and-conditions") },
  { icon: "shield-checkmark-outline", title: "Privacy Policy", sub: "Your data, our priority", onPress: () => open("/privacy-policy") },
  { icon: "information-circle-outline", title: "About Us", sub: "Know more about DriveMeGo", onPress: () => open("/about-us") },
  { icon: "mail-outline", title: "Contact Us", sub: "Get in touch with our support team", onPress: () => open("/contact-us") },
  {
    icon: "call-outline",
    title: "Support Hotline",
    sub: "Speak with the DriveMeGo team",
    onPress: () => Linking.openURL("mailto:support@drivemego.com"),
  },
];

export function AccountScreen({ onBack }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { stop } = useLocationSharing();
  const avatar = resolveImage(user?.profileImage);

  const confirmLogout = () =>
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          stop();
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);

  return (
    <Screen header={<AppHeader onBack={onBack} />} tabBarSpace>
      <Card style={styles.profile}>
        <View style={styles.avatar}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Text style={styles.avatarText}>{initials(user?.fullName || "")}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.fullName || "Driver"}</Text>
          <Text style={styles.role}>{ROLE_LABELS[user?.role] || ""}</Text>
          <Text style={styles.contact} numberOfLines={1}>
            {user?.email}
          </Text>
          {user?.phone ? <Text style={styles.contact}>{`${user.countryCode || ""} ${user.phone}`.trim()}</Text> : null}
        </View>
      </Card>

      <Card style={{ padding: 0, marginTop: 14 }}>
        {ITEMS.map((it, i) => (
          <Pressable
            key={it.title}
            onPress={it.onPress}
            style={({ pressed }) => [styles.row, i < ITEMS.length - 1 && styles.rowBorder, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.rowIcon}>
              <Ionicons name={it.icon} size={22} color={colors.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{it.title}</Text>
              <Text style={styles.rowSub}>{it.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
          </Pressable>
        ))}
      </Card>

      <Pressable onPress={confirmLogout} style={styles.logout}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  name: { fontSize: 18, fontWeight: "800", color: colors.navy },
  role: { fontSize: 13, fontWeight: "700", color: colors.tealDark, marginTop: 1 },
  contact: { fontSize: 12, color: colors.muted, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 15, fontWeight: "700", color: colors.navy },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18, paddingVertical: 14, borderRadius: radius.lg, backgroundColor: colors.dangerSoft, ...shadow },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: "800" },
});
