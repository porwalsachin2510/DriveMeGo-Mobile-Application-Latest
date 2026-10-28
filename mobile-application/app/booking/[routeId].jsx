import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { AppHeader } from "../../src/components/AppHeader";
import { DateField } from "../../src/components/DateField";
import { Button, Card, Chip, EmptyState, Loading, SectionTitle } from "../../src/components/ui";
import { routeService } from "../../src/services";
import { routeStore } from "../../src/lib/routeStore";
import { useAuth } from "../../src/context/AuthContext";
import { WEEK_DAYS, addMonths, countTravelDays, formatDateNumeric, formatMoney, normalizeDay, toISODate } from "../../src/utils/format";
import { colors, radius, type } from "../../src/theme";

const FULL_DAY = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const DURATIONS = [1, 2, 3, 6, 12];

const buildTrips = (tripTimes, route) => {
  const trips = [];
  (tripTimes || []).forEach((trip) => {
    if (trip.tripType === "One Way") {
      const ret = trip.direction === "return";
      trips.push({
        ...trip,
        key: String(trip._id || `${trip.departureTime}-${ret}`),
        direction: ret ? "return" : "outbound",
        fromLocation: ret ? route.toLocation : route.fromLocation,
        toLocation: ret ? route.fromLocation : route.toLocation,
        arrivalTime: trip.destinationArrivalTime || trip.arrivalTime || "",
      });
    } else if (trip.tripType === "Round Trip") {
      if (trip.departureTime) {
        trips.push({
          ...trip,
          key: `${trip._id}_outbound`,
          direction: "outbound",
          fromLocation: route.fromLocation,
          toLocation: route.toLocation,
          arrivalTime: trip.destinationArrivalTime || "",
        });
      }
      if (trip.arrivalTime) {
        trips.push({
          ...trip,
          key: `${trip._id}_return`,
          direction: "return",
          fromLocation: route.toLocation,
          toLocation: route.fromLocation,
          departureTime: trip.arrivalTime,
          arrivalTime: trip.returnArrivalTime || "",
        });
      }
    }
  });
  return trips.filter((t) => t.departureTime);
};

