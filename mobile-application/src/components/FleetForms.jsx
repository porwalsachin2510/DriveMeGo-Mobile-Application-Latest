import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Chip, Field } from "./ui";
import { DateField } from "./DateField";
import { SelectField, SheetModal, pickImages, toFilePart } from "./forms";
import { resolveImage } from "./AppHeader";
import { partnerService } from "../services/partner";
import { toDate, toISODate } from "../utils/format";
import { colors, radius, type } from "../theme";

const VEHICLE_TYPES = ["Sedan", "SUV", "Van", "Minibus", "Bus", "Pickup Truck", "Other"].map((v) => ({ value: v, label: v }));
const STATUSES = ["Active", "Maintenance", "Inactive"].map((v) => ({ value: v, label: v }));
const SUGGESTED_FEATURES = ["Air Conditioning", "USB Charging", "First Aid Kit", "Safety Belts", "Fire Extinguisher", "Audio System", "WiFi"];

const errorMessage = (e, fallback) => e?.response?.data?.message || e?.message || fallback;
const future = (years) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d;
};

export function VehicleFormSheet({ visible, onClose, vehicle }) {
  const qc = useQueryClient();
  const editing = !!vehicle;
  const [form, setForm] = useState({});
  const [features, setFeatures] = useState([]);
  const [newFeature, setNewFeature] = useState("");
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!visible) return;
    setForm({
      model: vehicle?.model || "",
      licensePlate: vehicle?.licensePlate || "",
      vehicleType: vehicle?.vehicleType || "Sedan",
      year: vehicle?.year ? String(vehicle.year) : String(new Date().getFullYear()),
      seatingCapacity: vehicle?.seatingCapacity ? String(vehicle.seatingCapacity) : "",
      vehicleColor: vehicle?.vehicleColor || "",
      insuranceExpiry: toDate(vehicle?.insuranceExpiry) || future(1),
      registrationExpiry: toDate(vehicle?.registrationExpiry) || future(1),
      status: vehicle?.status || "Active",
    });
    setFeatures(Array.isArray(vehicle?.features) ? vehicle.features : []);
    setImages([]);
    setErrors({});
    setNewFeature("");
  }, [visible, vehicle]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("vehicleType", form.vehicleType);
      fd.append("model", form.model.trim());
      fd.append("year", form.year);
      fd.append("seatingCapacity", form.seatingCapacity);
      fd.append("licensePlate", form.licensePlate.trim());
      fd.append("vehicleColor", form.vehicleColor.trim());
      fd.append("insuranceExpiry", toISODate(form.insuranceExpiry));
      fd.append("registrationExpiry", toISODate(form.registrationExpiry));
      fd.append("status", form.status || "Active");
      fd.append("features", JSON.stringify(features));
      if (!editing) fd.append("tags", JSON.stringify([]));
      images.forEach((a, i) => fd.append("images", toFilePart(a, `vehicle-${i}`)));
      return editing ? partnerService.updateVehicle(vehicle._id, fd) : partnerService.createVehicle(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner", "fleet"] });
      qc.invalidateQueries({ queryKey: ["partner", "routes"] });
      onClose();
    },
    onError: (e) => Alert.alert("Could not save vehicle", errorMessage(e, "Please try again.")),
  });

  const submit = () => {
    const next = {};
    if (!form.model?.trim()) next.model = "Vehicle model is required";
    if (!form.licensePlate?.trim()) next.licensePlate = "License plate is required";
    if (!form.year) next.year = "Year is required";
    if (!form.seatingCapacity || Number(form.seatingCapacity) < 1) next.seatingCapacity = "Seats required";
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate();
  };

  const toggleFeature = (f) => setFeatures((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  const addFeature = () => {
    const f = newFeature.trim();
    if (f && !features.includes(f)) setFeatures((c) => [...c, f]);
    setNewFeature("");
  };
  const addImages = async () => {
    const assets = await pickImages({ multiple: true, max: 5 });
    if (assets.length) setImages((cur) => [...cur, ...assets].slice(0, 5));
  };

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      full
      title={editing ? "Edit Vehicle" : "Add Vehicle"}
      footer={<Button title={editing ? "Save Changes" : "Add Vehicle"} icon="checkmark" loading={save.isPending} onPress={submit} style={{ marginTop: 10 }} />}
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
        <SelectField label="Vehicle Type" required value={form.vehicleType} options={VEHICLE_TYPES} onChange={set("vehicleType")} icon="car-outline" />
        <Field label="Model" required value={form.model} onChangeText={set("model")} placeholder="e.g. Toyota Hiace 2026" error={errors.model} icon="car-sport-outline" />
        <Field label="License Plate" required value={form.licensePlate} onChangeText={set("licensePlate")} autoCapitalize="characters" placeholder="e.g. DXB 12345" error={errors.licensePlate} icon="card-outline" />
        <View style={styles.row}>
          <Field containerStyle={{ flex: 1 }} label="Year" required value={form.year} onChangeText={set("year")} keyboardType="number-pad" maxLength={4} error={errors.year} />
          <Field containerStyle={{ flex: 1 }} label="Seats" required value={form.seatingCapacity} onChangeText={set("seatingCapacity")} keyboardType="number-pad" maxLength={3} error={errors.seatingCapacity} />
        </View>
        <Field label="Color" value={form.vehicleColor} onChangeText={set("vehicleColor")} placeholder="e.g. White" icon="color-palette-outline" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <DateField label="Insurance Expiry" value={form.insuranceExpiry || new Date()} onChange={set("insuranceExpiry")} />
          </View>
          <View style={{ flex: 1 }}>
            <DateField label="Registration Expiry" value={form.registrationExpiry || new Date()} onChange={set("registrationExpiry")} />
          </View>
        </View>
        {editing ? <SelectField style={{ marginTop: 14 }} label="Status" value={form.status} options={STATUSES} onChange={set("status")} /> : null}

        <Text style={[styles.heading, { marginTop: 8 }]}>Features</Text>
        <View style={styles.wrap}>
          {[...new Set([...SUGGESTED_FEATURES, ...features])].map((f) => (
            <Chip key={f} label={f} active={features.includes(f)} onPress={() => toggleFeature(f)} />
          ))}
        </View>
        <Field
          containerStyle={{ marginTop: 12 }}
          value={newFeature}
          onChangeText={setNewFeature}
          placeholder="Add custom feature"
          onSubmitEditing={addFeature}
          returnKeyType="done"
          right={
            <Pressable onPress={addFeature} hitSlop={8}>
              <Ionicons name="add-circle" size={26} color={colors.teal} />
            </Pressable>
          }
        />

        <Text style={styles.heading}>Photos {editing ? "(new uploads are added)" : ""}</Text>
        <View style={styles.wrap}>
          {(vehicle?.images || []).slice(0, 3).map((img, i) => (
            <Image key={`old-${i}`} source={{ uri: resolveImage(typeof img === "string" ? img : img?.url) }} style={styles.thumb} contentFit="cover" />
          ))}
          {images.map((a, i) => (
            <Pressable key={a.uri} onPress={() => setImages((c) => c.filter((_, idx) => idx !== i))}>
              <Image source={{ uri: a.uri }} style={styles.thumb} contentFit="cover" />
              <View style={styles.remove}>
                <Ionicons name="close" size={12} color="#fff" />
              </View>
            </Pressable>
          ))}
          <Pressable onPress={addImages} style={[styles.thumb, styles.addThumb]}>
            <Ionicons name="camera-outline" size={22} color={colors.tealDark} />
            <Text style={{ fontSize: 10, color: colors.tealDark, fontWeight: "700" }}>Add</Text>
          </Pressable>
        </View>
        <View style={{ height: 12 }} />
      </ScrollView>
    </SheetModal>
  );
}

