import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SubScreen } from "../../src/components/SubScreen";
import { HtmlContent } from "../../src/components/HtmlContent";
import { Button, Card, EmptyState, Loading } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { pageService } from "../../src/services";
import { formatDate } from "../../src/utils/format";
import { colors, type } from "../../src/theme";

const PAGES = {
  "terms-and-conditions": { title: "Terms & Conditions", eyebrow: "Legal", icon: "document-text-outline", subtitle: "Please read these terms carefully.", cms: true },
  "privacy-policy": { title: "Privacy Policy", eyebrow: "Legal", icon: "shield-checkmark-outline", subtitle: "How we collect and protect your data.", cms: true },
  "refund-policy": { title: "Refund Policy", eyebrow: "Legal", icon: "cash-outline", subtitle: "Cancellations, refunds and wallet credits.", cms: true },
  "contact-us": { title: "Contact Us", eyebrow: "Support", icon: "mail-outline", subtitle: "We are here to help you.", cms: true },
  "about-us": { title: "About Us", eyebrow: "DriveMeGo", icon: "information-circle-outline", subtitle: "Smarter, safer shared commuting.", cms: false },
};

const ABOUT_POINTS = [
  { icon: "bus-outline", title: "Reliable commuting", text: "Fixed routes, scheduled trips and verified drivers for your daily travel." },
  { icon: "shield-checkmark-outline", title: "Safety first", text: "Live trip tracking, SOS alerts, emergency contacts and trip protection." },
  { icon: "people-outline", title: "For everyone", text: "Commuters, corporate employees, school students, partners and drivers on one platform." },
  { icon: "wallet-outline", title: "Simple payments", text: "Monthly passes, wallet balance and transparent cancellation rules." },
];

const SOCIALS = [
  { key: "facebook", icon: "logo-facebook", label: "Facebook" },
  { key: "instagram", icon: "logo-instagram", label: "Instagram" },
  { key: "twitter", icon: "logo-twitter", label: "Twitter" },
  { key: "linkedin", icon: "logo-linkedin", label: "LinkedIn" },
  { key: "tiktok", icon: "logo-tiktok", label: "TikTok" },
];

function ContactRow({ icon, label, value, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.contactRow, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.contactIcon}>
        <Ionicons name={icon} size={20} color={colors.teal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type.caption}>{label}</Text>
        <Text style={type.h3}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
    </Pressable>
  );
}

export default function InfoPage() {
  const { slug } = useLocalSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const meta = PAGES[slug];

  const pageQ = useQuery({
    queryKey: ["page", slug],
    queryFn: () => pageService.page(slug),
    enabled: !!meta?.cms,
    retry: false,
  });
  const settingsQ = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => pageService.settings(),
    enabled: slug === "contact-us" || slug === "about-us",
  });

  if (!meta) {
    return (
      <SubScreen eyebrow="DriveMeGo" title="Page not found" icon="alert-circle-outline">
        <EmptyState icon="alert-circle-outline" title="This page does not exist" />
      </SubScreen>
    );
  }

  const page = pageQ.data?.data;
  const settings = settingsQ.data?.data || {};
  const social = SOCIALS.filter((s) => settings.socialLinks?.[s.key]);
  const refetch = () => {
    pageQ.refetch();
    settingsQ.refetch();
  };

  return (
    <SubScreen
      eyebrow={meta.eyebrow}
      title={meta.title}
      subtitle={meta.subtitle}
      icon={meta.icon}
      refreshing={pageQ.isRefetching || settingsQ.isRefetching}
      onRefresh={refetch}
    >
      {slug === "about-us" ? (
        <View style={{ gap: 12 }}>
          <Card style={{ padding: 16 }}>
            <Text style={type.body}>
              DriveMeGo connects people with safe, affordable and dependable shared transport. We work with trusted transport partners to run
              fixed routes for daily commuters, corporate teams and school children, so everyone reaches their destination on time.
            </Text>
          </Card>
          {ABOUT_POINTS.map((p) => (
            <Card key={p.title} style={styles.point}>
              <View style={styles.contactIcon}>
                <Ionicons name={p.icon} size={22} color={colors.teal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{p.title}</Text>
                <Text style={type.small}>{p.text}</Text>
              </View>
            </Card>
          ))}
        </View>
      ) : pageQ.isLoading ? (
        <Loading />
      ) : page?.content ? (
        <Card style={{ padding: 16 }}>
          <HtmlContent html={page.content} />
          {page.updatedAt ? <Text style={[type.small, { marginTop: 10 }]}>{`Last updated ${formatDate(page.updatedAt)}`}</Text> : null}
        </Card>
      ) : slug !== "contact-us" ? (
        <EmptyState icon="document-outline" title="Content not available yet" message="This page has not been published. Please check back soon." />
      ) : null}

      {slug === "contact-us" || slug === "about-us" ? (
        <View style={{ marginTop: 16, gap: 12 }}>
          <Text style={type.h2}>Get in touch</Text>
          <Card style={{ padding: 4 }}>
            <ContactRow icon="mail-outline" label="Email" value={settings.contactEmail || "support@drivemego.com"} onPress={() => Linking.openURL(`mailto:${settings.contactEmail || "support@drivemego.com"}`)} />
            {settings.contactPhone ? <ContactRow icon="call-outline" label="Phone" value={settings.contactPhone} onPress={() => Linking.openURL(`tel:${settings.contactPhone.replace(/\s+/g, "")}`)} /> : null}
            {settings.address ? (
              <ContactRow icon="location-outline" label="Address" value={settings.address} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`)} />
            ) : null}
          </Card>

          {social.length > 0 ? (
            <View style={styles.socials}>
              {social.map((s) => (
                <Pressable key={s.key} onPress={() => Linking.openURL(settings.socialLinks[s.key])} style={styles.social} accessibilityRole="link" accessibilityLabel={s.label}>
                  <Ionicons name={s.icon} size={22} color={colors.tealDark} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {isAuthenticated ? <Button title="Send us a message" icon="paper-plane-outline" onPress={() => router.push("/feedback")} /> : null}
        </View>
      ) : null}

      {slug !== "terms-and-conditions" && slug !== "privacy-policy" ? null : (
        <View style={styles.links}>
          <Pressable onPress={() => router.replace(slug === "terms-and-conditions" ? "/page/privacy-policy" : "/page/terms-and-conditions")}>
            <Text style={styles.link}>{slug === "terms-and-conditions" ? "Read Privacy Policy" : "Read Terms & Conditions"}</Text>
          </Pressable>
        </View>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  contactRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  contactIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  point: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  socials: { flexDirection: "row", gap: 12, justifyContent: "center" },
  social: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  links: { alignItems: "center", marginTop: 18 },
  link: { color: colors.tealDark, fontWeight: "800", fontSize: 14 },
});
