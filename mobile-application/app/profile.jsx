import { Redirect } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import { ACCOUNT_BY_ROLE, isPartner } from "../src/utils/roles";

export default function Profile() {
  const { user, ready, isAuthenticated } = useAuth();
  if (ready && !isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (ACCOUNT_BY_ROLE[user?.role]) return <Redirect href={ACCOUNT_BY_ROLE[user.role]} />;
  return <Redirect href={isPartner(user) ? "/partner/account" : "/(tabs)/more"} />;
}
