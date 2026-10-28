import { useEffect, useState } from "react";
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Screen } from "./Screen";
import { AppHeader } from "./AppHeader";
import { Button, Card, Chip, Field, Loading } from "./ui";
import { DriverBanner, GradientAction, HelpStrip, PageTitle, StatusPill } from "./driver";
import { LiveMap } from "./LiveMap";
import { useAuth } from "../context/AuthContext";
import { useLocationSharing } from "../context/LocationContext";
import { b2cDriverService, driverEmergencyService, managedDriverService } from "../services/driver";

const EMERGENCY_TYPES = [
  { value: "ACCIDENT", label: "Accident" },
  { value: "MEDICAL", label: "Medical" },
  { value: "BREAKDOWN", label: "Breakdown" },
  { value: "OTHER", label: "Other" },
];
import { ROLES, segmentTerms } from "../utils/roles";
import { clock, placeName } from "../utils/driver";
import { colors, radius } from "../theme";

const pointsFor = (terms) => [
  "Your location is shared automatically when you have active trips",
  `${terms.passengers} can track your real-time location`,
  "Location updates every 5 seconds for accurate tracking",
  "Location sharing stops automatically when all trips are completed",
];

const coord = (n) => (typeof n === "number" ? n.toFixed(6) : "--");

function InfoCell({ icon, label, value, tint = colors.tealSoft }) {
  return (
    <View style={styles.infoCell}>
      <View style={[styles.infoIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={20} color={colors.teal} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function DriverLiveScreen({ variant, liveHref, onBack, tripsHref }) {
  const router = useRouter();
  const { user } = useAuth();
  const { sharing, coords, lastUpdated, error, start, stop, setActiveTripId } = useLocationSharing();
  const isB2C = user?.role === ROLES.B2C_PARTNER_DRIVER;
  const points = pointsFor(segmentTerms(user?.role));

  const active = useQuery({
    queryKey: ["driver", "active-trip", user?.role],
    queryFn: async () => {
      if (isB2C) {
        const res = await b2cDriverService.trips("today").catch(() => null);
        const trips = res?.trips || res?.data?.trips || [];
        const trip = trips.find((t) => /progress/i.test(t.status || ""));
        return { trip };
      }
      return managedDriverService.activeTrip();
    },
    enabled: !!user,
    refetchInterval: 20000,
  });

  const trip = active.data?.trip || null;
  useEffect(() => {
    setActiveTripId(trip?._id);
  }, [trip?._id, setActiveTripId]);

  const from = placeName(trip?.fromLocation) || "";
  const to = placeName(trip?.toLocation) || "";
  const route = trip ? `${from} \u2192 ${to}` : "";
  const marker = coords || (trip?.currentLocation?.lat != null ? { latitude: trip.currentLocation.lat, longitude: trip.currentLocation.lng } : null);
  const destination =
    trip?.toLocation?.coordinates?.lat != null
      ? { latitude: trip.toLocation.coordinates.lat, longitude: trip.toLocation.coordinates.lng }
      : trip?.toLocation?.lat != null
        ? { latitude: trip.toLocation.lat, longitude: trip.toLocation.lng }
        : undefined;
  const vehicleName = trip?.vehicleId?.vehicleName || trip?.vehicleId?.model || "--";
  const plate = trip?.vehicleId?.registrationNumber || trip?.vehicleId?.licensePlate || "--";
  const corporate = variant === "corporate";

  const toggle = () => (sharing ? stop() : start());

  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyType, setEmergencyType] = useState("ACCIDENT");
  const [emergencyMessage, setEmergencyMessage] = useState("");
  const emergency = useMutation({
    mutationFn: () =>
      driverEmergencyService.report(trip._id, {
        emergencyType,
        message: emergencyMessage.trim(),
        location: coords ? { lat: coords.latitude, lng: coords.longitude } : undefined,
      }),
    onSuccess: () => {
      setEmergencyOpen(false);
      setEmergencyMessage("");
      Alert.alert("Emergency reported", "Support has been alerted.");
    },
    onError: (e) => Alert.alert("Could not report", e?.response?.data?.message || "Please try again."),
  });

  const sharingBadge = (
    <StatusPill label={sharing ? "Currently Sharing Location" : "Not sharing"} tone={sharing ? "success" : "danger"} dot={false} />
  );

  return (
    <Screen header={<AppHeader onBack={onBack} />} tabBarSpace refreshing={active.isRefetching} onRefresh={() => active.refetch()}>
      <DriverBanner showSharing={!corporate} liveHref={liveHref} />
      <View style={{ height: 6 }} />
      <PageTitle
        title={corporate ? "Live Location Tracking" : "Live Location"}
        subtitle={corporate ? "Track your live location in real-time." : "Track the live trip and driver location in real time."}
      />

      {active.isLoading ? <Loading /> : null}

      {corporate ? (
        <>
          <Card style={styles.row3}>
            <InfoCell icon="location-outline" label="Latitude" value={coord(coords?.latitude)} />
            <InfoCell icon="compass-outline" label="Longitude" value={coord(coords?.longitude)} />
            <InfoCell icon="time-outline" label="Last Updated" value={lastUpdated ? clock(lastUpdated) : "--"} />
          </Card>
          {sharingBadge}
          {trip ? (
            <Pressable onPress={() => tripsHref && router.push(tripsHref)} style={styles.activeStrip}>
              <Ionicons name="navigate-outline" size={20} color={colors.tealDark} />
              <Text style={styles.activeText} numberOfLines={1}>{`Active Trip: ${route}`}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
            </Pressable>
          ) : null}
          <GradientAction
            title={sharing ? "Stop Sharing" : "Start Sharing"}
            icon={sharing ? "stop" : "play"}
            danger={sharing}
            onPress={toggle}
            style={{ marginTop: 12 }}
          />
        </>
      ) : (
        <Card>
          <View style={styles.tripHead}>
            <View style={styles.carIcon}>
              <Ionicons name="car" size={26} color={colors.teal} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <StatusPill label={trip ? "Trip In Progress" : "No active trip"} tone={trip ? "success" : "muted"} />
              {trip ? <Text style={styles.route}>{route}</Text> : null}
            </View>
            {trip ? <StatusPill label="On Trip" tone="success" dot={false} /> : null}
          </View>
          <View style={styles.row3Inner}>
            <InfoCell icon="location-outline" label="Current Location" value={coords ? `${coord(coords.latitude)}, ${coord(coords.longitude)}` : "--"} tint="transparent" />
            <InfoCell icon="time-outline" label="Last Updated" value={lastUpdated ? clock(lastUpdated) : "--"} tint="transparent" />
          </View>
          {trip ? (
            <View style={styles.vehicleBox}>
              <InfoCell icon="bus-outline" label="Vehicle No." value={plate} tint="transparent" />
              <InfoCell icon="car-outline" label="Vehicle" value={vehicleName} tint="transparent" />
            </View>
          ) : null}
          <GradientAction
            title={sharing ? "Stop Sharing Location" : "Start Sharing Location"}
            icon={sharing ? "stop" : "location"}
            danger={sharing}
            onPress={toggle}
            style={{ marginTop: 14 }}
          />
        </Card>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={{ marginTop: 14 }}>
        <LiveMap marker={marker || undefined} destination={destination} label={sharing ? "You" : "Last known position"} vehicle height={280} />
      </View>

      {!corporate && trip && tripsHref ? (
        <GradientAction title="View Trip Details" icon="location" onPress={() => router.push(tripsHref)} style={{ marginTop: 14 }} />
      ) : null}

      {trip ? (
        <GradientAction title="Report Emergency" icon="warning" danger onPress={() => setEmergencyOpen(true)} style={{ marginTop: 12 }} />
      ) : null}

      <Modal visible={emergencyOpen} transparent animationType="slide" onRequestClose={() => setEmergencyOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.howTitle}>Report Emergency</Text>
            <View style={styles.chips}>
              {EMERGENCY_TYPES.map((t) => (
                <Chip key={t.value} label={t.label} active={emergencyType === t.value} onPress={() => setEmergencyType(t.value)} />
              ))}
            </View>
            <Field label="Details" value={emergencyMessage} onChangeText={setEmergencyMessage} placeholder="Describe what happened" multiline />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="outline" onPress={() => setEmergencyOpen(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Send Alert" onPress={() => emergency.mutate()} loading={emergency.isPending} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {corporate ? (
        <>
          <Card style={{ marginTop: 14, gap: 10 }}>
            <View style={styles.howHead}>
              <View style={styles.infoIcon}>
                <Ionicons name="information-circle-outline" size={20} color={colors.teal} />
              </View>
              <Text style={styles.howTitle}>How Location Sharing Works</Text>
            </View>
            {points.map((p) => (
              <View key={p} style={styles.point}>
                <View style={styles.bullet} />
                <Text style={styles.pointText}>{p}</Text>
              </View>
            ))}
          </Card>
          <View style={{ marginTop: 14 }}>
            <HelpStrip onPress={() => Linking.openURL("mailto:support@drivemego.com")} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { backgroundColor: colors.card || "#fff", padding: 20, gap: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row3: { flexDirection: "row", gap: 10, justifyContent: "space-between" },
  infoCell: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  infoIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.tealSoft },
  infoLabel: { fontSize: 11, color: colors.muted },
  infoValue: { fontSize: 13, fontWeight: "800", color: colors.navy },
  activeStrip: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.tealSoft },
  activeText: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.navy },
  tripHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  carIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  route: { fontSize: 15, fontWeight: "800", color: colors.navy },
  row3Inner: { flexDirection: "row", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  vehicleBox: { flexDirection: "row", marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.tealSoft, gap: 8 },
  error: { marginTop: 10, color: colors.danger, fontSize: 13, fontWeight: "600" },
  howHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  howTitle: { fontSize: 15, fontWeight: "800", color: colors.navy },
  point: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.teal, marginTop: 7 },
  pointText: { flex: 1, fontSize: 13, color: colors.navy, lineHeight: 19 },
});
