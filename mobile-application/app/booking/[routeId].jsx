import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { AppHeader, resolveImage } from "../../src/components/AppHeader";
import { DateField } from "../../src/components/DateField";
import { Button, Loading } from "../../src/components/ui";
import { routeService } from "../../src/services";
import { routeStore } from "../../src/lib/routeStore";
import { useAuth } from "../../src/context/AuthContext";
import { WEEK_DAYS, addMonths, countTravelDays, formatDateNumeric, formatMoney, normalizeDay, toISODate } from "../../src/utils/format";
import { colors, radius, shadow, type } from "../../src/theme";

const FULL_DAY = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const DURATIONS = [1, 2, 3, 6, 12];
const MAX_SEATS_PER_USER = 1;

const buildTrips = (tripTimes, route) => {
  const trips = [];
  (tripTimes || []).forEach((trip) => {
    if (trip.tripType === "Round Trip") {
      if (trip.departureTime) {
        trips.push({
          ...trip,
          key: `${trip._id || trip.departureTime}_outbound`,
          direction: "outbound",
          fromLocation: route.fromLocation,
          toLocation: route.toLocation,
          arrivalTime: trip.destinationArrivalTime || "",
        });
      }
      if (trip.arrivalTime) {
        trips.push({
          ...trip,
          key: `${trip._id || trip.arrivalTime}_return`,
          direction: "return",
          fromLocation: route.toLocation,
          toLocation: route.fromLocation,
          departureTime: trip.arrivalTime,
          arrivalTime: trip.returnArrivalTime || "",
        });
      }
    } else {
      const ret = trip.direction === "return";
      trips.push({
        ...trip,
        key: String(trip._id || `${trip.departureTime}-${ret}`),
        direction: ret ? "return" : "outbound",
        fromLocation: ret ? route.toLocation : route.fromLocation,
        toLocation: ret ? route.fromLocation : route.toLocation,
        arrivalTime: trip.destinationArrivalTime || trip.arrivalTime || "",
      });
    }
  });
  const seen = new Set();
  return trips.filter((t) => {
    const id = `${t.departureTime}_${t.direction}`;
    if (!t.departureTime || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const earliestStart = (route) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rs = route?.startDate ? new Date(route.startDate) : null;
  if (rs && !Number.isNaN(rs.getTime())) {
    rs.setHours(0, 0, 0, 0);
    if (rs > today) return rs;
  }
  return today;
};

export default function Booking() {
  const router = useRouter();
  const { routeId } = useLocalSearchParams();
  const { user } = useAuth();
  const stored = routeStore.getRoute();
  const initial = stored && String(stored.routeId || stored._id) === String(routeId) ? stored : null;

  const { data: fetched } = useQuery({
    queryKey: ["route-details", routeId],
    enabled: !initial,
    queryFn: async () => {
      const res = await routeService.details(routeId);
      return res.route || res.data || res;
    },
  });
  const route = initial || fetched;

  const mongoId = route?._id || route?.routeId || routeId;
  const { data: sched, isLoading: loadingSched } = useQuery({
    queryKey: ["route-schedules", mongoId],
    enabled: !!mongoId,
    queryFn: () => routeService.schedules(mongoId),
  });
  const { data: seatData } = useQuery({
    queryKey: ["route-seats", mongoId],
    enabled: !!mongoId,
    queryFn: () => routeService.seatAvailability(mongoId),
  });
  const seatMap = seatData?.seatAvailability || {};

  const activeSchedule = useMemo(() => {
    const list = sched?.schedules || [];
    return list.find((s) => s.isActive) || list[0] || null;
  }, [sched]);

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
  const [start, setStart] = useState(() => earliestStart(initial));
  const [end, setEnd] = useState(() => addMonths(earliestStart(initial), 1));
  const [seats, setSeats] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!initial && route) {
      const s = earliestStart(route);
      setStart(s);
      setEnd(addMonths(s, 1));
    }
  }, [route?._id]);

  const seatsFor = (trip) => {
    const info = trip ? seatMap[`${trip.departureTime}_${trip.direction}`] : null;
    if (info) return info;
    return { availableSeats: route?.availableSeats ?? route?.totalSeats ?? null, totalSeats: route?.totalSeats ?? null };
  };

  useEffect(() => {
    const firstOpen = (list) => list.find((t) => (seatsFor(t).availableSeats ?? 1) > 0) || null;
    if (!outKey && outbound.length) setOutKey(firstOpen(outbound)?.key || null);
    if (!retKey && returns.length) setRetKey(firstOpen(returns)?.key || null);
  }, [outbound.length, returns.length, seatData]);

  if (!route) {
    return (
      <Screen header={<AppHeader onBack={() => router.back()} />}>
        <Loading label="Loading route..." />
      </Screen>
    );
  }

  const currency = route.pricing?.currency || route.currency || "AED";
  const monthly = (t) =>
    Number(
      t === "ONE_WAY"
        ? route.pricing?.monthlyOneWayPrice || route.monthlyOneWayPrice || route.monthlyPrice || 0
        : route.pricing?.monthlyRoundTripPrice || route.monthlyRoundTripPrice || 0,
    );

  const set = new Set((route.availableDays || []).map(normalizeDay).filter(Boolean));
  const routeDays = set.size ? WEEK_DAYS.filter((d) => set.has(d)) : WEEK_DAYS;

  let effectiveMonths = 0;
  while (effectiveMonths < 120 && addMonths(start, effectiveMonths + 1) <= end) effectiveMonths += 1;
  effectiveMonths = Math.max(1, effectiveMonths);

  const travelDays = countTravelDays(start, end, routeDays);
  const total = monthly(passType) * effectiveMonths * seats;
  const minStart = earliestStart(route);

  const selectedOut = outbound.find((t) => t.key === outKey);
  const selectedRet = returns.find((t) => t.key === retKey);

  const pickDuration = (m) => {
    setDuration(m);
    setEnd(addMonths(start, m));
  };
  const onStart = (d) => {
    setStart(d);
    setEnd(addMonths(d, duration));
  };
  const onEnd = (d) => {
    if (d < addMonths(start, 1)) {
      Alert.alert("Invalid date range", "Minimum pass duration is 1 month.");
      return;
    }
    setEnd(d);
    let m = 0;
    while (m < 120 && addMonths(start, m + 1) <= d) m += 1;
    setDuration(Math.max(1, m));
  };

  const next = () => {
    if (!user) return router.push("/(auth)/login");
    if (outbound.length && !selectedOut) return Alert.alert("Select a trip", "Please select a trip time before continuing.");
    if (selectedOut && (seatsFor(selectedOut).availableSeats ?? 1) <= 0) {
      return Alert.alert("Trip full", "This trip is fully booked. Please choose another time.");
    }
    if (passType === "ROUND_TRIP") {
      if (!returns.length) return Alert.alert("Not available", "No return trips available. Please choose a One Way pass.");
      if (!selectedRet) return Alert.alert("Select a return trip", "Please select a return trip time before continuing.");
      if ((seatsFor(selectedRet).availableSeats ?? 1) <= 0) {
        return Alert.alert("Trip full", "The return trip is fully booked. Please choose another time.");
      }
    }
    if (!monthly(passType)) return Alert.alert("Unavailable", "Pricing is not available for this pass type.");

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
        outboundTime: selectedOut?.departureTime,
        returnTime: selectedRet?.departureTime,
      },
      payload: {
        passengerId: user?.id || user?._id,
        routeId: route._id || route.id || route.routeId,
        scheduleId: activeSchedule?._id || route.scheduleId || route._id,
        passType,
        outboundTripTime: selectedOut?.departureTime || "",
        returnTripTime: passType === "ROUND_TRIP" ? selectedRet?.departureTime || "" : "",
        pickupLocation: route.fromLocation,
        dropoffLocation: route.toLocation,
        returnPickupLocation: passType === "ROUND_TRIP" ? route.toLocation : "",
        returnDropoffLocation: passType === "ROUND_TRIP" ? route.fromLocation : "",
        durationMonths: effectiveMonths,
        numberOfSeats: seats,
        selectedDays: routeDays.map((d) => FULL_DAY[d]),
        totalAmount: Number(total.toFixed(currency === "KWD" ? 3 : 2)),
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
      <Pressable onPress={() => router.back()} style={styles.cancel} accessibilityRole="button">
        <Ionicons name="close" size={20} color={colors.navySoft} />
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
      <View style={{ flex: 1.5 }}>
        <Button title="Continue to Payment" onPress={next} disabled={loadingSched} />
      </View>
    </View>
  );

  return (
    <Screen header={<AppHeader onBack={() => router.back()} />} footer={footer}>
      <Text style={type.display}>Book Your Ride</Text>
      <Text style={[type.body, { color: colors.muted, marginBottom: 16 }]}>Choose your trip, pass type and dates to continue.</Text>

      <View style={[styles.path, shadow]}>
        <PathEnd name={route.fromLocation} label="Pickup" />
        <View style={styles.pathMid}>
          <Ionicons name="bus" size={20} color={colors.teal} />
          <View style={styles.dash} />
        </View>
        <PathEnd name={route.toLocation} label="Dropoff" alignEnd />
      </View>

      <Section
        icon="swap-horizontal"
        title={passType === "ROUND_TRIP" ? "Select Outbound Trip (Going)" : "Select Trip Time"}
        badge={outbound.length ? "AVAILABLE" : null}
      />
      {loadingSched ? (
        <Loading />
      ) : outbound.length ? (
        outbound.map((t) => (
          <TripOption key={t.key} trip={t} route={route} seats={seatsFor(t)} selected={t.key === outKey} onPress={() => setOutKey(t.key)} />
        ))
      ) : (
        <Text style={type.small}>Trip times will be arranged with the provider.</Text>
      )}

      {returns.length ? (
        <>
          <Section icon="swap-horizontal" title="Select Return Trip (Coming Back)" badge="AVAILABLE" badgeTone="info" />
          {passType !== "ROUND_TRIP" ? (
            <Text style={[type.small, { marginBottom: 8 }]}>Choose a Round Trip pass to include a return journey.</Text>
          ) : null}
          {returns.map((t) => (
            <TripOption
              key={t.key}
              trip={t}
              route={route}
              seats={seatsFor(t)}
              selected={passType === "ROUND_TRIP" && t.key === retKey}
              dimmed={passType !== "ROUND_TRIP"}
              onPress={() => {
                setRetKey(t.key);
                if (monthly("ROUND_TRIP")) setPassType("ROUND_TRIP");
              }}
            />
          ))}
        </>
      ) : null}

      <Section icon="ticket-outline" title="Select Pass Type" />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <PassOption
          icon="person-outline"
          title="One Way Monthly Pass"
          price={`${formatMoney(monthly("ONE_WAY"), currency)}/month`}
          desc="Travel one direction every day, monthly."
          selected={passType === "ONE_WAY"}
          onPress={() => setPassType("ONE_WAY")}
        />
        <PassOption
          icon="swap-horizontal"
          title="Round Trip Monthly Pass"
          price={monthly("ROUND_TRIP") ? `${formatMoney(monthly("ROUND_TRIP"), currency)}/month` : "Not offered"}
          desc={returns.length ? "Travel both directions every day, monthly." : "No return trips on this route."}
          selected={passType === "ROUND_TRIP"}
          disabled={!returns.length || !monthly("ROUND_TRIP")}
          onPress={() => setPassType("ROUND_TRIP")}
        />
      </View>

      <Section icon="calendar-outline" title="Route Travel Days" right={`${routeDays.length} Days/Week`} />
      <View style={styles.wrap}>
        {WEEK_DAYS.map((d) => {
          const on = routeDays.includes(d);
          return (
            <View key={d} style={[styles.dayPill, on && styles.dayPillOn]}>
              <Text style={[styles.dayText, on && { color: "#fff" }]}>{d}</Text>
            </View>
          );
        })}
      </View>

      <Section icon="time-outline" title="Pass Duration" subtitle="Quick Select" />
      <View style={styles.wrap}>
        {DURATIONS.map((m) => {
          const on = duration === m;
          return (
            <Pressable key={m} onPress={() => pickDuration(m)} style={[styles.durPill, on && styles.dayPillOn]} accessibilityState={{ selected: on }}>
              <Text style={[styles.dayText, on && { color: "#fff" }]}>{`${m} Month${m > 1 ? "s" : ""}`}</Text>
            </Pressable>
          );
        })}
      </View>

      <Section icon="calendar-number-outline" title="Custom Date Range" />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <DateField label="Start Date" value={start} onChange={onStart} minimumDate={minStart} />
        <DateField label="End Date" value={end} onChange={onEnd} minimumDate={addMonths(start, 1)} />
      </View>
      <View style={styles.hint}>
        <Ionicons name="information-circle-outline" size={15} color={colors.muted} />
        <Text style={type.small}>Minimum pass duration is 1 month.</Text>
      </View>

      <View style={styles.seatRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <Ionicons name="person-add-outline" size={22} color={colors.navy} />
          <Text style={type.h3}>Number of Seats</Text>
        </View>
        <View style={styles.stepper}>
          <Pressable onPress={() => setSeats((s) => Math.max(1, s - 1))} style={styles.stepBtn} accessibilityLabel="Decrease seats">
            <Ionicons name="remove" size={18} color={colors.tealDark} />
          </Pressable>
          <Text style={styles.stepValue}>{seats}</Text>
          <Pressable
            onPress={() => setSeats((s) => Math.min(MAX_SEATS_PER_USER, s + 1))}
            style={[styles.stepBtn, seats >= MAX_SEATS_PER_USER && { opacity: 0.4 }]}
            accessibilityLabel="Increase seats"
          >
            <Ionicons name="add" size={18} color={colors.tealDark} />
          </Pressable>
        </View>
      </View>
      <Text style={[type.small, { textAlign: "right" }]}>1 seat per user</Text>

      <Section icon="create-outline" title="Additional Notes" subtitle="Optional" />
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Any special requirements or notes..."
        placeholderTextColor={colors.subtle}
        style={styles.notes}
        multiline
        maxLength={500}
      />

      <View style={[styles.summary, shadow]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <View style={styles.summaryIcon}>
            <Ionicons name="document-text" size={18} color={colors.tealDark} />
          </View>
          <Text style={type.h3}>Order Summary</Text>
        </View>
        <View style={styles.grid}>
          <Cell k="Pass Type" v={passType === "ONE_WAY" ? "One Way Monthly Pass" : "Round Trip Monthly Pass"} />
          <Cell k="Pass Period" v={`${formatDateNumeric(start)} - ${formatDateNumeric(end)}`} />
          <Cell k="Monthly Price" v={`${formatMoney(monthly(passType), currency)}/month`} />
          <Cell k="Total Travel Days" v={`${travelDays} days (${routeDays.length} days/week)`} />
          <Cell k="Trip Time" v={[selectedOut?.departureTime, passType === "ROUND_TRIP" ? selectedRet?.departureTime : null].filter(Boolean).join(" / ") || "-"} />
          <Cell k="Number of seats" v={`x${seats}`} />
        </View>
        <View style={styles.totalRow}>
          <Text style={[type.small, { color: colors.tealDark, fontWeight: "700" }]}>
            Total Amount ({effectiveMonths} month{effectiveMonths > 1 ? "s" : ""})
          </Text>
          <Text style={styles.total}>{formatMoney(total, currency)}</Text>
        </View>
      </View>
    </Screen>
  );
}

function PathEnd({ name, label, alignEnd }) {
  return (
    <View style={[styles.pathEnd, alignEnd && { flexDirection: "row-reverse" }]}>
      <View style={styles.pin}>
        <Ionicons name="location" size={18} color="#fff" />
      </View>
      <View style={{ flex: 1, alignItems: alignEnd ? "flex-end" : "flex-start" }}>
        <Text style={styles.pathName} numberOfLines={2}>{name}</Text>
        <Text style={type.small}>{label}</Text>
      </View>
    </View>
  );
}

function Section({ icon, title, subtitle, right, badge, badgeTone }) {
  return (
    <View style={styles.section}>
      <Ionicons name={icon} size={22} color={colors.navy} />
      <View style={{ flex: 1 }}>
        <Text style={type.h3}>{title}</Text>
        {subtitle ? <Text style={type.small}>{subtitle}</Text> : null}
      </View>
      {right ? <Text style={styles.rightPill}>{right}</Text> : null}
      {badge ? (
        <Text style={[styles.rightPill, badgeTone === "info" && { backgroundColor: "#EEE8FD", color: "#6D28D9" }, { fontSize: 11 }]}>{badge}</Text>
      ) : null}
    </View>
  );
}

function TripOption({ trip, route, seats, selected, onPress, dimmed }) {
  const logo = resolveImage(route.companyLogo);
  const full = seats.availableSeats !== null && seats.availableSeats <= 0;
  const vehicle = route.vehicleModel || route.vehicle?.model || route.vehicleType || "Assigned vehicle";
  return (
    <Pressable
      onPress={onPress}
      disabled={full}
      style={[styles.trip, selected && styles.selected, (dimmed || full) && { opacity: 0.6 }]}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: full }}
    >
      <View style={styles.tripLogo}>
        {logo ? <Image source={{ uri: logo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="business" size={20} color={colors.warning} />}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={styles.tripOperator} numberOfLines={1}>{route.operator || "Verified partner"}</Text>
          <Ionicons name="checkmark-circle" size={14} color={colors.info} />
        </View>
        <View style={styles.tripLine}>
          <Ionicons name="time-outline" size={14} color={colors.navy} />
          <Text style={styles.tripTime}>{trip.departureTime}{trip.arrivalTime ? ` – ${trip.arrivalTime}` : ""}</Text>
        </View>
        <View style={styles.tripLine}>
          <Ionicons name="location" size={13} color={colors.navySoft} />
          <Text style={styles.tripSmall} numberOfLines={1}>{trip.fromLocation} → {trip.toLocation}</Text>
        </View>
        <View style={styles.tripLine}>
          <Ionicons name="bus-outline" size={13} color={colors.muted} />
          <Text style={styles.tripMeta} numberOfLines={1}>
            {vehicle}
            {seats.totalSeats ? `  |  Seats: ${seats.totalSeats}` : ""}
            {seats.availableSeats !== null ? `  |  ${full ? "Full" : `Available: ${seats.availableSeats}`}` : ""}
          </Text>
        </View>
      </View>
      <Ionicons name={selected ? "checkmark-circle" : "chevron-forward"} size={22} color={selected ? colors.teal : colors.subtle} />
    </Pressable>
  );
}

function PassOption({ icon, title, price, desc, selected, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.pass, selected && styles.selected, disabled && { opacity: 0.5 }]}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !!disabled }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={styles.passIcon}>
          <Ionicons name={icon} size={20} color={colors.tealDark} />
        </View>
        <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={22} color={selected ? colors.tealDark : colors.subtle} />
      </View>
      <Text style={[type.h3, { fontSize: 14, marginTop: 8 }]}>{title}</Text>
      <Text style={styles.passPrice}>{price}</Text>
      <Text style={[type.small, { fontSize: 12 }]}>{desc}</Text>
    </Pressable>
  );
}

