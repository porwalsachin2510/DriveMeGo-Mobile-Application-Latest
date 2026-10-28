import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { PartnerHeader, SegTabs } from "../../src/components/partner";
import { Badge, Card, EmptyState, Loading } from "../../src/components/ui";
import { ToggleRow } from "../../src/components/forms";
import { DriverFormSheet, VehicleFormSheet } from "../../src/components/FleetForms";
import { resolveImage } from "../../src/components/AppHeader";
import { partnerService } from "../../src/services/partner";
import { formatDateNumeric } from "../../src/utils/format";
import { colors, gradients, radius, shadow, type } from "../../src/theme";

const msg = (e, fallback) => e?.response?.data?.message || fallback;

function Spec({ icon, label, value }) {
  return (
    <View style={styles.spec}>
      <Ionicons name={icon} size={16} color={colors.tealDark} />
      <View style={{ flex: 1 }}>
        <Text style={styles.specLabel}>{label}</Text>
        <Text style={styles.specValue} numberOfLines={1}>
          {value || "-"}
        </Text>
      </View>
    </View>
  );
}

function ActionRow({ onEdit, onDelete }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
      <Pressable onPress={onEdit} style={[styles.action, { backgroundColor: colors.info }]}>
        <Ionicons name="create-outline" size={16} color="#fff" />
        <Text style={styles.actionText}>Edit</Text>
      </Pressable>
      <Pressable onPress={onDelete} style={[styles.action, { backgroundColor: colors.danger }]}>
        <Ionicons name="trash-outline" size={16} color="#fff" />
        <Text style={styles.actionText}>Delete</Text>
      </Pressable>
    </View>
  );
}

