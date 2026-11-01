import { useState } from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { PartnerMoreSheet } from "../../../src/components/PartnerMoreSheet";
import { colors } from "../../../src/theme";

const icon = (active, inactive) =>
  function TabIcon({ focused, color }) {
    return <Ionicons name={focused ? active : inactive} size={26} color={color} />;
  };

export default function PartnerTabsLayout() {
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <Tabs
        backBehavior="history"
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
        <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: icon("home", "home-outline") }} />
        <Tabs.Screen name="bookings" options={{ title: "Bookings", tabBarIcon: icon("ticket", "ticket-outline") }} />
        <Tabs.Screen name="routes" options={{ title: "Routes", tabBarIcon: icon("location", "location-outline") }} />
        <Tabs.Screen name="trips" options={{ title: "Trips", tabBarIcon: icon("bus", "bus-outline") }} />
        <Tabs.Screen
          name="more"
          options={{ title: "More", tabBarIcon: icon("menu", "menu-outline") }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setMoreOpen(true);
            },
          }}
        />
      </Tabs>
      <PartnerMoreSheet visible={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
