import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AuthShell } from "../../src/components/AuthShell";
import { Button, Field } from "../../src/components/ui";
import { authService } from "../../src/services";
import { getErrorMessage } from "../../src/api/client";
import { colors, radius, shadow, type } from "../../src/theme";

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async (fn) => {
    setLoading(true);
    try {
      await fn();
    } catch (error) {
      Alert.alert("Something went wrong", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = () =>
    run(async () => {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error("Enter a valid email address");
      await authService.forgotPassword(email);
      setStep("otp");
    });

  const verifyOtp = () =>
    run(async () => {
      if (otp.length !== 6) throw new Error("Enter the 6-digit code");
      const data = await authService.verifyResetOtp(email, otp);
      setResetToken(data.resetToken);
      setStep("reset");
    });

  const reset = () =>
    run(async () => {
      if (password.length < 6) throw new Error("Password must be at least 6 characters");
      if (password !== confirm) throw new Error("Passwords do not match");
      await authService.resetPassword(email, resetToken, password);
      Alert.alert("Password updated", "You can now sign in with your new password.");
      router.replace("/(auth)/login");
    });

  const titles = {
    email: ["Forgot", "Password", "Enter your email address and we'll send you a verification code to reset your password."],
    otp: ["Verify", "Code", `We sent a 6-digit code to ${email}. Enter it below to continue.`],
    reset: ["Reset", "Password", "Choose a new password for your account."],
  }[step];

  return (
    <AuthShell onBack={() => router.back()}>
      <View style={styles.shield}>
        <Ionicons name="shield-checkmark" size={22} color={colors.teal} />
      </View>
      <Text style={[type.display, { fontSize: 34 }]}>
        {titles[0]} <Text style={{ color: colors.teal }}>{titles[1]}</Text>
      </Text>
      <Text style={[type.body, { color: colors.muted, marginTop: 8, marginBottom: 24 }]}>{titles[2]}</Text>

      <View style={[styles.card, shadow]}>
        {step === "email" ? (
          <>
            <Field
              label="Email Address"
              icon="mail-outline"
              placeholder="Enter your email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Button title="Send OTP" onPress={sendOtp} loading={loading} />
          </>
        ) : null}
        {step === "otp" ? (
          <>
            <Field
              label="Verification Code"
              icon="keypad-outline"
              placeholder="000000"
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Button title="Verify Code" onPress={verifyOtp} loading={loading} />
            <Pressable onPress={sendOtp} style={{ alignSelf: "center", marginTop: 14 }} hitSlop={8}>
              <Text style={{ color: colors.teal, fontWeight: "700" }}>Resend code</Text>
            </Pressable>
          </>
        ) : null}
        {step === "reset" ? (
          <>
            <Field label="New Password" icon="lock-closed-outline" placeholder="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
            <Field label="Confirm Password" icon="lock-closed-outline" placeholder="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" />
            <Button title="Update Password" onPress={reset} loading={loading} />
          </>
        ) : null}

        <Pressable onPress={() => router.replace("/(auth)/login")} style={{ alignSelf: "center", marginTop: 18 }} hitSlop={8}>
          <Text style={{ color: colors.teal, fontWeight: "700", fontSize: 15 }}>Back to Login</Text>
        </Pressable>
        {step === "email" ? (
          <View style={styles.info}>
            <Ionicons name="information-circle-outline" size={22} color={colors.teal} />
            <Text style={[type.small, { flex: 1, color: colors.teal }]}>{"We'll send a 6-digit verification code to your registered email address."}</Text>
          </View>
        ) : null}
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  shield: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  card: { backgroundColor: "#fff", borderRadius: radius.xl, padding: 20, borderWidth: 1, borderColor: colors.border },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.tealSoft,
  },
});
