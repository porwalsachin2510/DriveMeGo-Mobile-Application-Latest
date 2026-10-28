import { Platform } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";
import { homeHref } from "../utils/roles";

const icon = (active, inactive) =>
  function TabIcon({ focused, color }) {
    return <Ionicons name={focused ? active : inactive} size={26} color={color} />;
  };

export function RoleTabs({ role, tabs, hidden = [] }) {
  const { ready, isAuthenticated, user } = useAuth();
  const insets = useSafeAreaInsets();

  if (ready && !isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (ready && user && user.role !== role) return <Redirect href={homeHref(user)} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.subtle,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
          backgroundColor: "#fff",
          borderTopWidth: 0,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          position: "absolute",
          ...Platform.select({
            ios: { shadowColor: "#0B2A4A", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
            android: { elevation: 12 },
          }),
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
      screenListeners={{ tabPress: () => Haptics.selectionAsync().catch(() => {}) }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{ title: t.title, tabBarIcon: icon(t.active, t.inactive) }}
        />
      ))}
      {hidden.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
