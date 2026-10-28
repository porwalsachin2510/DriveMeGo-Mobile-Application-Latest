import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AuthShell } from "../../src/components/AuthShell";
import { Badge, Button } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { getErrorMessage } from "../../src/api/client";
import { colors, radius, type } from "../../src/theme";

const OTP_LENGTH = 6;
const EXPIRY_SECONDS = 600;

export default function VerifyEmail() {
  const router = useRouter();
  const { email = "" } = useLocalSearchParams();
  const { verifyEmail, resendOtp } = useAuth();
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [seconds, setSeconds] = useState(EXPIRY_SECONDS);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const refs = useRef([]);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const onChange = (index, text) => {
    const clean = text.replace(/\D/g, "");
    if (clean.length > 1) {
      const filled = clean.slice(0, OTP_LENGTH).split("");
      setDigits(Array.from({ length: OTP_LENGTH }, (_, i) => filled[i] || ""));
      refs.current[Math.min(filled.length, OTP_LENGTH - 1)]?.focus();
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
    if (clean && index < OTP_LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const onKeyPress = (index, key) => {
    if (key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus();
  };

  const submit = async () => {
    const otp = digits.join("");
    if (otp.length < OTP_LENGTH) return Alert.alert("Incomplete code", "Enter the 6-digit code sent to your email.");
    setLoading(true);
    try {
      const data = await verifyEmail(String(email), otp);
      if (data?.token) router.replace("/(tabs)");
      else {
        Alert.alert("Email verified", data?.message || "Your account is verified. Please sign in.");
        router.replace("/(auth)/login");
      }
    } catch (error) {
      Alert.alert("Verification failed", getErrorMessage(error, "Invalid or expired code."));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await resendOtp(String(email));
      setSeconds(EXPIRY_SECONDS);
      setDigits(Array(OTP_LENGTH).fill(""));
      refs.current[0]?.focus();
      Alert.alert("Code sent", "A new verification code has been sent to your email.");
    } catch (error) {
      Alert.alert("Could not resend", getErrorMessage(error));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell onBack={() => router.replace("/(auth)/login")}>
      <Badge label="Secure & Private" icon="shield-checkmark" style={{ marginTop: 12 }} />
      <Text style={[type.display, { fontSize: 36, lineHeight: 42, marginTop: 14 }]}>Email</Text>
      <Text style={[type.display, { fontSize: 36, lineHeight: 42, color: colors.teal }]}>Verification</Text>
      <View style={styles.rule} />
      <Text style={[type.body, { color: colors.muted }]}>{"We've sent a 6-digit verification code to"}</Text>
      <Text style={[type.h3, { marginTop: 2 }]}>{email}</Text>
      <Text style={[type.small, { marginTop: 10, marginBottom: 24 }]}>Please enter the code below to verify your email address.</Text>

      <View style={styles.otpRow}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => (refs.current[i] = r)}
            value={d}
            onChangeText={(t) => onChange(i, t)}
            onKeyPress={({ nativeEvent }) => onKeyPress(i, nativeEvent.key)}
            keyboardType="number-pad"
            maxLength={i === 0 ? OTP_LENGTH : 1}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            style={[styles.box, d ? styles.boxFilled : null]}
            selectionColor={colors.teal}
          />
        ))}
      </View>

      <View style={styles.timer}>
        <Ionicons name="time-outline" size={18} color={colors.teal} />
        <Text style={type.small}>
          Code expires in <Text style={{ color: colors.tealDark, fontWeight: "800", fontSize: 15 }}>{mmss}</Text>
        </Text>
      </View>

      <Button title="Verify Email" onPress={submit} loading={loading} disabled={seconds === 0} />

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={[type.small, { fontWeight: "600" }]}>{"Didn't receive the code?"}</Text>
        <View style={styles.line} />
      </View>
      <Pressable onPress={resend} disabled={resending} style={[styles.resend, resending && { opacity: 0.6 }]}>
        <Ionicons name="refresh" size={18} color={colors.teal} />
        <Text style={{ color: colors.teal, fontWeight: "700", fontSize: 15 }}>{resending ? "Sending..." : "Resend Code"}</Text>
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  rule: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.teal, marginVertical: 16 },
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  box: {
    flex: 1,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: "#CFE8EE",
    backgroundColor: "#fff",
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: colors.navy,
  },
  boxFilled: { borderColor: colors.teal },
  timer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginVertical: 22 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 28, marginBottom: 16 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  resend: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.teal,
  },
});
