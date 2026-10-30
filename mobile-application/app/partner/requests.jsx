import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { PartnerHeader } from "../../src/components/partner";
import { FilterSelect } from "../../src/components/FilterSelect";
import { EmptyState, Loading } from "../../src/components/ui";
import { partnerService } from "../../src/services/partner";
import { getErrorMessage } from "../../src/api/client";
import { formatDate } from "../../src/utils/format";
import { colors, gradients, radius, shadow, type } from "../../src/theme";

const FILTERS = [
  { value: "", label: "All Demand" },
  { value: "PENDING", label: "New Demand" },
  { value: "UNDER_REVIEW", label: "Partners Interested" },
  { value: "OPEN", label: "Open to Partners" },
  { value: "FULFILLED", label: "Fulfilled" },
];

const STATUS = {
  PENDING: { bg: colors.warningSoft, color: colors.warning, label: "New Demand" },
  UNDER_REVIEW: { bg: colors.tealSoft, color: colors.tealDark, label: "Partners Interested" },
  OPEN: { bg: colors.infoSoft, color: colors.info, label: "Open to Partners" },
  APPROVED: { bg: colors.successSoft, color: colors.success, label: "Approved" },
  FULFILLED: { bg: colors.successSoft, color: colors.success, label: "Fulfilled" },
  REJECTED: { bg: colors.dangerSoft, color: colors.danger, label: "Closed" },
  COMPLETED: { bg: colors.tealSoft, color: colors.tealDark, label: "Completed" },
};

export default function PartnerRequests() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const q = useQuery({
    queryKey: ["partner", "requests", status],
    queryFn: () => partnerService.routeRequests({ limit: 50, ...(status ? { status } : {}) }),
    refetchInterval: 25000,
  });
  const rows = q.data?.data?.routeRequests || [];

  return (
    <Screen header={<PartnerHeader back />} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <View style={styles.titleRow}>
        <View style={styles.titleIcon}>
          <Ionicons name="git-pull-request-outline" size={28} color={colors.tealDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.h1}>Open Route Demand</Text>
          <Text style={type.small}>
            Express interest in passenger demand. The admin opens routes to every interested partner — publish a route to win these riders.
          </Text>
        </View>
      </View>

      <FilterSelect icon="options-outline" value={status} options={FILTERS} onChange={setStatus} title="Filter demand" style={styles.filter} />

      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <EmptyState icon="alert-circle-outline" title="Failed to load route requests" message={getErrorMessage(q.error)} />
      ) : rows.length === 0 ? (
        <EmptyState icon="chatbubble-ellipses-outline" title="No Route Requests" message="When passengers request new routes, they will appear here." />
      ) : (
        rows.map((r) => (
          <DemandCard
            key={r._id}
            request={r}
            onDone={() => qc.invalidateQueries({ queryKey: ["partner", "requests"] })}
          />
        ))
      )}
    </Screen>
  );
}

