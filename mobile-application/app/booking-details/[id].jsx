import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { AppHeader, resolveImage } from "../../src/components/AppHeader";
import { Badge, Button, Card, EmptyState, Loading } from "../../src/components/ui";
import { bookingService } from "../../src/services";
import { downloadAndShare } from "../../src/utils/download";
import { bookingStatusMeta, formatDateLong, formatMoney } from "../../src/utils/format";
import { colors, radius, type } from "../../src/theme";

export default function BookingDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({ queryKey: ["booking", id], queryFn: () => bookingService.details(id) });
  const b = data?.booking || data?.data || data || {};

  const cancel = useMutation({
    mutationFn: () => bookingService.cancel(id, "Cancelled by commuter"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking", id] });
    },
    onError: (e) => Alert.alert("Could not cancel", e?.response?.data?.message || "Please try again."),
  });

  const monthlyPassId = b.monthlyPassId?._id || b.monthlyPassId;
  const download = useMutation({
    mutationFn: () =>
      downloadAndShare(bookingService.passCertificatePath(monthlyPassId), `monthly-pass-${monthlyPassId}.pdf`),
    onError: (e) => Alert.alert("Download failed", e?.response?.data?.message || e?.message || "Please try again."),
  });

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/trips"));

  if (isLoading) return <Screen header={<AppHeader onBack={back} />}><Loading /></Screen>;
  if (isError || !b._id) {
    return (
      <Screen header={<AppHeader onBack={back} />}>
        <EmptyState icon="alert-circle-outline" title="Booking not found" action={<Button title="Back to My Rides" onPress={back} />} />
      </Screen>
    );
  }

  const status = String(b.status || b.bookingStatus || "").toUpperCase();
  const meta = bookingStatusMeta(status);
  const round = String(b.bookingType || b.passType || "").toUpperCase().includes("ROUND");
  const from = b.pickupLocation || b.routeId?.fromLocation || "-";
  const to = b.dropoffLocation || b.routeId?.toLocation || "-";
  const driver = b.driverId || b.driver || {};
  const vehicle = b.vehicle || b.vehicleId || {};
  const partner = b.b2cPartnerId || b.partner || {};
  const currency = b.currency || "AED";
  const cancellable = ["PENDING", "PENDING_APPROVAL", "BOOKED", "CONFIRMED"].includes(status);
  const vImg = resolveImage(vehicle.image || vehicle.vehicleImage);

  const confirmCancel = () =>
    Alert.alert("Cancel booking", "Are you sure you want to cancel this booking?", [
      { text: "Keep", style: "cancel" },
      { text: "Cancel Booking", style: "destructive", onPress: () => cancel.mutate() },
    ]);

  return (
    <Screen
      header={<AppHeader onBack={back} />}
      footer={
        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          {monthlyPassId ? (
            <View style={{ flexBasis: "100%" }}>
              <Button title="Download Pass Certificate" onPress={() => download.mutate()} loading={download.isPending} />
            </View>
          ) : null}
          {cancellable ? <View style={{ flex: 1 }}><Button title="Cancel Booking" variant="outline" onPress={confirmCancel} loading={cancel.isPending} /></View> : null}
          <View style={{ flex: 1 }}><Button title="Back to My Rides" variant={cancellable ? "outline" : "primary"} onPress={back} /></View>
        </View>
      }
    >
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={styles.iconBox}><Ionicons name="receipt" size={24} color={colors.tealDark} /></View>
        <View style={{ flex: 1 }}>
          <Text style={type.h2}>Booking Details</Text>
          <Text style={type.small} numberOfLines={1}>ID: {b.bookingId || b._id}</Text>
        </View>
        <Badge label={meta.label} tone={meta.tone} />
      </Card>

      <Block title="Route Information" icon="location-outline">
        <Leg label={round ? "Outward Route" : "Route"} from={from} to={to} />
        {round ? <Leg label="Return Route" from={b.returnPickupLocation || to} to={b.returnDropoffLocation || from} /> : null}
      </Block>

      <Block title="Booking Details" icon="clipboard-outline">
        <Info k="Travel Date" v={formatDateLong(b.travelDate || b.passStartDate)} />
        <Info k="Onward Time" v={b.outboundTripTime || b.departureTime || "-"} />
        {round ? <Info k="Return Time" v={b.returnTripTime || "-"} /> : null}
        <Info k="Booking Type" v={round ? "ROUND TRIP" : "ONE WAY"} />
        <Info k="Seats" v={String(b.numberOfSeats || 1)} />
        <Info k="Booked On" v={formatDateLong(b.createdAt)} />
        {b.passStartDate ? <Info k="Pass Start" v={formatDateLong(b.passStartDate)} /> : null}
        {b.passEndDate ? <Info k="Pass End" v={formatDateLong(b.passEndDate)} /> : null}
      </Block>

      {driver.fullName || b.driverName ? (
        <Block title="Driver" icon="person-outline">
          <Text style={type.h3}>{driver.fullName || b.driverName}</Text>
          {driver.phone || driver.whatsappNumber ? (
            <Text style={{ color: colors.teal, fontWeight: "700", marginTop: 4 }} onPress={() => Linking.openURL(`tel:${driver.phone || driver.whatsappNumber}`)}>
              {driver.phone || driver.whatsappNumber}
            </Text>
          ) : null}
        </Block>
      ) : null}

      {vehicle.model || b.vehicleModel ? (
        <Block title="Vehicle" icon="car-outline">
          {vImg ? <Image source={{ uri: vImg }} style={styles.vehicle} contentFit="cover" /> : null}
          <Info k="Model" v={vehicle.model || b.vehicleModel} />
          <Info k="Plate Number" v={vehicle.plateNumber || b.vehiclePlate || "-"} />
          {vehicle.color ? <Info k="Color" v={vehicle.color} /> : null}
          {vehicle.capacity ? <Info k="Capacity" v={`${vehicle.capacity} seats`} /> : null}
        </Block>
      ) : null}

      <Block title="Payment" icon="card-outline">
        <Info k="Method" v={b.paymentMethod || "-"} />
        <Info k="Status" v={String(b.paymentStatus || "-").toUpperCase()} />
        <Info k="Total Amount" v={formatMoney(b.totalAmount ?? b.amount ?? 0, currency)} strong />
        {b.transactionId || b.paymentIntentId ? (
          <Text style={[type.small, { marginTop: 6 }]} onPress={() => Clipboard.setStringAsync(b.transactionId || b.paymentIntentId)}>
            Transaction: {b.transactionId || b.paymentIntentId} (tap to copy)
          </Text>
        ) : null}
      </Block>

      {partner.fullName || partner.email ? (
        <Block title="Service Provider" icon="business-outline">
          <Info k="Name" v={partner.fullName || partner.companyName || "-"} />
          {partner.email ? <Info k="Email" v={partner.email} /> : null}
        </Block>
      ) : null}
    </Screen>
  );
}

function Block({ title, icon, children }) {
  return (
    <Card style={{ marginTop: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Ionicons name={icon} size={20} color={colors.teal} />
        <Text style={type.h3}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

function Leg({ label, from, to }) {
  return (
    <View style={styles.leg}>
      <Text style={styles.legLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[type.h3, { flex: 1 }]} numberOfLines={2}>{from}</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.teal} />
        <Text style={[type.h3, { flex: 1, textAlign: "right" }]} numberOfLines={2}>{to}</Text>
      </View>
    </View>
  );
}

function Info({ k, v, strong }) {
  return (
    <View style={styles.info}>
      <Text style={type.small}>{k}</Text>
      <Text style={[type.body, { fontWeight: strong ? "800" : "600", flexShrink: 1, textAlign: "right", color: strong ? colors.tealDark : colors.navy }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  leg: { backgroundColor: colors.tealTint, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  legLabel: { fontSize: 10, fontWeight: "800", color: colors.tealDark, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 },
  info: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 7 },
  vehicle: { width: "100%", height: 150, borderRadius: radius.md, marginBottom: 10 },
});