export default function Booking() {
  const router = useRouter();
  const { routeId } = useLocalSearchParams();
  const { user } = useAuth();
  const stored = routeStore.getRoute();
  const [route, setRoute] = useState(stored && String(stored.routeId || stored._id) === String(routeId) ? stored : null);

  useQuery({
    queryKey: ["route-details", routeId],
    enabled: !route,
    queryFn: async () => {
      const res = await routeService.details(routeId);
      const r = res.route || res.data || res;
      setRoute(r);
      return r;
    },
  });

  const mongoId = route?._id || route?.routeId || routeId;
  const { data: sched, isLoading: loadingSched } = useQuery({
    queryKey: ["route-schedules", mongoId],
    enabled: !!mongoId,
    queryFn: () => routeService.schedules(mongoId),
  });

  const trips = useMemo(
    () => (route ? buildTrips(sched?.allTripTimes?.length ? sched.allTripTimes : route.tripTimes, route) : []),
    [sched, route],
  );
  const outbound = trips.filter((t) => t.direction === "outbound");
  const returns = trips.filter((t) => t.direction === "return");

  const [passType, setPassType] = useState("ONE_WAY");
  const [outKey, setOutKey] = useState(null);
  const [retKey, setRetKey] = useState(null);
  const [duration, setDuration] = useState(1);
  const [start, setStart] = useState(new Date());
  const [end, setEnd] = useState(addMonths(new Date(), 1));
  const [seats, setSeats] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!outKey && outbound.length) setOutKey(outbound[0].key);
    if (!retKey && returns.length) setRetKey(returns[0].key);
  }, [outbound, returns, outKey, retKey]);

  useEffect(() => {
    const earliest = route?.startDate ? new Date(route.startDate) : null;
    if (earliest && earliest > new Date()) {
      setStart(earliest);
      setEnd(addMonths(earliest, duration));
    }
  }, [route?.startDate]);

  if (!route) return <Screen header={<AppHeader onBack={() => router.back()} />}><Loading label="Loading route..." /></Screen>;

  const currency = route.pricing?.currency || route.currency || "AED";
  const monthly = (type_) =>
    type_ === "ONE_WAY"
      ? route.pricing?.monthlyOneWayPrice || route.monthlyOneWayPrice || route.monthlyPrice || 0
      : route.pricing?.monthlyRoundTripPrice || route.monthlyRoundTripPrice || 0;

  const routeDays = (() => {
    const set = new Set((route.availableDays || []).map(normalizeDay).filter(Boolean));
    return set.size ? WEEK_DAYS.filter((d) => set.has(d)) : WEEK_DAYS;
  })();

  const effectiveMonths = (() => {
    let m = 0;
    while (m < 120 && addMonths(start, m + 1) <= end) m += 1;
    return Math.max(1, m);
  })();
  const travelDays = countTravelDays(start, end, routeDays);
  const total = monthly(passType) * effectiveMonths * seats;
  const available = route.availableSeats ?? route.totalSeats ?? 10;

  const pickDuration = (m) => {
    setDuration(m);
    setEnd(addMonths(start, m));
  };

  const onStart = (d) => {
    setStart(d);
    setEnd(addMonths(d, duration));
  };

  const onEnd = (d) => {
    setEnd(d);
    let m = 0;
    while (m < 120 && addMonths(start, m + 1) <= d) m += 1;
    setDuration(Math.max(1, m));
  };

  const next = () => {
    const out = outbound.find((t) => t.key === outKey) || outbound[0];
    const ret = returns.find((t) => t.key === retKey);
    if (outbound.length && !out) return;
    if (passType === "ROUND_TRIP" && !ret) return alert("Please select a return trip time.");
    if (!monthly(passType)) return alert("Pricing is not available for this pass type.");

    routeStore.setDraft({
      route,
      currency,
      summary: {
        passType,
        start: toISODate(start),
        end: toISODate(end),
        months: effectiveMonths,
        seats,
        travelDays,
        monthly: monthly(passType),
        outboundTime: out?.departureTime,
        returnTime: ret?.departureTime,
      },
      payload: {
        passengerId: user?.id || user?._id,
        routeId: route._id || route.id || route.routeId,
        scheduleId: out?.scheduleId || sched?.schedules?.[0]?._id || route.scheduleId || route._id,
        passType,
        outboundTripTime: out?.departureTime || "",
        returnTripTime: passType === "ROUND_TRIP" ? ret?.departureTime || "" : "",
        pickupLocation: route.fromLocation,
        dropoffLocation: route.toLocation,
        returnPickupLocation: passType === "ROUND_TRIP" ? route.toLocation : "",
        returnDropoffLocation: passType === "ROUND_TRIP" ? route.fromLocation : "",
        durationMonths: effectiveMonths,
        numberOfSeats: seats,
        selectedDays: routeDays.map((d) => FULL_DAY[d]),
        totalAmount: Number(total.toFixed(2)),
        currency,
        notes,
        customStartDate: toISODate(start),
        customEndDate: toISODate(end),
        actualTravelDays: travelDays,
      },
    });
    router.push("/payment");
  };

  const footer = (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Button title="Cancel" variant="outline" icon="close" onPress={() => router.back()} />
      </View>
      <View style={{ flex: 1.6 }}>
        <Button title="Continue to Payment" onPress={next} disabled={loadingSched} />
      </View>
    </View>
  );

  return (
    <Screen header={<AppHeader onBack={() => router.back()} />} footer={footer}>
      <Text style={type.display}>Book Your Ride</Text>
      <Text style={[type.body, { color: colors.muted, marginBottom: 16 }]}>Choose your trip, pass type and dates to continue.</Text>

      <Card style={styles.path}>
        <View style={{ flex: 1 }}>
          <Text style={type.h3} numberOfLines={1}>{route.fromLocation}</Text>
          <Text style={type.small}>Pickup</Text>
        </View>
        <Ionicons name="bus" size={22} color={colors.teal} />
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={type.h3} numberOfLines={1}>{route.toLocation}</Text>
          <Text style={type.small}>Dropoff</Text>
        </View>
      </Card>

      <Section icon="swap-horizontal" title="Outbound Trip (Going)" />
      {loadingSched ? <Loading /> : outbound.length ? (
        outbound.map((t) => <TripOption key={t.key} trip={t} route={route} selected={t.key === outKey} onPress={() => setOutKey(t.key)} available={available} />)
      ) : <Text style={type.small}>Trip times will be arranged with the provider.</Text>}

      {passType === "ROUND_TRIP" ? (
        <>
          <Section icon="return-down-back" title="Return Trip (Coming Back)" />
          {returns.map((t) => <TripOption key={t.key} trip={t} route={route} selected={t.key === retKey} onPress={() => setRetKey(t.key)} available={available} />)}
        </>
      ) : null}

      <Section icon="ticket-outline" title="Pass Type" />
      <View style={{ gap: 10 }}>
        <PassOption title="One Way Monthly Pass" price={formatMoney(monthly("ONE_WAY"), currency)} desc="Travel one direction every day, monthly." selected={passType === "ONE_WAY"} onPress={() => setPassType("ONE_WAY")} />
        <PassOption
          title="Round Trip Monthly Pass"
          price={formatMoney(monthly("ROUND_TRIP"), currency)}
          desc="Travel both directions every day, monthly."
          selected={passType === "ROUND_TRIP"}
          disabled={!returns.length || !monthly("ROUND_TRIP")}
          onPress={() => setPassType("ROUND_TRIP")}
        />
      </View>

      <Section icon="calendar-outline" title="Route Travel Days" right={`${routeDays.length} Days/Week`} />
      <View style={styles.wrap}>
        {WEEK_DAYS.map((d) => (
          <View key={d} style={[styles.dayPill, routeDays.includes(d) && styles.dayPillOn]}>
            <Text style={[styles.dayText, routeDays.includes(d) && { color: "#fff" }]}>{d}</Text>
          </View>
        ))}
      </View>

      <Section icon="time-outline" title="Pass Duration" />
      <View style={styles.wrap}>
        {DURATIONS.map((m) => <Chip key={m} label={`${m} Month${m > 1 ? "s" : ""}`} active={duration === m} onPress={() => pickDuration(m)} />)}
      </View>

      <Section icon="calendar-number-outline" title="Custom Date Range" />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <DateField label="Start Date" value={start} onChange={onStart} minimumDate={new Date()} />
        <DateField label="End Date" value={end} onChange={onEnd} minimumDate={start} />
      </View>
      <Text style={[type.small, { marginTop: 8 }]}>Minimum pass duration is 1 month.</Text>

      <Section icon="person-add-outline" title="Number of Seats" />
      <View style={styles.stepper}>
        <Pressable onPress={() => setSeats((s) => Math.max(1, s - 1))} style={styles.stepBtn} accessibilityLabel="Decrease seats"><Ionicons name="remove" size={20} color={colors.teal} /></Pressable>
        <Text style={styles.stepValue}>{seats}</Text>
        <Pressable onPress={() => setSeats((s) => Math.min(Math.max(1, available), s + 1))} style={styles.stepBtn} accessibilityLabel="Increase seats"><Ionicons name="add" size={20} color={colors.teal} /></Pressable>
        <Text style={[type.small, { marginLeft: 10 }]}>{available} available</Text>
      </View>

      <Section icon="create-outline" title="Additional Notes (Optional)" />
      <TextInput value={notes} onChangeText={setNotes} placeholder="Any special requirements or notes..." placeholderTextColor={colors.subtle} style={styles.notes} multiline />

      <Card style={{ marginTop: 22 }}>
        <Text style={[type.h3, { marginBottom: 12 }]}>Order Summary</Text>
        <Row k="Pass Type" v={passType === "ONE_WAY" ? "One Way Monthly Pass" : "Round Trip Monthly Pass"} />
        <Row k="Pass Period" v={`${formatDateNumeric(start)} - ${formatDateNumeric(end)}`} />
        <Row k="Monthly Price" v={`${formatMoney(monthly(passType), currency)}/month`} />
        <Row k="Travel Days" v={`${travelDays} days (${routeDays.length} days/week)`} />
        <Row k="Seats" v={`x${seats}`} />
        <View style={styles.totalRow}>
          <Text style={[type.small, { color: colors.tealDark, fontWeight: "700" }]}>Total ({effectiveMonths} month{effectiveMonths > 1 ? "s" : ""})</Text>
          <Text style={styles.total}>{formatMoney(total, currency)}</Text>
        </View>
      </Card>
    </Screen>
  );
}