function DemandCard({ request: r, onDone }) {
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const badge = STATUS[r.status] || { bg: colors.tealTint, color: colors.muted, label: r.status };
  const closed = ["FULFILLED", "COMPLETED", "REJECTED"].includes(r.status);
  const published = r.myInterestStatus === "ROUTE_PUBLISHED";
  const interested = r.myInterestStatus === "INTERESTED";

  const respond = useMutation({
    mutationFn: (withdraw) =>
      partnerService.respondRouteRequest(r._id, {
        status: withdraw ? "REJECTED" : "INTERESTED",
        response: note,
        estimatedPrice: withdraw ? undefined : price || undefined,
      }),
    onSuccess: (_d, withdraw) => {
      Alert.alert(
        withdraw ? "Interest withdrawn" : "Interest submitted",
        withdraw ? undefined : "The admin reviews demand and opens routes to all interested partners.",
      );
      setPrice("");
      setNote("");
      onDone();
    },
    onError: (e) => Alert.alert("Could not submit", getErrorMessage(e)),
  });

  return (
    <View style={[styles.card, shadow]}>
      <View style={styles.head}>
        <View style={styles.headIcon}>
          <Ionicons name="navigate-outline" size={22} color={colors.tealDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.h3} numberOfLines={2}>
            {r.pickupLocation} {"\u2192"} {r.dropoffLocation}
          </Text>
          <Text style={[type.small, { fontSize: 12 }]}>Requested on {formatDate(r.createdAt)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>

      <View style={styles.track}>
        <Point name={r.pickupLocation} />
        <View style={styles.dash} />
        <Ionicons name="bus" size={18} color={colors.teal} />
        <View style={styles.dash} />
        <Point name={r.dropoffLocation} right />
      </View>

      <View style={styles.grid}>
        <Detail icon="person-outline" label="Passenger" value={r.passengerId?.fullName || "Anonymous"} />
        <Detail icon="mail-outline" label="Contact" value={r.passengerId?.email || "N/A"} />
        <Detail icon="time-outline" label="Preferred Time" value={r.preferredTime || "-"} />
        <Detail icon="document-text-outline" label="Request Type" value={r.requestType || "-"} />
        <Detail icon="calendar-outline" label="Travel Days" value={(r.travelDays || []).join(", ") || "-"} />
        <Detail icon="calendar-outline" label="Start Date" value={r.expectedStartDate ? formatDate(r.expectedStartDate) : "-"} />
        {r.demandCount > 1 ? <Detail icon="people-outline" label="Demand" value={`${r.demandCount} passengers`} /> : null}
      </View>

      {r.interestedCount > 0 || r.myInterestStatus ? (
        <View style={styles.interest}>
          <Ionicons name="hand-right-outline" size={14} color={colors.tealDark} />
          <Text style={[type.small, { flex: 1 }]}>
            {r.interestedCount || 0} partner{r.interestedCount === 1 ? "" : "s"} interested
          </Text>
          {published ? <Text style={styles.mine}>You published a route</Text> : interested ? <Text style={styles.mine}>You expressed interest</Text> : null}
        </View>
      ) : null}

      {published ? (
        <Note text="You've already published a route for this demand. It is now available for commuters to book." />
      ) : closed ? (
        <Note
          text={
            r.status === "FULFILLED"
              ? "A route has already been published for this demand, so it is no longer open for interest."
              : r.status === "REJECTED"
                ? "This demand has been closed by the admin."
                : "This demand is completed."
          }
        />
      ) : interested ? (
        <>
          <Note text="Once the admin opens this route, publish a route from your dashboard to serve these riders." />
          <Pressable onPress={() => respond.mutate(true)} disabled={respond.isPending} style={styles.withdraw} accessibilityRole="button">
            <Text style={styles.withdrawText}>{respond.isPending ? "Withdrawing..." : "Withdraw Interest"}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.input}>
            <Ionicons name="cash-outline" size={20} color={colors.muted} />
            <TextInput
              value={price}
              onChangeText={(t) => setPrice(t.replace(/[^0-9.]/g, ""))}
              placeholder="Estimated price (optional)"
              placeholderTextColor={colors.subtle}
              keyboardType="decimal-pad"
              style={styles.inputText}
            />
          </View>
          <View style={styles.input}>
            <Ionicons name="chatbox-ellipses-outline" size={20} color={colors.muted} />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note to the admin (optional)..."
              placeholderTextColor={colors.subtle}
              style={styles.inputText}
            />
          </View>
          <Pressable onPress={() => respond.mutate(false)} disabled={respond.isPending} accessibilityRole="button">
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cta, respond.isPending && { opacity: 0.6 }]}>
              <Text style={styles.ctaText}>{respond.isPending ? "Submitting..." : "Express Interest"}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        </>
      )}
    </View>
  );
}

function Point({ name, right }) {
  return (
    <View style={[styles.point, right && { alignItems: "flex-end" }]}>
      <Ionicons name="location" size={22} color={colors.teal} />
      <Text style={styles.pointText} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

function Detail({ icon, label, value }) {
  return (
    <View style={styles.detail}>
      <Ionicons name={icon} size={18} color={colors.muted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function Note({ text }) {
  return (
    <View style={styles.note}>
      <Ionicons name="information-circle-outline" size={16} color={colors.tealDark} />
      <Text style={[type.small, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  titleIcon: { width: 60, height: 60, borderRadius: radius.lg, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  filter: { marginBottom: 14, height: 54, justifyContent: "flex-start" },
  card: { backgroundColor: "#fff", borderRadius: radius.xl, padding: 14, marginBottom: 14, gap: 12, borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: "row", gap: 10, alignItems: "center" },
  headIcon: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "800" },
  track: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.tealTint, borderRadius: radius.lg, padding: 12 },
  point: { flex: 1.4, gap: 2 },
  pointText: { fontSize: 13, fontWeight: "700", color: colors.navy },
  dash: { flex: 0.6, borderTopWidth: 2, borderStyle: "dashed", borderColor: colors.teal, opacity: 0.6 },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  detail: { width: "50%", flexDirection: "row", gap: 8, paddingRight: 8 },
  detailLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, letterSpacing: 0.5, textTransform: "uppercase" },
  detailValue: { fontSize: 13, fontWeight: "600", color: colors.navy, marginTop: 2 },
  interest: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderColor: colors.border, paddingTop: 10 },
  mine: { fontSize: 12, fontWeight: "700", color: colors.success },
  note: { flexDirection: "row", gap: 8, backgroundColor: colors.tealTint, borderRadius: radius.md, padding: 12 },
  input: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.tealTint,
  },
  inputText: { flex: 1, fontSize: 14, color: colors.navy },
  cta: { height: 54, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  withdraw: { height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger, alignItems: "center", justifyContent: "center" },
  withdrawText: { color: colors.danger, fontWeight: "800", fontSize: 14 },
});
