import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { engagementService } from "../services";
import { errorMessage } from "./SubScreen";
import { colors, radius } from "../theme";

export function CitySheet({ visible, onClose, countryName, cities, selected, onChanged }) {
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(null);

  const choose = async (city) => {
    if (city === selected) return onClose();
    setSaving(city);
    try {
      await engagementService.setCity(city);
      onChanged(city);
      onClose();
    } catch (e) {
      Alert.alert("Could not change city", errorMessage(e));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close city picker" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Choose your city</Text>
        <Text style={styles.sub}>Cities available in {countryName}</Text>
        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          {cities.map((city) => {
            const active = city === selected;
            return (
              <Pressable key={city} onPress={() => choose(city)} disabled={!!saving} style={[styles.option, active && styles.optionActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <Ionicons name="location-outline" size={20} color={active ? colors.tealDark : colors.muted} />
                <Text style={[styles.optionText, active && { color: colors.tealDark }]}>{city}</Text>
                {saving === city ? <ActivityIndicator color={colors.teal} /> : active ? <Ionicons name="checkmark-circle" size={22} color={colors.teal} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: 20, paddingTop: 10 },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 14 },
  title: { fontSize: 18, fontWeight: "800", color: colors.navy },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2, marginBottom: 10 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderRadius: radius.md },
  optionActive: { backgroundColor: colors.tealSoft },
  optionText: { flex: 1, fontSize: 15.5, fontWeight: "700", color: colors.navy },
});
