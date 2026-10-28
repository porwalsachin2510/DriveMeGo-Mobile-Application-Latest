import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AuthShell } from "../../src/components/AuthShell";
import { Button, Field } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { getErrorMessage } from "../../src/api/client";
import { colors, radius, shadow, type } from "../../src/theme";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const submit = async () => {
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Enter a valid email address";
    if (!password) next.password = "Password is required";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await login(email, password);
      router.replace("/(tabs)");
    } catch (error) {
      const data = error?.response?.data;
      if (data?.requiresVerification || data?.needsVerification || /verif/i.test(data?.message || "")) {
        router.push({ pathname: "/(auth)/verify-email", params: { email: email.trim().toLowerCase() } });
        return;
      }
      Alert.alert("Sign in failed", getErrorMessage(error, "Invalid email or password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <View style={styles.accent} />
      <Text style={[type.h3, { fontWeight: "600", marginBottom: 2 }]}>Welcome Back</Text>
      <Text style={[type.display, { fontSize: 28 }]}>Sign in to your account</Text>
      <Text style={[type.body, { color: colors.muted, marginTop: 6, marginBottom: 24 }]}>
        Continue your journey with Drive Me Go.
      </Text>

      <View style={[styles.card, shadow]}>
        <Field
          label="Email Address"
          required
          icon="mail-outline"
          placeholder="Enter your email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          error={errors.email}
        />
        <Field
          label="Password"
          required
          icon="lock-closed-outline"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          error={errors.password}
          containerStyle={{ marginBottom: 8 }}
          onSubmitEditing={submit}
          right={
            <Pressable onPress={() => setShow((v) => !v)} hitSlop={10} accessibilityLabel="Toggle password visibility">
              <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={22} color={colors.navySoft} />
            </Pressable>
          }
        />
        <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={{ alignSelf: "flex-end", marginBottom: 20 }} hitSlop={8}>
          <Text style={{ color: colors.teal, fontWeight: "700", fontSize: 14 }}>Forgot password?</Text>
        </Pressable>
        <Button title="Sign In" onPress={submit} loading={loading} />
        <View style={styles.secure}>
          <Ionicons name="lock-closed" size={16} color={colors.teal} />
          <Text style={type.small}>Secured with 256-bit encryption</Text>
        </View>
        <View style={styles.footerRow}>
          <Text style={type.small}>{"Don't have an account? "}</Text>
          <Pressable onPress={() => router.replace("/(auth)/register")} hitSlop={8}>
            <Text style={{ color: colors.teal, fontWeight: "800", fontSize: 13 }}>Sign up →</Text>
          </Pressable>
        </View>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  accent: { width: 44, height: 4, borderRadius: 2, backgroundColor: colors.teal, marginTop: 28, marginBottom: 14 },
  card: { backgroundColor: "#fff", borderRadius: radius.xl, padding: 20, borderWidth: 1, borderColor: colors.border },
  secure: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20 },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 14 },
});
