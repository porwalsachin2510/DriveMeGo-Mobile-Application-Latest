import { useCallback, useState } from "react";
import { Alert, Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SubScreen, errorMessage } from "../src/components/SubScreen";
import { Badge, Button, Card, EmptyState, Field, Loading, SectionTitle } from "../src/components/ui";
import { engagementService } from "../src/services";
import { formatDate } from "../src/utils/format";
import { colors, gradients } from "../src/theme";

const STATUS = {
  JOINED: { label: "Joined", tone: "teal" },
  FIRST_BOOKING: { label: "Booked", tone: "warning" },
  REWARDED: { label: "Rewarded", tone: "success" },
};

export default function ReferScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const res = await engagementService.referrals();
      setData(res?.data || null);
    } catch (e) {
      setError(errorMessage(e, "Could not load your referral details."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const copy = async () => {
    await Clipboard.setStringAsync(data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const share = () =>
    Share.share({ message: `Join me on DriveMeGo for smarter daily commutes. Use my referral code ${data.code} when you sign up.` }).catch(() => {});

  const apply = async () => {
    if (!code.trim()) return Alert.alert("Code needed", "Enter a referral code.");
    setApplying(true);
    try {
      await engagementService.applyReferral(code);
      setCode("");
      await load(false);
    } catch (e) {
      Alert.alert("Could not apply code", errorMessage(e));
    } finally {
      setApplying(false);
    }
  };

  return (
    <SubScreen eyebrow="Rewards" title="Refer a Friend" subtitle="Share DriveMeGo and invite friends to commute smarter." icon="person-add-outline" refreshing={refreshing} onRefresh={() => load(true)} keyboard>
      {loading ? (
        <Loading label="Loading..." />
      ) : error || !data ? (
        <EmptyState icon="alert-circle-outline" title="Something went wrong" message={error} action={<Button title="Try again" onPress={() => load(false)} />} />
      ) : (
        <View style={{ gap: 16 }}>
          <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your referral code</Text>
            <Text style={styles.code} selectable accessibilityLabel={`Referral code ${data.code}`}>
              {data.code}
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <Button title={copied ? "Copied" : "Copy"} variant="outline" icon={copied ? "checkmark" : "copy-outline"} onPress={copy} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Share" icon="share-social-outline" onPress={share} />
              </View>
            </View>
          </LinearGradient>

          {!data.referredBy ? (
            <Card style={{ padding: 16 }}>
              <Text style={styles.heading}>Were you referred?</Text>
              <Text style={styles.sub}>Enter your friend&apos;s code within 30 days of joining.</Text>
              <Field value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="e.g. DMG1A2B3C" autoCapitalize="characters" autoCorrect={false} maxLength={12} containerStyle={{ marginTop: 12 }} />
              <Button title="Apply Code" icon="checkmark" onPress={apply} loading={applying} />
            </Card>
          ) : (
            <Card style={{ padding: 16 }}>
              <Text style={styles.sub}>
                You joined with <Text style={{ fontWeight: "800", color: colors.navy }}>{data.referredBy.name}</Text>&apos;s code.
              </Text>
            </Card>
          )}

          <SectionTitle title="Your referrals" subtitle={`${data.total} ${data.total === 1 ? "friend" : "friends"} joined with your code`} />
          {data.referrals.length === 0 ? (
            <EmptyState icon="people-outline" title="No referrals yet" message="Share your code to see friends appear here." />
          ) : (
            <Card style={{ padding: 0 }}>
              {data.referrals.map((r, i) => (
                <View key={r._id} style={[styles.refRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.refName}>{r.name}</Text>
                    <Text style={styles.refDate}>{formatDate(r.joinedAt)}</Text>
                  </View>
                  <Badge label={STATUS[r.status]?.label || r.status} tone={STATUS[r.status]?.tone || "teal"} />
                </View>
              ))}
            </Card>
          )}
        </View>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  codeCard: { borderRadius: 24, padding: 20 },
  codeLabel: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: 1 },
  code: { fontSize: 32, fontWeight: "800", color: colors.white, letterSpacing: 3, marginTop: 6 },
  heading: { fontSize: 16, fontWeight: "800", color: colors.navy },
  sub: { fontSize: 13.5, color: colors.muted, marginTop: 4, lineHeight: 19 },
  refRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  refName: { fontSize: 14.5, fontWeight: "800", color: colors.navy },
  refDate: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