function VehicleCard({ vehicle, onEdit, onDelete, onAvailability }) {
  const img = resolveImage(typeof vehicle.images?.[0] === "string" ? vehicle.images[0] : vehicle.images?.[0]?.url);
  const available = (vehicle.availabilityStatus || "available") === "available";
  const features = vehicle.features || [];
  const tone = vehicle.status === "Active" ? "success" : vehicle.status === "Maintenance" ? "warning" : "muted";
  return (
    <Card style={{ marginBottom: 14, padding: 14 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={styles.vehicleImg}>
          {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="car-sport" size={30} color={colors.tealDark} />}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Text style={[type.h3, { flex: 1 }]} numberOfLines={1}>
              {vehicle.model}
            </Text>
            <Badge label={(vehicle.status || "Active").toUpperCase()} tone={tone} />
          </View>
          <Badge label={vehicle.vehicleType} tone="teal" style={{ marginTop: 6 }} />
        </View>
      </View>
      <View style={styles.specGrid}>
        <Spec icon="card-outline" label="License plate" value={vehicle.licensePlate} />
        <Spec icon="people-outline" label="Capacity" value={`${vehicle.seatingCapacity} Seats`} />
        <Spec icon="calendar-outline" label="Year" value={vehicle.year} />
        <Spec icon="color-palette-outline" label="Color" value={vehicle.vehicleColor} />
        <Spec icon="shield-checkmark-outline" label="Insurance" value={formatDateNumeric(vehicle.insuranceExpiry)} />
        <Spec icon="document-text-outline" label="Registration" value={formatDateNumeric(vehicle.registrationExpiry)} />
      </View>
      {features.length ? (
        <View style={styles.features}>
          {features.slice(0, 3).map((f) => (
            <View key={f} style={styles.feature}>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
          {features.length > 3 ? (
            <View style={styles.feature}>
              <Text style={styles.featureText}>+{features.length - 3} more</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={styles.availRow}>
        <View style={[styles.dot, { backgroundColor: available ? colors.success : colors.danger }]} />
        <Text style={[type.small, { flex: 1 }]}>Availability</Text>
        {["available", "busy"].map((s) => {
          const active = (vehicle.availabilityStatus || "available") === s;
          return (
            <Pressable key={s} onPress={() => !active && onAvailability(s)} style={[styles.pill, active && styles.pillActive]}>
              <Text style={[styles.pillText, active && { color: "#fff" }]}>{s === "available" ? "Available" : "Busy"}</Text>
            </Pressable>
          );
        })}
      </View>
      <ActionRow onEdit={onEdit} onDelete={onDelete} />
    </Card>
  );
}

function DriverCard({ driver, onEdit, onDelete }) {
  const avatar = resolveImage(driver.driverImage || driver.profileImage);
  const name = driver.fullName || driver.name || "Driver";
  const phone = driver.phoneNumber || driver.phone || driver.whatsappNumber;
  const raw = String(driver.availabilityStatus || driver.availability?.status || "available").toLowerCase();
  const status = raw === "busy" ? { l: "Busy", c: colors.danger } : raw === "offline" ? { l: "Offline", c: colors.muted } : { l: "Available", c: colors.success };
  const exp = driver.experience ?? driver.yearsOfExperience;
  const rating = driver.ratings?.count ? `${Number(driver.ratings.average).toFixed(1)} / 5 (${driver.ratings.count})` : "New";
  return (
    <Card style={{ marginBottom: 14, padding: 0, overflow: "hidden" }}>
      <LinearGradient colors={["#0B4F7A", "#0A8F9E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.driverHead}>
        <View style={styles.driverTop}>
          <View style={[styles.statusPill, { backgroundColor: status.c }]}>
            <View style={styles.dotWhite} />
            <Text style={styles.statusText}>{status.l}</Text>
          </View>
          <View style={styles.activePill}>
            <Text style={styles.activeText}>{String(driver.status || "ACTIVE").toUpperCase()}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={styles.driverAvatar}>
            {avatar ? <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="person" size={34} color={colors.tealDark} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName} numberOfLines={1}>
              {name}
              {driver.isSelf ? " (You)" : ""}
            </Text>
            {driver.email ? (
              <View style={styles.contact}>
                <Ionicons name="mail" size={13} color="#fff" />
                <Text style={styles.contactText} numberOfLines={1}>
                  {driver.email}
                </Text>
              </View>
            ) : null}
            {phone ? (
              <View style={styles.contact}>
                <Ionicons name="call" size={13} color="#fff" />
                <Text style={styles.contactText}>{phone}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </LinearGradient>
      <View style={{ padding: 14 }}>
        <View style={styles.specGrid}>
          <Spec icon="card-outline" label="License" value={driver.licenseNumber || driver.driverInfo?.licenseNumber} />
          <Spec icon="globe-outline" label="Nationality" value={driver.nationality} />
          <Spec icon="briefcase-outline" label="Experience" value={exp != null && exp !== "" ? `${exp} yrs` : "-"} />
          <Spec icon="star-outline" label="Rating" value={rating} />
        </View>
        {!driver.isSelf ? <ActionRow onEdit={onEdit} onDelete={onDelete} /> : null}
      </View>
    </Card>
  );
}

export default function Fleet() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("vehicles");
  const [vehicleSheet, setVehicleSheet] = useState({ open: false, item: null });
  const [driverSheet, setDriverSheet] = useState({ open: false, item: null });

  const fleet = useQuery({ queryKey: ["partner", "fleet"], queryFn: partnerService.fleet });
  const drivers = useQuery({ queryKey: ["partner", "drivers"], queryFn: partnerService.drivers });
  const selfStatus = useQuery({ queryKey: ["partner", "self-driver"], queryFn: partnerService.selfDriverStatus });

  const vehicles = fleet.data?.fleet?.vehicles || [];
  const driverList = drivers.data?.drivers || [];
  const registered = !!selfStatus.data?.isRegisteredAsDriver;
  const externalCount = driverList.filter((d) => !d.isSelf).length;
  const driverCount = externalCount + (registered ? 1 : 0);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["partner", "fleet"] });
    qc.invalidateQueries({ queryKey: ["partner", "drivers"] });
    qc.invalidateQueries({ queryKey: ["partner", "self-driver"] });
  };

  const removeVehicle = useMutation({
    mutationFn: partnerService.deleteVehicle,
    onSuccess: refreshAll,
    onError: (e) => Alert.alert("Could not delete vehicle", msg(e, "Please try again.")),
  });
  const removeDriver = useMutation({
    mutationFn: partnerService.deleteDriver,
    onSuccess: refreshAll,
    onError: (e) => Alert.alert("Could not delete driver", msg(e, "Please try again.")),
  });
  const availability = useMutation({
    mutationFn: ({ id, status }) => partnerService.setVehicleAvailability(id, status),
    onSuccess: refreshAll,
    onError: (e) => Alert.alert("Could not update availability", msg(e, "Please try again.")),
  });
  const toggleSelf = useMutation({
    mutationFn: (register) => partnerService.toggleSelfDriver({ register }),
    onSuccess: refreshAll,
    onError: (e) => Alert.alert("Could not update", msg(e, "Please try again.")),
  });

  const confirmDelete = (label, run) =>
    Alert.alert(`Delete ${label}?`, "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: run },
    ]);

  const refreshing = fleet.isRefetching || drivers.isRefetching;

  return (
    <Screen header={<PartnerHeader back />} tabBarSpace refreshing={refreshing} onRefresh={refreshAll}>
      <View style={styles.titleRow}>
        <Text style={[type.h1, { flex: 1 }]}>Fleet Management</Text>
        <Pressable
          onPress={() => (tab === "vehicles" ? setVehicleSheet({ open: true, item: null }) : setDriverSheet({ open: true, item: null }))}
          style={{ borderRadius: radius.pill, overflow: "hidden" }}
        >
          <LinearGradient colors={gradients.primary} style={styles.addBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addText}>{tab === "vehicles" ? "Add Vehicle" : "Add Driver"}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <SegTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "vehicles", label: `Vehicles (${vehicles.length})`, icon: "car-outline" },
          { key: "drivers", label: `Drivers (${driverCount})`, icon: "person-outline" },
        ]}
      />

      {tab === "vehicles" ? (
        fleet.isLoading ? (
          <Loading />
        ) : vehicles.length === 0 ? (
          <EmptyState icon="car-sport-outline" title="No vehicles yet" message="Add your first vehicle to start assigning routes." />
        ) : (
          vehicles.map((v) => (
            <VehicleCard
              key={v._id}
              vehicle={v}
              onEdit={() => setVehicleSheet({ open: true, item: v })}
              onDelete={() => confirmDelete("vehicle", () => removeVehicle.mutate(v._id))}
              onAvailability={(status) => availability.mutate({ id: v._id, status })}
            />
          ))
        )
      ) : (
        <>
          <View style={styles.selfCard}>
            <View style={styles.selfIcon}>
              <Ionicons name="person" size={20} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.h3, { fontSize: 15 }]}>Drive Your Own Routes</Text>
              <Text style={[type.small, { fontSize: 12 }]}>Register yourself as a driver to appear in the driver list when assigning trips.</Text>
              <View style={{ marginTop: 8 }}>
                <ToggleRow title="Registered as Driver" value={registered} disabled={toggleSelf.isPending || selfStatus.isLoading} onChange={(v) => toggleSelf.mutate(v)} />
              </View>
            </View>
          </View>
          <Text style={[type.h2, { marginVertical: 12 }]}>Your Drivers</Text>
          {drivers.isLoading ? (
            <Loading />
          ) : driverList.length === 0 ? (
            <EmptyState icon="people-outline" title="No drivers yet" message="Add drivers to assign them to your routes." />
          ) : (
            driverList.map((d) => (
              <DriverCard
                key={d._id}
                driver={d}
                onEdit={() => setDriverSheet({ open: true, item: d })}
                onDelete={() => confirmDelete("driver", () => removeDriver.mutate(d._id))}
              />
            ))
          )}
        </>
      )}

      <VehicleFormSheet visible={vehicleSheet.open} vehicle={vehicleSheet.item} onClose={() => setVehicleSheet({ open: false, item: null })} />
      <DriverFormSheet visible={driverSheet.open} driver={driverSheet.item} onClose={() => setDriverSheet({ open: false, item: null })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  addBtn: { height: 42, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 4 },
  addText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  vehicleImg: { width: 92, height: 68, borderRadius: radius.md, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  specGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  spec: { width: "48.5%", flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.tealTint, borderWidth: 1, borderColor: colors.border },
  specLabel: { fontSize: 9, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  specValue: { fontSize: 12.5, fontWeight: "700", color: colors.navy, marginTop: 1 },
  features: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  feature: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.tealSoft },
  featureText: { fontSize: 11, fontWeight: "600", color: colors.tealDark },
  availRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pill: { paddingHorizontal: 12, height: 28, borderRadius: 14, justifyContent: "center", backgroundColor: colors.tealSoft },
  pillActive: { backgroundColor: colors.teal },
  pillText: { fontSize: 12, fontWeight: "700", color: colors.tealDark },
  action: { flex: 1, height: 42, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  driverHead: { padding: 14 },
  driverTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 24, borderRadius: 12 },
  dotWhite: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  statusText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  activePill: { paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.7)" },
  activeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  driverAvatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 3, borderColor: "rgba(255,255,255,0.5)" },
  driverName: { color: "#fff", fontSize: 18, fontWeight: "800" },
  contact: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  contactText: { color: "#fff", fontSize: 12.5, flex: 1 },
  selfCard: { flexDirection: "row", gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: "#E9F9EF", borderWidth: 1, borderColor: "#BFE9CF" },
  selfIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#D3F2DE", alignItems: "center", justifyContent: "center" },
});
