import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../src/api/client";
import { Screen } from "../../src/components/Screen";
import { PartnerHeader, SegTabs } from "../../src/components/partner";
import { Button, Card, Field, Loading } from "../../src/components/ui";
import { DateField } from "../../src/components/DateField";
import { TripCard, emptyTrip, serializeTrips } from "../../src/components/TripEditor";
import { partnerService, scheduleService } from "../../src/services/partner";
import { formatMoney, toISODate, WEEK_DAYS } from "../../src/utils/format";
import { colors, radius, type } from "../../src/theme";

const STEPS = ["Route Basics", "Trip Schedule", "Assignments", "Pricing & Review"];
const DAY_KEY = (d) => d.toUpperCase().slice(0, 3);

function Stepper({ step }) {
  return (
    <View style={styles.stepper}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepDot, (active || done) && { backgroundColor: colors.teal, borderColor: colors.teal }]}>
              {done ? <Ionicons name="checkmark" size={16} color="#fff" /> : <Text style={[styles.stepNum, active && { color: "#fff" }]}>{n}</Text>}
            </View>
            <Text style={[styles.stepLabel, active && { color: colors.navy, fontWeight: "800" }]} numberOfLines={2}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Block({ title, children }) {
  return (
    <Card style={{ padding: 16, marginBottom: 12 }}>
      <Text style={[type.h3, { marginBottom: 12 }]}>{title}</Text>
      {children}
    </Card>
  );
}

