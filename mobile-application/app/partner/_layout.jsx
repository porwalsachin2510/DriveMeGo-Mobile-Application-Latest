import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { isPartner, homeHref } from "../../src/utils/roles";
import { colors } from "../../src/theme";

export const unstable_settings = { initialRouteName: "(tabs)" };

export default function PartnerLayout() {
  const { ready, isAuthenticated, user } = useAuth();

  if (ready && !isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (ready && user && !isPartner(user)) return <Redirect href={homeHref(user)} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: "slide_from_right",
      }}
    />
  );
}
