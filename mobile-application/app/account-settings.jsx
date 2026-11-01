import { useCallback, useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { AppHeader } from "../src/components/AppHeader";
import { Button, Card, Field, Loading } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { accountService } from "../src/services";
import { colors, radius, type } from "../src/theme";

const NOTIFICATION_PREFS = [
  { key: "emailNotifications", icon: "mail-outline", title: "Email Notifications", sub: "Receive updates by email" },
  { key: "smsNotifications", icon: "chatbubble-outline", title: "SMS Notifications", sub: "Receive text message alerts" },
  { key: "bookingAlerts", icon: "calendar-outline", title: "Booking & Trip Alerts", sub: "Assignments, trip starts and changes" },
  { key: "paymentAlerts", icon: "card-outline", title: "Payment Alerts", sub: "Payments, refunds and settlements" },
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

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { ready, isAuthenticated, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [form, setForm] = useState({ fullName: "", whatsappNumber: "", city: "", country: "", address: "" });
  const [prefs, setPrefs] = useState({ emailNotifications: true, smsNotifications: true, bookingAlerts: true, paymentAlerts: true });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await accountService.get();
      const u = res?.user || {};
      setEmail(u.email || "");
      setPhone(u.phone ? `${u.countryCode || ""} ${u.phone}`.trim() : "");
      setForm({
        fullName: u.fullName || "",
        whatsappNumber: u.whatsappNumber || "",
        city: typeof u.city === "string" ? u.city : "",
        country: typeof u.country === "string" ? u.country : "",
        address: typeof u.address === "string" ? u.address : "",
      });
      if (u.notifications) setPrefs((p) => ({ ...p, ...u.notifications }));
    } catch (e) {
      Alert.alert("Could not load account", e?.response?.data?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (ready && !isAuthenticated) return <Redirect href="/(auth)/login" />;

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  const save = async () => {
    const fullName = form.fullName.trim();
    if (fullName.length < 2) return Alert.alert("Invalid name", "Please enter your full name.");
    setSaving(true);
    try {
      const payload = {
        fullName,
        whatsappNumber: form.whatsappNumber.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        address: form.address.trim(),
        notifications: prefs,
      };
      const res = await accountService.update(payload);
      updateUser?.({ fullName: res?.user?.fullName || fullName });
      Alert.alert("Saved", "Your account has been updated.");
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
      await accountService.changePassword(pw.current, pw.next);
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
    <Screen header={<AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace("/profile"))} />} keyboard>
      <Text style={[type.display, { marginTop: 4 }]}>Account Settings</Text>
      <Text style={[type.small, { marginBottom: 16 }]}>Manage your profile, alerts and security</Text>

      {loading ? (
        <Loading label="Loading account..." />
      ) : (
        <>
          <SectionCard icon="person-outline" title="Profile" subtitle="Your personal details">
            <Field label="Full name" icon="person-outline" value={form.fullName} onChangeText={set("fullName")} />
            <Field label="Email" icon="mail-outline" value={email} editable={false} />
            {phone ? <Field label="Phone" icon="call-outline" value={phone} editable={false} /> : null}
            <Field label="WhatsApp number" icon="logo-whatsapp" keyboardType="phone-pad" value={form.whatsappNumber} onChangeText={set("whatsappNumber")} placeholder="Optional" />
            <Field label="City" icon="business-outline" value={form.city} onChangeText={set("city")} placeholder="Optional" />
            <Field label="Country" icon="flag-outline" value={form.country} onChangeText={set("country")} placeholder="Optional" />
            <Field label="Address" icon="location-outline" value={form.address} onChangeText={set("address")} placeholder="Optional" containerStyle={{ marginBottom: 0 }} />
            <Text style={[type.small, { marginTop: 10 }]}>To change your email or phone, please contact support.</Text>
          </SectionCard>

          <SectionCard icon="notifications-outline" title="Notifications" subtitle="Choose which alerts you receive">
            {NOTIFICATION_PREFS.map((p, i) => (
              <View key={p.key} style={[styles.toggleRow, i > 0 && styles.toggleBorder]}>
                <Ionicons name={p.icon} size={22} color={colors.tealDark} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.prefLabel}>{p.title}</Text>
                  <Text style={type.small}>{p.sub}</Text>
                </View>
                <Switch
                  value={!!prefs[p.key]}
                  onValueChange={(v) => setPrefs((s) => ({ ...s, [p.key]: v }))}
                  trackColor={{ true: colors.teal, false: colors.border }}
                  thumbColor="#fff"
                  accessibilityLabel={p.title}
                />
              </View>
            ))}
          </SectionCard>

          <Button title="Save Changes" icon="save-outline" onPress={save} loading={saving} />

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
  prefLabel: { fontSize: 14.5, fontWeight: "700", color: colors.navy },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  toggleBorder: { borderTopWidth: 1, borderTopColor: colors.border },
});
