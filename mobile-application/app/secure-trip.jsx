import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SubScreen, errorMessage } from "../src/components/SubScreen";
import { Badge, Button, Card, EmptyState, Field, Loading, SectionTitle } from "../src/components/ui";
import { engagementService } from "../src/services";
import { formatDate, formatMoney } from "../src/utils/format";
import { colors } from "../src/theme";

const planName = (plans, id) => plans.find((p) => p.id === id)?.name || id;
const CLAIM_TONE = { SUBMITTED: "warning", APPROVED: "success", REJECTED: "danger" };

export default function SecureTripScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [buying, setBuying] = useState(null);
  const [claimingId, setClaimingId] = useState(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const res = await engagementService.protection();
      setData(res?.data || null);
    } catch (e) {
      setError(errorMessage(e, "Could not load trip protection."));
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

  const buy = (booking, quote) => {
    const plan = data.plans.find((p) => p.id === quote.plan);
    const price = formatMoney(quote.premium, booking.currency);
    Alert.alert(plan.name, `${price} will be charged from your wallet to protect this booking. You can claim up to ${plan.refundPercent}% if you cannot travel.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: `Pay ${price}`,
        onPress: async () => {
          setBuying(`${booking._id}:${quote.plan}`);
          try {
            await engagementService.buyProtection({ bookingId: booking._id, plan: quote.plan });
            await load(false);
          } catch (e) {
            Alert.alert("Could not buy cover", errorMessage(e));
          } finally {
            setBuying(null);
          }
        },
      },
    ]);
  };

  const submitClaim = async (id) => {
    setSubmitting(true);
    try {
      await engagementService.claimProtection(id, reason);
      setClaimingId(null);
      setReason("");
      await load(false);
    } catch (e) {
      Alert.alert("Could not submit claim", errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SubScreen eyebrow="Protection" title="Secure your trip" subtitle="Travel protection and flexible cancellation options." icon="shield-checkmark-outline" refreshing={refreshing} onRefresh={() => load(true)} keyboard>
      {loading ? (
        <Loading label="Loading..." />
      ) : error || !data ? (
        <EmptyState icon="alert-circle-outline" title="Something went wrong" message={error} action={<Button title="Try again" onPress={() => load(false)} />} />
      ) : (
        <View style={{ gap: 14 }}>
          {data.plans.map((p) => (
            <Card key={p.id} style={{ padding: 16 }}>
              <View style={styles.planHead}>
                <Text style={styles.planName}>{p.name}</Text>
                <Badge label={`${Math.round(p.premiumRate * 100)}% of booking`} tone="teal" />
              </View>
              {p.perks.map((perk) => (
                <View key={perk} style={styles.perk}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.teal} />
                  <Text style={styles.perkText}>{perk}</Text>
                </View>
              ))}
            </Card>
          ))}

          <SectionTitle title="Protect a booking" subtitle="Upcoming bookings without cover" />
          {data.eligibleBookings.length === 0 ? (
            <EmptyState icon="calendar-outline" title="No bookings to protect" message="Book a route and come back to add cover." />
          ) : (
            data.eligibleBookings.map((b) => (
              <Card key={b._id} style={{ padding: 14 }}>
                <Text style={styles.route} numberOfLines={2}>
                  {b.pickupLocation} <Text style={{ color: colors.teal }}>{"\u2192"}</Text> {b.dropoffLocation}
                </Text>
                <Text style={styles.meta}>
                  {formatDate(b.travelDate || b.passStartDate)} | {formatMoney(b.paymentAmount, b.currency)}
                </Text>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  {b.quotes.map((q) => (
                    <View key={q.plan} style={{ flex: 1 }}>
                      <Button small variant={q.plan === "PLUS" ? "primary" : "outline"} icon="shield-checkmark-outline" title={`${q.plan === "PLUS" ? "Plus" : "Basic"} ${formatMoney(q.premium, b.currency)}`} loading={buying === `${b._id}:${q.plan}`} disabled={!!buying} onPress={() => buy(b, q)} />
                    </View>
                  ))}
                </View>
              </Card>
            ))
          )}

          {data.protections.length > 0 ? <SectionTitle title="Your covers" /> : null}
          {data.protections.map((p) => (
            <Card key={p._id} style={{ padding: 14 }}>
              <View style={styles.planHead}>
                <Text style={styles.route} numberOfLines={1}>
                  {p.booking?.pickupLocation} {"\u2192"} {p.booking?.dropoffLocation}
                </Text>
                {p.status === "CLAIMED" ? <Badge label={`Claim ${String(p.claim?.status || "").toLowerCase()}`} tone={CLAIM_TONE[p.claim?.status] || "warning"} /> : <Badge label="Active" tone="success" />}
              </View>
              <Text style={styles.meta}>
                {planName(data.plans, p.plan)} | {formatMoney(p.premium, p.currency)} paid | up to {p.refundPercent}% back
              </Text>
              {p.claim?.adminNote ? <Text style={styles.note}>{p.claim.adminNote}</Text> : null}
              {p.status === "ACTIVE" ? (
                claimingId === p._id ? (
                  <View style={{ marginTop: 12 }}>
                    <Field label="Why can't you travel?" value={reason} onChangeText={setReason} placeholder="Describe what happened" multiline maxLength={1000} style={{ minHeight: 90, alignItems: "flex-start" }} textAlignVertical="top" />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Button small title="Cancel" variant="outline" icon="close" onPress={() => setClaimingId(null)} disabled={submitting} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button small title="Submit claim" icon="paper-plane-outline" onPress={() => submitClaim(p._id)} loading={submitting} />
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={{ marginTop: 12 }}>
                    <Button small title="Make a claim" variant="outline" icon="document-text-outline" onPress={() => { setClaimingId(p._id); setReason(""); }} />
                  </View>
                )
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  planHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  planName: { fontSize: 17, fontWeight: "800", color: colors.navy },
  perk: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10 },
  perkText: { flex: 1, fontSize: 13.5, color: colors.muted, lineHeight: 19 },
  route: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.navy },
  meta: { fontSize: 12.5, color: colors.muted, marginTop: 4 },
  note: { fontSize: 13, color: colors.navy, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: colors.tealTint },
});
