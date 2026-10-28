import { useRouter } from "expo-router";
import { AccountScreen } from "../../src/components/AccountScreen";

export default function SchoolStudentAccount() {
  const router = useRouter();
  return <AccountScreen onBack={() => router.back()} />;
}
