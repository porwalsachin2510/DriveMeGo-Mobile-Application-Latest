import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Field } from "./ui";
import { SelectField, TimeField } from "./forms";
import { colors, radius, type } from "../theme";

export const emptyTrip = () => ({
  departureTime: "",
  destinationArrivalTime: "",
  arrivalTime: "",
  returnArrivalTime: "",
  tripType: "One Way",
  outboundStopPoints: [{ location: "", time: "" }, { location: "", time: "" }],
  returnStopPoints: [{ location: "", time: "" }, { location: "", time: "" }],
  assignedDriver: "",
  assignedVehicle: "",
  returnDriver: "",
  returnVehicle: "",
});

const TRIP_TYPES = [
  { value: "One Way", label: "One Way" },
  { value: "Round Trip", label: "Round Trip" },
];

const cleanStops = (stops = []) => stops.filter((s) => s.location?.trim()).map((s) => ({ location: s.location.trim(), time: s.time || "" }));

export const serializeTrips = (trips) =>
  trips
    .filter((t) => t.departureTime)
    .map((t) => ({
      ...t,
      outboundStopPoints: cleanStops(t.outboundStopPoints),
      returnStopPoints: t.tripType === "Round Trip" ? cleanStops(t.returnStopPoints) : [],
    }));

function Section({ icon, title, children, action }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={18} color={colors.tealDark} />
        <Text style={[type.h3, { flex: 1, fontSize: 15 }]}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function Stops({ stops, onChange, placeholder }) {
  const update = (i, patch) => onChange(stops.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  return (
    <>
      {stops.map((s, i) => (
        <View key={i} style={styles.stopRow}>
          <View style={styles.stopIndex}>
            <Text style={styles.stopIndexText}>{i + 1}</Text>
          </View>
          <Field containerStyle={{ flex: 1, marginBottom: 0 }} value={s.location} onChangeText={(v) => update(i, { location: v })} placeholder={placeholder} />
          <TimeField compact style={{ flex: 0, width: 118 }} value={s.time} onChange={(v) => update(i, { time: v })} />
          <Pressable onPress={() => onChange(stops.filter((_, idx) => idx !== i))} hitSlop={8} accessibilityLabel="Remove stop">
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
        </View>
      ))}
    </>
  );
}

const AddBtn = ({ label, onPress }) => (
  <Pressable onPress={onPress} style={styles.addBtn}>
    <Ionicons name="add" size={14} color={colors.tealDark} />
    <Text style={styles.addBtnText}>{label}</Text>
  </Pressable>
);

export function TripCard({ index, trip, onChange, onRemove, canRemove, drivers = [], vehicles = [], showAssignment, showSchedule = true }) {
  const round = trip.tripType === "Round Trip";
  const set = (patch) => onChange({ ...trip, ...patch });

  return (
    <View style={{ gap: 12 }}>
      {showSchedule ? (
      <>
      <View style={styles.tripCard}>
        <View style={styles.tripHead}>
          <View style={styles.tripBadge}>
            <Ionicons name="bus" size={16} color="#fff" />
            <Text style={styles.tripBadgeText}>Trip {index + 1}</Text>
          </View>
          <SelectField style={{ flex: 1, marginBottom: 0 }} value={trip.tripType} options={TRIP_TYPES} onChange={(v) => set({ tripType: v })} />
          {canRemove ? (
            <Pressable onPress={onRemove} style={styles.trash} accessibilityLabel="Remove trip">
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.timeRow}>
          <TimeField label="Departure" required value={trip.departureTime} onChange={(v) => set({ departureTime: v })} />
          <TimeField label="Arrival (destination)" required={!round} value={round ? trip.destinationArrivalTime : trip.arrivalTime} onChange={(v) => set(round ? { destinationArrivalTime: v } : { arrivalTime: v })} />
        </View>
        {round ? (
          <View style={styles.timeRow}>
            <TimeField label="Return departure" required value={trip.arrivalTime} onChange={(v) => set({ arrivalTime: v })} hint="Bus departs destination" />
            <TimeField label="Return arrival" value={trip.returnArrivalTime} onChange={(v) => set({ returnArrivalTime: v })} hint="Bus reaches origin" />
          </View>
        ) : null}
      </View>

      <Section icon="location" title="Outbound Stops" action={<AddBtn label="Add Stop" onPress={() => set({ outboundStopPoints: [...trip.outboundStopPoints, { location: "", time: "" }] })} />}>
        <Stops stops={trip.outboundStopPoints} onChange={(v) => set({ outboundStopPoints: v })} placeholder="Stop location" />
      </Section>

      {round ? (
        <Section icon="repeat" title="Return Stops" action={<AddBtn label="Add Stop" onPress={() => set({ returnStopPoints: [...trip.returnStopPoints, { location: "", time: "" }] })} />}>
          <Stops stops={trip.returnStopPoints} onChange={(v) => set({ returnStopPoints: v })} placeholder="Stop location" />
        </Section>
      ) : null}

      </>
      ) : null}

      {showAssignment ? (
        <Section icon="person" title={`Trip ${index + 1} Assignment`}>
          <Text style={[type.small, { marginBottom: 10 }]}>Driver and vehicle for the outbound leg{round ? " (return leg optional below)" : ""}.</Text>
          <View style={styles.timeRow}>
            <SelectField label="Driver" required value={trip.assignedDriver} options={drivers} onChange={(v) => set({ assignedDriver: v })} placeholder="Select driver" icon="person-outline" />
            <SelectField label="Vehicle" required value={trip.assignedVehicle} options={vehicles} onChange={(v) => set({ assignedVehicle: v })} placeholder="Select vehicle" icon="car-outline" />
          </View>
          {round ? (
            <View style={styles.returnBox}>
              <Text style={[type.h3, { fontSize: 14, marginBottom: 8 }]}>Return leg (optional)</Text>
              <View style={styles.timeRow}>
                <SelectField label="Return driver" value={trip.returnDriver} options={[{ value: "", label: "Same as outbound" }, ...drivers]} onChange={(v) => set({ returnDriver: v })} placeholder="Same as outbound" />
                <SelectField label="Return vehicle" value={trip.returnVehicle} options={[{ value: "", label: "Same as outbound" }, ...vehicles]} onChange={(v) => set({ returnVehicle: v })} placeholder="Same as outbound" />
              </View>
            </View>
          ) : null}
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tripCard: { padding: 14, borderRadius: radius.lg, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  tripHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  tripBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 40, borderRadius: radius.pill, backgroundColor: colors.teal },
  tripBadgeText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  trash: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.dangerSoft, alignItems: "center", justifyContent: "center" },
  timeRow: { flexDirection: "row", gap: 10 },
  section: { padding: 14, borderRadius: radius.lg, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  stopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  stopIndex: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center" },
  stopIndexText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, height: 30, borderRadius: radius.pill, backgroundColor: colors.tealSoft },
  addBtnText: { fontSize: 12, fontWeight: "700", color: colors.tealDark },
  returnBox: { padding: 12, borderRadius: radius.md, backgroundColor: colors.tealTint, borderWidth: 1, borderColor: colors.border },
});
