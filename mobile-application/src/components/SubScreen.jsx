import { useRouter } from "expo-router";
import { Screen } from "./Screen";
import { AppHeader } from "./AppHeader";
import { PageHero } from "./PageHero";

export const errorMessage = (error, fallback = "Something went wrong. Please try again.") =>
  error?.response?.data?.message || fallback;

export function SubScreen({ eyebrow, title, subtitle, icon, refreshing, onRefresh, keyboard, children }) {
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/more"));
  return (
    <Screen header={<AppHeader onBack={goBack} />} refreshing={refreshing} onRefresh={onRefresh} keyboard={keyboard} decor>
      <PageHero eyebrow={eyebrow} title={title} subtitle={subtitle} icon={icon} />
      {children}
    </Screen>
  );
}
