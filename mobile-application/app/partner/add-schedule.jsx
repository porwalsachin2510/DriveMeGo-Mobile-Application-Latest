import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { PartnerHeader } from "../../src/components/partner";
import { Button, Card, Loading } from "../../src/components/ui";
import { SelectField } from "../../src/components/forms";
import { TripCard, emptyTrip, serializeTrips } from "../../src/components/TripEditor";
import { partnerService, scheduleService } from "../../src/services/partner";
import { toISODate } from "../../src/utils/format";
import { colors, radius, type } from "../../src/theme";

export default function AddSchedule() {
  const router = useRouter();
  const qc = useQueryClient();
  const [routeId, setRouteId] = useState("");
  const [trips, setTrips] = useState([emptyTrip()]);

  const routes = useQuery({ queryKey: ["partner", "routes"], queryFn: partnerService.routes });
  const fleet = useQuery({ queryKey: ["partner", "fleet"], queryFn: partnerService.fleet });
  const drivers = useQuery({ queryKey: ["partner", "drivers"], queryFn: partnerService.drivers });

  const routeList = routes.data?.routes || [];
  const route = routeList.find((r) => r._id === routeId);
  const routeOptions = routeList.map((r) => ({ value: r._id, label: `${r.fromLocation} → ${r.toLocation}` }));
  const vehicleOptions = useMemo(
    () => (fleet.data?.fleet?.vehicles || []).map((v) => ({ value: v._id, label: `${v.model} (${v.licensePlate})`, sub: `${v.seatingCapacity} seats` })),
    [fleet.data],
  );
  const driverOptions = useMemo(
    () => (drivers.data?.drivers || []).map((d) => ({ value: d._id, label: d.fullName || d.name, sub: d.isSelf ? "You" : d.phoneNumber || d.phone })),
    [drivers.data],
  );
  const updateTrip = (i, t) => setTrips((cur) => cur.map((x, idx) => (idx === i ? t : x)));

  const submit = useMutation({
    mutationFn: () => {
      const valid = serializeTrips(trips);
      const first = trips.find((t) => t.assignedVehicle) || trips[0];
      return scheduleService.createSchedule({
        routeId: route._id,
        scheduleName: `${route.fromLocation} to ${route.toLocation} - New Schedule`,
        tripTimes: valid,
        availableDays: (route.availableDays?.length ? route.availableDays : ["MON", "TUE", "WED", "THU", "FRI"]).map((d) => String(d).toUpperCase().slice(0, 3)),
        assignedVehicle: first.assignedVehicle || route.assignedVehicle?._id || route.assignedVehicle,
        assignedDriver: first.assignedDriver || route.assignedDriver?._id || route.driverInfo?._id || route.assignedDriver,
        startDate: toISODate(new Date()),
        notes: `Additional schedule for ${route.fromLocation} → ${route.toLocation}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner"] });
      Alert.alert("Schedule added", "Trips will be generated automatically.", [{ text: "OK", onPress: () => router.replace("/partner/routes") }]);
    },
    onError: (e) => Alert.alert("Could not add schedule", e?.response?.data?.message || "Please try again."),
  });

  const onSubmit = () => {
    if (!route) return Alert.alert("Select a route", "Choose the existing route first.");
    const valid = trips.filter((t) => t.departureTime);
    if (!valid.length) return Alert.alert("Add a departure time", "At least one trip time is required.");
    if (valid.some((t) => t.tripType === "Round Trip" && !t.arrivalTime)) return Alert.alert("Return time missing", "Round trips must have a return departure time.");
    if (valid.some((t) => !t.assignedDriver || !t.assignedVehicle)) return Alert.alert("Assignment missing", "Select a driver and vehicle for every trip.");
    submit.mutate();
  };

  if (routes.isLoading || fleet.isLoading || drivers.isLoading) return <Screen header={<PartnerHeader back />}><Loading /></Screen>;

  return (
    <Screen header={<PartnerHeader back />}>
      <Text style={type.h1}>Add Schedule to Existing Route</Text>
      <Text style={[type.small, { marginTop: 4, marginBottom: 16 }]}>Choose an existing route to add a new schedule or trip time.</Text>

      <Card style={{ padding: 14, marginBottom: 16 }}>
        <SelectField label="Select Existing Route" icon="git-branch-outline" value={routeId} options={routeOptions} onChange={setRouteId} placeholder="-- Select Route --" style={{ marginBottom: 0 }} />
      </Card>

      <View style={styles.sectionTitle}>
        <Ionicons name="time-outline" size={20} color={colors.tealDark} />
        <Text style={type.h2}>New Trip Times</Text>
      </View>

      {trips.map((t, i) => (
        <View key={i} style={{ marginBottom: 16 }}>
          <TripCard index={i} trip={t} onChange={(v) => updateTrip(i, v)} canRemove={trips.length > 1} onRemove={() => setTrips((c) => c.filter((_, idx) => idx !== i))} showAssignment drivers={driverOptions} vehicles={vehicleOptions} />
        </View>
      ))}

      <Pressable onPress={() => setTrips((c) => [...c, emptyTrip()])} style={styles.dashed}>
        <Ionicons name="add" size={18} color={colors.tealDark} />
        <Text style={{ color: colors.tealDark, fontWeight: "700" }}>Add Another Trip Time</Text>
      </Pressable>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Button title="Cancel" variant="outline" icon="close" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button title="Add Schedule" icon="calendar-outline" loading={submit.isPending} onPress={onSubmit} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  dashed: { flexDirection: "row", gap: 6, height: 46, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.teal, alignItems: "center", justifyContent: "center", marginBottom: 16 },
});