export function DriverFormSheet({ visible, onClose, driver }) {
  const qc = useQueryClient();
  const editing = !!driver;
  const [form, setForm] = useState({});
  const [photo, setPhoto] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!visible) return;
    setForm({
      name: driver?.fullName || driver?.name || "",
      email: driver?.email || "",
      phone: driver?.phoneNumber || driver?.phone || driver?.whatsappNumber || "",
      licenseNumber: driver?.licenseNumber || driver?.driverInfo?.licenseNumber || "",
      licenseExpiry: toDate(driver?.licenseExpiry || driver?.driverInfo?.licenseExpiry) || future(2),
      nationality: driver?.nationality || "",
      experience: String(driver?.experience ?? driver?.yearsOfExperience ?? ""),
      address: driver?.address || "",
      emergencyContact: driver?.emergencyContact?.name || driver?.emergencyContactName || "",
      emergencyPhone: driver?.emergencyContact?.phone || driver?.emergencyContactPhone || "",
    });
    setPhoto(null);
    setErrors({});
  }, [visible, driver]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append(editing ? "name" : "fullName", form.name.trim());
      fd.append("email", form.email.trim().toLowerCase());
      fd.append("phone", form.phone.trim());
      fd.append("licenseNumber", form.licenseNumber.trim());
      fd.append("licenseExpiry", toISODate(form.licenseExpiry));
      fd.append("nationality", form.nationality.trim());
      fd.append("experience", form.experience);
      fd.append("address", form.address.trim());
      fd.append(editing ? "emergencyContactName" : "emergencyContact", form.emergencyContact.trim());
      fd.append(editing ? "emergencyContactPhone" : "emergencyPhone", form.emergencyPhone.trim());
      if (photo) fd.append("driverImage", toFilePart(photo, "driver"));
      return editing ? partnerService.updateDriver(driver._id, fd) : partnerService.createDriver(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner", "drivers"] });
      qc.invalidateQueries({ queryKey: ["partner", "routes"] });
      onClose();
    },
    onError: (e) => Alert.alert("Could not save driver", errorMessage(e, "Please try again.")),
  });

  const submit = () => {
    const next = {};
    if (!form.name?.trim()) next.name = "Full name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email || "")) next.email = "Valid email required";
    if (!/^[+]?[\d\s\-()]{10,15}$/.test(form.phone || "")) next.phone = "Valid phone required";
    if (!form.licenseNumber?.trim()) next.licenseNumber = "License number is required";
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate();
  };

  const pickPhoto = async () => {
    const [asset] = await pickImages();
    if (asset) setPhoto(asset);
  };
  const preview = photo?.uri || resolveImage(driver?.driverImage || driver?.profileImage);

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      full
      title={editing ? "Edit Driver" : "Add Driver"}
      footer={<Button title={editing ? "Save Changes" : "Add Driver"} icon="checkmark" loading={save.isPending} onPress={submit} style={{ marginTop: 10 }} />}
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
        <Pressable onPress={pickPhoto} style={styles.avatarPick}>
          {preview ? <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="person" size={34} color={colors.tealDark} />}
          <View style={styles.camera}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </Pressable>
        <Field label="Full Name" required value={form.name} onChangeText={set("name")} error={errors.name} icon="person-outline" />
        <Field label="Email" required value={form.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" error={errors.email} icon="mail-outline" />
        <Field label="Phone" required value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" error={errors.phone} icon="call-outline" />
        <Field label="License Number" required value={form.licenseNumber} onChangeText={set("licenseNumber")} autoCapitalize="characters" error={errors.licenseNumber} icon="card-outline" />
        <View style={{ marginBottom: 16 }}>
          <DateField label="License Expiry" value={form.licenseExpiry || new Date()} onChange={set("licenseExpiry")} />
        </View>
        <View style={styles.row}>
          <Field containerStyle={{ flex: 1 }} label="Nationality" value={form.nationality} onChangeText={set("nationality")} />
          <Field containerStyle={{ flex: 1 }} label="Experience (yrs)" value={form.experience} onChangeText={set("experience")} keyboardType="number-pad" />
        </View>
        <Field label="Address" value={form.address} onChangeText={set("address")} icon="location-outline" />
        <Text style={styles.heading}>Emergency Contact</Text>
        <Field label="Contact Name" value={form.emergencyContact} onChangeText={set("emergencyContact")} />
        <Field label="Contact Phone" value={form.emergencyPhone} onChangeText={set("emergencyPhone")} keyboardType="phone-pad" />
        <View style={{ height: 12 }} />
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heading: { ...type.h3, marginBottom: 10, marginTop: 4 },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.tealSoft },
  addThumb: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.teal },
  remove: { position: "absolute", top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  avatarPick: {
    alignSelf: "center",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    overflow: "visible",
  },
  camera: { position: "absolute", right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center" },
});
