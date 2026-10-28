import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { colors } from "../../src/theme";

export default function AuthLayout() {
  const { ready, isAuthenticated } = useAuth();
  if (ready && isAuthenticated) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