function Section({ icon, title, right }) {
  return (
    <View style={{ marginTop: 22, marginBottom: 10 }}>
      <SectionTitle icon={icon} title={title} right={right ? <Text style={styles.rightPill}>{right}</Text> : null} />
    </View>
  );
}

function TripOption({ trip, route, selected, onPress, available }) {
  return (
    <Pressable onPress={onPress} style={[styles.trip, selected && styles.selected]}>
      <View style={{ flex: 1 }}>
        <Text style={type.h3}>{trip.departureTime}{trip.arrivalTime ? `  -  ${trip.arrivalTime}` : ""}</Text>
        <Text style={type.small} numberOfLines={1}>{trip.fromLocation} → {trip.toLocation}</Text>
        <Text style={type.small}>{route.operator} · {available} seats available</Text>
      </View>
      <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={24} color={selected ? colors.teal : colors.subtle} />
    </Pressable>
  );
}

function PassOption({ title, price, desc, selected, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.trip, selected && styles.selected, disabled && { opacity: 0.5 }]}>
      <View style={{ flex: 1 }}>
        <Text style={type.h3}>{title}</Text>
        <Text style={{ color: colors.teal, fontWeight: "800", marginVertical: 2 }}>{price}/month</Text>
        <Text style={type.small}>{disabled ? "Not available for this route." : desc}</Text>
      </View>
      <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={24} color={selected ? colors.teal : colors.subtle} />
    </Pressable>
  );
}

function Row({ k, v }) {
  return (
    <View style={styles.row}>
      <Text style={type.small}>{k}</Text>
      <Text style={[type.body, { fontWeight: "600", flexShrink: 1, textAlign: "right" }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  path: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  trip: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 },
  selected: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  rightPill: { fontSize: 12, fontWeight: "700", color: colors.tealDark, backgroundColor: colors.tealSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: "hidden" },
  dayPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  dayPillOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  dayText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  stepper: { flexDirection: "row", alignItems: "center" },
  stepBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  stepValue: { width: 50, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.navy },
  notes: { minHeight: 70, backgroundColor: "#fff", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, fontSize: 15, color: colors.navy, textAlignVertical: "top" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.tealSoft },
  total: { fontSize: 20, fontWeight: "800", color: colors.tealDark },
});
