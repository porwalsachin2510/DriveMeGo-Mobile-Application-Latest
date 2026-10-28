import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { PartnerHeader } from "../../src/components/partner";
import { Button, Card, Field, Loading } from "../../src/components/ui";
import { ToggleRow, pickImages, toFilePart } from "../../src/components/forms";
import { resolveImage } from "../../src/components/AppHeader";
import { partnerService } from "../../src/services/partner";
import { colors, type } from "../../src/theme";

const DEFAULT_PREFS = { newTripAlerts: true, dailyEarnings: true, promotionalOffers: false };

export default function PartnerAccount() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["partner", "profile"], queryFn: partnerService.profile });
  const [profile, setProfile] = useState({ fullName: "", email: "", phone: "", company: "", licenseNumber: "" });
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (!query.data) return;
    const p = query.data.profile || {};
    setProfile({
      fullName: p.fullName || "",
      email: p.email || "",
      phone: p.phone || "",
      company: p.company || "",
      licenseNumber: p.licenseNumber || "",
    });
    setImage(p.profileImage || null);
    setPrefs({ ...DEFAULT_PREFS, ...(query.data.preferences || {}) });
  }, [query.data]);

  const set = (k) => (v) => setProfile((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: () => partnerService.updateProfile({ profile: { ...profile, profileImage: image }, preferences: prefs }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner", "profile"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      Alert.alert("Saved", "Profile updated successfully.");
    },
    onError: (e) => Alert.alert("Could not save", e?.response?.data?.message || "Please try again."),
  });

  const upload = useMutation({
    mutationFn: (asset) => {
      const fd = new FormData();
      fd.append("profileImage", toFilePart(asset, "profile"));
      return partnerService.updateProfileImage(fd);
    },
    onSuccess: (res) => {
      if (res?.profileImage) setImage(res.profileImage);
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: () => Alert.alert("Upload failed", "Could not upload photo. Please try again."),
  });

  const changePhoto = async () => {
    const [asset] = await pickImages();
    if (asset) upload.mutate(asset);
  };

  if (query.isLoading) return <Screen header={<PartnerHeader back />}><Loading /></Screen>;

  const avatar = resolveImage(image);

  return (
    <Screen header={<PartnerHeader back />} keyboard refreshing={query.isRefetching} onRefresh={query.refetch}>
      <Card style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="person" size={24} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.h2}>Partner Account</Text>
          <Text style={type.small}>Manage your partner profile and preferences</Text>
        </View>
      </Card>

      <Card style={{ padding: 16, marginTop: 14 }}>
        <View style={styles.photoRow}>
          <View style={styles.avatar}>
            {avatar ? <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="person" size={36} color={colors.tealDark} />}
          </View>
          <View style={{ flex: 1 }}>
            <Pressable onPress={changePhoto} disabled={upload.isPending} style={[styles.photoBtn, upload.isPending && { opacity: 0.6 }]}>
              <Ionicons name="camera-outline" size={18} color="#fff" />
              <Text style={styles.photoBtnText}>{upload.isPending ? "Uploading..." : "Change Photo"}</Text>
            </Pressable>
            <Text style={[type.small, { fontSize: 11, marginTop: 6 }]}>Recommended: square image, at least 200x200px</Text>
          </View>
        </View>
        <Field label="Full Name" icon="person-outline" value={profile.fullName} onChangeText={set("fullName")} placeholder="Enter your full name" />
        <Field label="Email" icon="mail-outline" value={profile.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" placeholder="Enter your email" />
        <Field label="Phone" icon="call-outline" value={profile.phone} onChangeText={set("phone")} keyboardType="phone-pad" placeholder="Enter your phone number" />
        <Field label="Company Name" icon="business-outline" value={profile.company} onChangeText={set("company")} placeholder="Enter company name" />
        <Field label="License Number" icon="card-outline" value={profile.licenseNumber} onChangeText={set("licenseNumber")} autoCapitalize="characters" placeholder="Enter license number" />
      </Card>

      <Card style={{ padding: 16, marginTop: 14, marginBottom: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Ionicons name="notifications-outline" size={22} color={colors.tealDark} />
          <View>
            <Text style={type.h3}>Notification Preferences</Text>
            <Text style={[type.small, { fontSize: 12 }]}>Stay updated with the latest information</Text>
          </View>
        </View>
        <ToggleRow icon="notifications-outline" title="New Trip Alerts" subtitle="Get notified when new trips are booked" value={prefs.newTripAlerts} onChange={(v) => setPrefs((p) => ({ ...p, newTripAlerts: v }))} />
        <ToggleRow icon="document-text-outline" title="Daily Earnings Summary" subtitle="Receive daily earnings reports" value={prefs.dailyEarnings} onChange={(v) => setPrefs((p) => ({ ...p, dailyEarnings: v }))} />
        <ToggleRow icon="pricetag-outline" title="Promotional Offers" subtitle="Receive special offers and promotions" value={prefs.promotionalOffers} onChange={(v) => setPrefs((p) => ({ ...p, promotionalOffers: v }))} />
      </Card>

      <Button title="Save Changes" icon="save-outline" loading={save.isPending} onPress={() => save.mutate()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  heroIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center" },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 3, borderColor: colors.teal },
  photoBtn: { height: 44, borderRadius: 14, backgroundColor: colors.teal, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  photoBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