function Cell({ k, v }) {
  return (
    <View style={styles.cell}>
      <Text style={[type.small, { fontSize: 12 }]}>{k}</Text>
      <Text style={styles.cellValue}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  path: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  pathEnd: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  pin: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center" },
  pathName: { fontSize: 14, fontWeight: "800", color: colors.navy },
  pathMid: { width: 52, alignItems: "center", gap: 4 },
  dash: { width: 44, borderTopWidth: 1.5, borderStyle: "dashed", borderColor: colors.teal },
  section: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 22, marginBottom: 10 },
  rightPill: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.tealDark,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  trip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 10,
  },
  selected: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  tripLogo: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.warningSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tripOperator: { fontSize: 14, fontWeight: "800", color: colors.navy, flexShrink: 1 },
  tripLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  tripTime: { fontSize: 14, fontWeight: "700", color: colors.navy },
  tripSmall: { fontSize: 13, color: colors.navySoft, flexShrink: 1 },
  tripMeta: { fontSize: 11, color: colors.muted, flexShrink: 1 },
  pass: { flex: 1, padding: 12, borderRadius: radius.lg, backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.border },
  passIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  passPrice: { color: colors.teal, fontWeight: "800", fontSize: 14, marginVertical: 4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  durPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayPillOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  dayText: { fontSize: 13, fontWeight: "700", color: colors.navySoft },
  hint: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  seatRow: { flexDirection: "row", alignItems: "center", marginTop: 22 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  stepValue: { width: 44, textAlign: "center", fontSize: 17, fontWeight: "800", color: colors.navy },
  notes: {
    minHeight: 64,
    backgroundColor: "#fff",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    fontSize: 14,
    color: colors.navy,
    textAlignVertical: "top",
  },
  summary: {
    marginTop: 22,
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  cell: { width: "50%", paddingRight: 8 },
  cellValue: { fontSize: 14, fontWeight: "600", color: colors.navy, marginTop: 2 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.tealSoft,
  },
  total: { fontSize: 20, fontWeight: "800", color: colors.tealDark },
  cancel: {
    flex: 1,
    height: 56,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: { fontSize: 16, fontWeight: "700", color: colors.navySoft },
});
