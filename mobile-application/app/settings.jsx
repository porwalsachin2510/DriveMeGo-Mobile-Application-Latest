import { useCallback, useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Screen } from "../src/components/Screen";
import { AppHeader } from "../src/components/AppHeader";
import { FilterSelect } from "../src/components/FilterSelect";
import { Button, Card, Field, Loading } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { profileService } from "../src/services";
import { colors, radius, type } from "../src/theme";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
];

const CURRENCIES = [
  { value: "AED", label: "AED - UAE Dirham" },
  { value: "KWD", label: "KWD - Kuwait Dinar" },
  { value: "SAR", label: "SAR - Saudi Riyal" },
  { value: "BHD", label: "BHD - Bahraini Dinar" },
  { value: "OMR", label: "OMR - Omani Rial" },
  { value: "QAR", label: "QAR - Qatari Riyal" },
];

const PREFS = [
  { key: "pushNotifications", icon: "notifications-outline", title: "Push Notifications", sub: "Receive push notifications on your device" },
  { key: "marketingEmails", icon: "mail-outline", title: "Marketing Emails", sub: "Receive promotional offers and updates" },
  { key: "tripReminders", icon: "calendar-outline", title: "Trip Reminders", sub: "Get notified before your scheduled trips" },
  { key: "promotionalOffers", icon: "pricetag-outline", title: "Promotional Offers", sub: "Receive notifications about special offers" },
];

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

function SectionCard({ icon, title, subtitle, children }) {
  return (
    <Card style={{ padding: 0, marginBottom: 16, overflow: "hidden" }}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={22} color={colors.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={type.small}>{subtitle}</Text>
        </View>
      </View>
      <View style={{ padding: 14 }}>{children}</View>
    </Card>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({ fullName: "", email: "", phone: "", language: "en", currency: "AED" });
  const [prefs, setPrefs] = useState({ pushNotifications: true, marketingEmails: false, tripReminders: true, promotionalOffers: true });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await profileService.get();
      if (res?.profile) {
        setProfile({
          fullName: res.profile.fullName || "",
          email: res.profile.email || "",
          phone: res.profile.phone || "",
          language: res.profile.language || "en",
          currency: res.profile.currency || "AED",
        });
      }
      if (res?.preferences) setPrefs((p) => ({ ...p, ...res.preferences }));
    } catch (e) {
      Alert.alert("Could not load settings", e?.response?.data?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const saveProfile = async () => {
    setSaving(true);
    try {
      await profileService.update({
        profile: {
          fullName: profile.fullName.trim(),
          email: profile.email.trim(),
          phone: profile.phone.trim(),
          language: profile.language,
          currency: profile.currency,
        },
        preferences: prefs,
      });
      updateUser?.({ fullName: profile.fullName.trim(), email: profile.email.trim() });
      Alert.alert("Saved", "Your settings have been updated.");
    } catch (e) {
      Alert.alert("Could not save", e?.response?.data?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!pw.current || !pw.next) return Alert.alert("Missing details", "Enter your current and new password.");
    if (pw.next.length < 8 || !PASSWORD_RULE.test(pw.next))
      return Alert.alert("Weak password", "Use 8+ characters with upper and lower case letters, a number and a special character (@$!%*?&).");
    if (pw.next !== pw.confirm) return Alert.alert("Mismatch", "New passwords do not match.");
    setChangingPw(true);
    try {
      await profileService.changePassword(pw.current, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      Alert.alert("Password changed", "Your password has been updated.");
    } catch (e) {
      Alert.alert("Could not change password", e?.response?.data?.message || "Please try again.");
    } finally {
      setChangingPw(false);
    }
  };

  const eye = (
    <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} onPress={() => setShowPw((s) => !s)} />
  );

  return (
    <Screen header={<AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/more"))} />} keyboard>
      <Text style={[type.display, { marginTop: 4 }]}>Settings</Text>
      <Text style={[type.small, { marginBottom: 16 }]}>Personalize your DriveMeGo experience</Text>

      {loading ? (
        <Loading label="Loading settings..." />
      ) : (
        <>
          <SectionCard icon="person-outline" title="Profile" subtitle="Your personal details">
            <Field label="Full name" icon="person-outline" value={profile.fullName} onChangeText={(v) => setProfile((p) => ({ ...p, fullName: v }))} />
            <Field label="Email" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" value={profile.email} onChangeText={(v) => setProfile((p) => ({ ...p, email: v }))} />
            <Field label="Phone" icon="call-outline" keyboardType="phone-pad" value={profile.phone} onChangeText={(v) => setProfile((p) => ({ ...p, phone: v }))} containerStyle={{ marginBottom: 0 }} />
          </SectionCard>

          <SectionCard icon="globe-outline" title="Regional Preferences" subtitle="Customize your language and currency">
            <View style={{ gap: 10 }}>
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Language</Text>
                <FilterSelect icon="language-outline" title="Language" value={profile.language} options={LANGUAGES} onChange={(v) => setProfile((p) => ({ ...p, language: v }))} />
              </View>
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Currency</Text>
                <FilterSelect icon="cash-outline" title="Currency" value={profile.currency} options={CURRENCIES} onChange={(v) => setProfile((p) => ({ ...p, currency: v }))} />
              </View>
            </View>
          </SectionCard>

          <SectionCard icon="notifications-outline" title="Notifications" subtitle="Control how you receive notifications">
            {PREFS.map((p, i) => (
              <View key={p.key} style={[styles.toggleRow, i > 0 && styles.toggleBorder]}>
                <Ionicons name={p.icon} size={22} color={colors.tealDark} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.prefLabel}>{p.title}</Text>
                  <Text style={type.small}>{p.sub}</Text>
                </View>
                <Switch value={!!prefs[p.key]} onValueChange={(v) => setPrefs((s) => ({ ...s, [p.key]: v }))} trackColor={{ true: colors.teal, false: colors.border }} thumbColor="#fff" />
              </View>
            ))}
          </SectionCard>

          <Button title="Save Profile Changes" icon="save-outline" onPress={saveProfile} loading={saving} />

          <View style={{ height: 20 }} />
          <SectionCard icon="shield-checkmark-outline" title="Security" subtitle="Update your password">
            <Field label="Current password" icon="lock-closed-outline" secureTextEntry={!showPw} value={pw.current} onChangeText={(v) => setPw((p) => ({ ...p, current: v }))} right={eye} />
            <Field label="New password" icon="lock-closed-outline" secureTextEntry={!showPw} value={pw.next} onChangeText={(v) => setPw((p) => ({ ...p, next: v }))} placeholder="Enter new password" />
            <Field label="Confirm new password" icon="lock-closed-outline" secureTextEntry={!showPw} value={pw.confirm} onChangeText={(v) => setPw((p) => ({ ...p, confirm: v }))} placeholder="Confirm new password" />
            <Button title="Change Password" variant="outline" icon="key-outline" onPress={changePassword} loading={changingPw} />
          </SectionCard>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: colors.tealTint },
  sectionIcon: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 16.5, fontWeight: "800", color: colors.navy },
  prefRow: { gap: 6 },
  prefLabel: { fontSize: 14.5, fontWeight: "700", color: colors.navy },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  toggleBorder: { borderTopWidth: 1, borderTopColor: colors.border },
});
