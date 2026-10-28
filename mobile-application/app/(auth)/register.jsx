import { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AuthShell } from "../../src/components/AuthShell";
import { Button, Field } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { getErrorMessage } from "../../src/api/client";
import { colors, radius, type } from "../../src/theme";

const ROLES = [
  { key: "COMMUTER", label: "COMMUTER", icon: "person-outline" },
  { key: "B2C_PARTNER", label: "B2C PARTNER", icon: "briefcase-outline" },
];

const COUNTRY_CODES = [
  { code: "+971", label: "UAE" },
  { code: "+965", label: "Kuwait" },
  { code: "+966", label: "Saudi Arabia" },
  { code: "+974", label: "Qatar" },
  { code: "+968", label: "Oman" },
  { code: "+973", label: "Bahrain" },
  { code: "+91", label: "India" },
];

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [role, setRole] = useState("COMMUTER");
  const [form, setForm] = useState({ fullName: "", whatsappNumber: "", email: "", password: "" });
  const [countryCode, setCountryCode] = useState("+971");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [show, setShow] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  };

  const submit = async () => {
    const next = {};
    if (form.fullName.trim().length < 2) next.fullName = "Enter your full name";
    if (form.whatsappNumber.replace(/\D/g, "").length < 7) next.whatsappNumber = "Enter a valid WhatsApp number";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email address";
    if (form.password.length < 6) next.password = "Password must be at least 6 characters";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await register({ ...form, role, countryCode, profileImage: photo });
      router.replace({ pathname: "/(auth)/verify-email", params: { email: form.email.trim().toLowerCase() } });
    } catch (error) {
      Alert.alert("Registration failed", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      right={
        <Pressable onPress={() => router.replace("/(auth)/login")} hitSlop={10}>
          <Text style={{ color: colors.teal, fontWeight: "700", fontSize: 15 }}>Sign in</Text>
        </Pressable>
      }
    >
      <Text style={styles.kicker}>— JOIN DRIVEMEGO</Text>
      <Text style={[type.display, { fontSize: 27 }]}>Create your account</Text>
      <Text style={[type.body, { color: colors.muted, marginTop: 6, marginBottom: 20 }]}>
        Join thousands of commuters riding verified daily routes.
      </Text>

      <View style={styles.roles}>
        {ROLES.map((r) => {
          const active = role === r.key;
          return (
            <Pressable
              key={r.key}
              onPress={() => setRole(r.key)}
              style={[styles.role, active && styles.roleActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Ionicons name={r.icon} size={28} color={active ? "#fff" : colors.tealDark} />
              <Text style={[styles.roleText, active && { color: "#fff" }]}>{r.label}</Text>
              {active ? (
                <View style={styles.check}>
                  <Ionicons name="checkmark" size={14} color={colors.teal} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Field label="Full Name" required icon="person-outline" placeholder="Enter your name" value={form.fullName} onChangeText={set("fullName")} error={errors.fullName} autoComplete="name" />

      <Text style={styles.label}>
        WhatsApp Number <Text style={{ color: colors.danger }}>*</Text>
      </Text>
      <View style={styles.phoneRow}>
        <Pressable style={styles.code} onPress={() => setPickerOpen(true)} accessibilityLabel="Choose country code">
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.navy }}>{countryCode}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.navy} />
        </Pressable>
        <Field
          icon="logo-whatsapp"
          placeholder="50 123 4567"
          value={form.whatsappNumber}
          onChangeText={set("whatsappNumber")}
          keyboardType="phone-pad"
          containerStyle={{ flex: 1, marginBottom: 0 }}
        />
      </View>
      {errors.whatsappNumber ? <Text style={styles.error}>{errors.whatsappNumber}</Text> : null}
      <View style={{ height: 16 }} />

      <Field label="Email Address" required icon="mail-outline" placeholder="your@email.com" value={form.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} />
      <Field
        label="Password"
        required
        icon="lock-closed-outline"
        placeholder="At least 6 characters"
        value={form.password}
        onChangeText={set("password")}
        secureTextEntry={!show}
        autoCapitalize="none"
        error={errors.password}
        right={
          <Pressable onPress={() => setShow((v) => !v)} hitSlop={10}>
            <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={22} color={colors.navySoft} />
          </Pressable>
        }
      />

      <Text style={styles.label}>
        Profile Image <Text style={{ fontWeight: "400", color: colors.muted }}>(optional)</Text>
      </Text>
      <Pressable onPress={pickPhoto} style={styles.upload} accessibilityLabel="Upload profile photo">
        {photo ? (
          <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <>
            <Ionicons name="camera" size={30} color={colors.tealDark} />
            <Text style={{ marginTop: 6, color: colors.navy, fontWeight: "500" }}>Upload Photo</Text>
          </>
        )}
      </Pressable>

      <View style={{ marginTop: 24 }}>
        <Button title="Create Account" onPress={submit} loading={loading} />
      </View>
      <View style={styles.secure}>
        <Ionicons name="lock-closed" size={14} color={colors.teal} />
        <Text style={type.small}>Your details are encrypted and never shared.</Text>
      </View>
      <View style={styles.footerRow}>
        <Text style={type.small}>Already have an account? </Text>
        <Pressable onPress={() => router.replace("/(auth)/login")} hitSlop={8}>
          <Text style={{ color: colors.teal, fontWeight: "800", fontSize: 13 }}>Sign in here</Text>
        </Pressable>
      </View>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={[type.h3, { marginBottom: 8 }]}>Select country code</Text>
            {COUNTRY_CODES.map((c) => (
              <Pressable
                key={c.code}
                style={styles.codeRow}
                onPress={() => {
                  setCountryCode(c.code);
                  setPickerOpen(false);
                }}
              >
                <Text style={{ fontSize: 15, color: colors.navy, fontWeight: c.code === countryCode ? "800" : "500" }}>
                  {c.label} ({c.code})
                </Text>
                {c.code === countryCode ? <Ionicons name="checkmark-circle" size={20} color={colors.teal} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.teal, fontWeight: "800", fontSize: 12, letterSpacing: 1, marginTop: 16, marginBottom: 6 },
  roles: { flexDirection: "row", gap: 12, marginBottom: 20 },
  role: {
    flex: 1,
    height: 92,
    borderRadius: radius.lg,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  roleActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  roleText: { fontSize: 13, fontWeight: "800", color: colors.navySoft, letterSpacing: 0.3 },
  check: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 14, fontWeight: "700", color: colors.navy, marginBottom: 8 },
  phoneRow: { flexDirection: "row", gap: 10 },
  code: {
    width: 96,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  error: { color: colors.danger, fontSize: 12, marginTop: 6, marginLeft: 4 },
  upload: {
    width: 120,
    height: 120,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#9ADBE3",
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  secure: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