export default function AddRoute() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    fromLocation: "",
    toLocation: "",
    startDate: new Date(),
    days: [...WEEK_DAYS],
    description: "",
    monthlyOneWayPrice: "",
    monthlyRoundTripPrice: "",
  });
  const [trips, setTrips] = useState([emptyTrip()]);
  const [errors, setErrors] = useState({});

  const routes = useQuery({ queryKey: ["partner", "routes"], queryFn: partnerService.routes });
  const fleet = useQuery({ queryKey: ["partner", "fleet"], queryFn: partnerService.fleet });
  const drivers = useQuery({ queryKey: ["partner", "drivers"], queryFn: partnerService.drivers });

  const vehicleOptions = useMemo(
    () => (fleet.data?.fleet?.vehicles || []).map((v) => ({ value: v._id, label: `${v.model} (${v.licensePlate})`, sub: `${v.seatingCapacity} seats` })),
    [fleet.data],
  );
  const driverOptions = useMemo(
    () => (drivers.data?.drivers || []).map((d) => ({ value: d._id, label: d.fullName || d.name, sub: d.isSelf ? "You" : d.phoneNumber || d.phone })),
    [drivers.data],
  );
  const routeCount = (routes.data?.routes || []).length;
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const updateTrip = (i, t) => setTrips((cur) => cur.map((x, idx) => (idx === i ? t : x)));
  const toggleDay = (d) => setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d] }));
  const weeklyTrips = trips.filter((t) => t.departureTime).length * form.days.length;

  const validate = () => {
    const next = {};
    if (step === 1) {
      if (!form.fromLocation.trim()) next.fromLocation = "From location is required";
      if (!form.toLocation.trim()) next.toLocation = "To location is required";
      if (!form.days.length) next.days = "Select at least one day";
    }
    if (step === 2) {
      if (!trips.some((t) => t.departureTime)) next.trips = "Add at least one departure time";
      if (trips.some((t) => t.departureTime && t.tripType === "Round Trip" && !t.arrivalTime)) next.trips = "Round trips need a return departure time";
    }
    if (step === 3 && trips.some((t) => t.departureTime && (!t.assignedDriver || !t.assignedVehicle))) next.assign = "Select a driver and vehicle for every trip";
    setErrors(next);
    if (next.trips || next.assign) Alert.alert("Please check", next.trips || next.assign);
    return Object.keys(next).length === 0;
  };

  const create = useMutation({
    mutationFn: async () => {
      const validTrips = serializeTrips(trips);
      const days = form.days.map(DAY_KEY);
      const startDate = toISODate(form.startDate);
      const first = trips.find((t) => t.assignedVehicle) || trips[0];
      const vehicle = (fleet.data?.fleet?.vehicles || []).find((v) => v._id === first.assignedVehicle);
      const seats = vehicle?.seatingCapacity || 20;

      try {
        const check = await api.post("/b2c-schedules/check-conflicts", {
          driverId: first.assignedDriver || null,
          vehicleId: first.assignedVehicle || null,
          tripTimes: validTrips,
          availableDays: days,
        });
        if (check.data?.hasConflicts) {
          const lines = check.data.conflicts
            .map((c) => `${c.type === "DRIVER" ? "Driver" : "Vehicle"} already assigned to "${c.existingRoute}" at ${c.conflictingTime}`)
            .join("\n");
          const proceed = await new Promise((resolve) =>
            Alert.alert("Scheduling conflict", `${lines}\n\nContinue anyway?`, [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Continue", onPress: () => resolve(true) },
            ]),
          );
          if (!proceed) return null;
        }
      } catch {
        // conflict check is advisory; backend still validates on create
      }

      const route = await scheduleService.create({
        fromLocation: form.fromLocation.trim(),
        toLocation: form.toLocation.trim(),
        totalSeats: seats,
        availableSeats: seats,
        pricing: {
          oneWayPrice: 0,
          roundTripPrice: 0,
          monthlyOneWayPrice: parseFloat(form.monthlyOneWayPrice) || 0,
          monthlyRoundTripPrice: parseFloat(form.monthlyRoundTripPrice) || 0,
          currency: "AED",
        },
        assignedVehicle: first.assignedVehicle || null,
        assignedDriver: first.assignedDriver || null,
        routeStartDate: startDate,
        description: form.description,
        tags: [],
      });
      const created = route.route;
      await scheduleService.createSchedule({
        routeId: created._id,
        scheduleName: `${created.fromLocation} to ${created.toLocation} Schedule`,
        tripTimes: validTrips,
        availableDays: days,
        assignedVehicle: first.assignedVehicle,
        assignedDriver: first.assignedDriver,
        startDate,
        notes: `Auto-created schedule for ${created.fromLocation} → ${created.toLocation}`,
      });
      return created;
    },
    onSuccess: (created) => {
      if (!created) return;
      qc.invalidateQueries({ queryKey: ["partner"] });
      router.replace({
        pathname: "/partner/route-created",
        params: {
          from: created.fromLocation,
          to: created.toLocation,
          start: toISODate(form.startDate),
          oneWay: String(parseFloat(form.monthlyOneWayPrice) || 0),
          roundTrip: String(parseFloat(form.monthlyRoundTripPrice) || 0),
          weekly: String(weeklyTrips),
        },
      });
    },
    onError: (e) => Alert.alert("Could not create route", e?.response?.data?.message || "Please try again."),
  });

  const next = () => validate() && setStep((s) => Math.min(4, s + 1));
  const back = () => (step === 1 ? router.back() : setStep((s) => s - 1));

  if (fleet.isLoading || drivers.isLoading) return <Screen header={<PartnerHeader back />}><Loading /></Screen>;

  return (
    <Screen header={<PartnerHeader back />} keyboard>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={type.h1}>Add New Route</Text>
          <Text style={[type.small, { color: colors.navy, fontWeight: "600" }]}>{STEPS[step - 1]}</Text>
        </View>
        <Text style={type.small}>Step {step} of 4</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginLeft: 12 }} accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={colors.navy} />
        </Pressable>
      </View>

      <SegTabs
        value="new"
        onChange={(k) => k === "existing" && router.replace("/partner/add-schedule")}
        tabs={[
          { key: "new", label: "Create New Route", icon: "calendar-outline" },
          { key: "existing", label: `Add to Existing (${routeCount})` },
        ]}
      />
      <Stepper step={step} />

      {step === 1 ? (
        <>
          <Block title="Route">
            <Field label="From Location" required icon="location-outline" value={form.fromLocation} onChangeText={set("fromLocation")} placeholder="e.g. Dubai Marina" error={errors.fromLocation} />
            <Field label="To Location" required icon="flag-outline" value={form.toLocation} onChangeText={set("toLocation")} placeholder="e.g. Global Village" error={errors.toLocation} />
          </Block>
          <Block title="Route Start Date">
            <DateField label="Start date" value={form.startDate} onChange={set("startDate")} minimumDate={new Date()} />
          </Block>
          <Block title="Available Days">
            <View style={styles.days}>
              {WEEK_DAYS.map((d) => {
                const on = form.days.includes(d);
                return (
                  <Pressable key={d} onPress={() => toggleDay(d)} style={[styles.day, on && styles.dayOn]}>
                    <Text style={[styles.dayText, on && { color: "#fff" }]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.days ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 6 }}>{errors.days}</Text> : null}
          </Block>
          <Block title="Route Description">
            <Field value={form.description} onChangeText={set("description")} multiline placeholder="Describe your route, landmarks, etc." style={{ minHeight: 84, textAlignVertical: "top" }} />
          </Block>
        </>
      ) : null}

      {step === 2 ? (
        <>
          {trips.map((t, i) => (
            <View key={i} style={{ marginBottom: 14 }}>
              <TripCard index={i} trip={t} onChange={(v) => updateTrip(i, v)} canRemove={trips.length > 1} onRemove={() => setTrips((c) => c.filter((_, idx) => idx !== i))} />
            </View>
          ))}
          <Pressable onPress={() => setTrips((c) => [...c, emptyTrip()])} style={styles.dashed}>
            <Ionicons name="add" size={18} color={colors.tealDark} />
            <Text style={styles.dashedText}>Add Another Trip Time</Text>
          </Pressable>
        </>
      ) : null}

      {step === 3 ? (
        <>
          {trips.map((t, i) => (
            <View key={i} style={{ marginBottom: 14 }}>
              <TripCard index={i} trip={t} onChange={(v) => updateTrip(i, v)} showSchedule={false} showAssignment drivers={driverOptions} vehicles={vehicleOptions} />
            </View>
          ))}
          <Card style={{ padding: 14, marginBottom: 12 }}>
            <Text style={type.h3}>{form.fromLocation || "From"} → {form.toLocation || "To"}</Text>
          </Card>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <Block title="Pricing Details">
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Field containerStyle={{ flex: 1 }} label="One Way Monthly (AED)" value={form.monthlyOneWayPrice} onChangeText={set("monthlyOneWayPrice")} keyboardType="decimal-pad" placeholder="0.00" />
              <Field containerStyle={{ flex: 1 }} label="Round Trip Monthly (AED)" value={form.monthlyRoundTripPrice} onChangeText={set("monthlyRoundTripPrice")} keyboardType="decimal-pad" placeholder="0.00" />
            </View>
          </Block>
          <Block title="Monthly Pass Pricing">
            <Summary label="Route" value={`${form.fromLocation} → ${form.toLocation}`} />
            <Summary label="Days" value={form.days.join(", ")} />
            <Summary label="Trips per day" value={String(trips.filter((t) => t.departureTime).length)} />
            <Summary label="Total weekly trips" value={String(weeklyTrips)} />
            <View style={styles.note}>
              <Text style={styles.noteText}>Passengers get unlimited travel with a monthly pass. No daily tickets, only monthly subscriptions.</Text>
            </View>
          </Block>
          <Block title="Review Summary">
            <Summary label="Monthly (One Way)" value={formatMoney(parseFloat(form.monthlyOneWayPrice) || 0)} />
            <Summary label="Monthly (Round Trip)" value={formatMoney(parseFloat(form.monthlyRoundTripPrice) || 0)} />
            <Summary label="Total Weekly Trips" value={String(weeklyTrips)} />
          </Block>
        </>
      ) : null}

      <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
        <Button title={step === 1 ? "Cancel" : "Back"} variant="outline" icon="chevron-back" onPress={back} style={{ flex: 1 }} />
        {step < 4 ? (
          <Button title="Continue" onPress={next} style={{ flex: 1 }} />
        ) : (
          <Button title="Add Route" icon="checkmark" loading={create.isPending} onPress={() => create.mutate()} style={{ flex: 1 }} />
        )}
      </View>
    </Screen>
  );
}

function Summary({ label, value }) {
  return (
    <View style={styles.summary}>
      <Text style={type.small}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  stepper: { flexDirection: "row", marginVertical: 16 },
  stepItem: { flex: 1, alignItems: "center", gap: 6 },
  stepDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  stepNum: { fontWeight: "800", color: colors.navySoft },
  stepLabel: { fontSize: 10.5, color: colors.muted, textAlign: "center", fontWeight: "600" },
  days: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  day: { paddingHorizontal: 14, height: 36, borderRadius: radius.pill, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  dayOn: { backgroundColor: colors.teal },
  dayText: { fontWeight: "700", color: colors.tealDark, fontSize: 13 },
  dashed: { flexDirection: "row", gap: 6, height: 46, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.teal, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  dashedText: { color: colors.tealDark, fontWeight: "700" },
  summary: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  summaryValue: { flex: 1, textAlign: "right", fontWeight: "700", color: colors.navy, fontSize: 13 },
  note: { marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.tealSoft },
  noteText: { fontSize: 12, color: colors.tealDark, fontWeight: "600" },
});
