import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, type } from "../theme";
import { Button } from "./ui";
import { formatDateNumeric } from "../utils/format";

export function DateField({ label, value, onChange, minimumDate, maximumDate, style }) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(value);

  const handle = (event, selected) => {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "set" && selected) onChange(selected);
      return;
    }
    if (selected) setTemp(selected);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          setTemp(value);
          setOpen(true);
        }}
        style={[styles.field, style]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name="calendar-outline" size={20} color={colors.teal} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{formatDateNumeric(value)}</Text>
        </View>
        <Ionicons name="chevron-down" size={16} color={colors.navySoft} />
      </Pressable>

      {open && Platform.OS === "android" ? (
        <DateTimePicker value={value} mode="date" minimumDate={minimumDate} maximumDate={maximumDate} onChange={handle} />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <Text style={[type.h3, { marginBottom: 6 }]}>{label}</Text>
            <DateTimePicker
              value={temp}
              mode="date"
              display="inline"
              themeVariant="light"
              accentColor={colors.teal}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onChange={handle}
            />
            <Button
              title="Confirm"
              icon="checkmark"
              onPress={() => {
                onChange(temp);
                setOpen(false);
              }}
            />
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  label: { fontSize: 11, color: colors.muted, fontWeight: "600" },
  value: { fontSize: 15, fontWeight: "700", color: colors.navy, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32 },
});
