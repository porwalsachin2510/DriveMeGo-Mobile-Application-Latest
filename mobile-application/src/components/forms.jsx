import { useState } from "react";
import { FlatList, Modal, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "./ui";
import { colors, radius, type } from "../theme";

const pad = (n) => String(n).padStart(2, "0");

export const to12h = (hhmm) => {
  if (!hhmm) return "";
  const [h, m] = String(hhmm).split(":").map(Number);
  if (Number.isNaN(h)) return "";
  return `${pad(h % 12 || 12)}:${pad(m || 0)} ${h >= 12 ? "PM" : "AM"}`;
};

const fromHHMM = (hhmm) => {
  const d = new Date();
  if (hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
  }
  return d;
};

export function SheetModal({ visible, onClose, title, children, footer, full }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, full && { height: "92%" }, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <Text style={[type.h2, { flex: 1 }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.navy} />
            </Pressable>
          </View>
          {children}
          {footer}
        </View>
      </View>
    </Modal>
  );
}

export function SelectField({ label, value, options, onChange, placeholder = "Select", icon, required, error, style }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => String(o.value) === String(value));
  return (
    <View style={[{ flex: 1, marginBottom: 14 }, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <Pressable onPress={() => setOpen(true)} style={[styles.field, error && { borderColor: colors.danger }]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.tealDark} style={{ marginRight: 8 }} /> : null}
        <Text style={[styles.value, !selected && { color: colors.subtle }]} numberOfLines={1}>
          {selected?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.navySoft} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <SheetModal visible={open} onClose={() => setOpen(false)} title={label || placeholder}>
        <FlatList
          data={options}
          keyExtractor={(o) => String(o.value)}
          style={{ maxHeight: 380 }}
          ListEmptyComponent={<Text style={[type.small, { padding: 16, textAlign: "center" }]}>No options available</Text>}
          renderItem={({ item }) => {
            const active = String(item.value) === String(value);
            return (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                style={[styles.option, active && { backgroundColor: colors.tealSoft }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionText, active && { color: colors.tealDark }]}>{item.label}</Text>
                  {item.sub ? <Text style={type.small}>{item.sub}</Text> : null}
                </View>
                {active ? <Ionicons name="checkmark-circle" size={20} color={colors.teal} /> : null}
              </Pressable>
            );
          }}
        />
      </SheetModal>
    </View>
  );
}

export function TimeField({ label, value, onChange, required, style, compact, hint }) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(fromHHMM(value));

  const commit = (d) => onChange(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  const handle = (event, selected) => {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "set" && selected) commit(selected);
      return;
    }
    if (selected) setTemp(selected);
  };

  return (
    <View style={[{ flex: 1, marginBottom: compact ? 0 : 12 }, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <Pressable
        onPress={() => {
          setTemp(fromHHMM(value));
          setOpen(true);
        }}
        style={styles.field}
      >
        <Ionicons name="time-outline" size={18} color={colors.tealDark} style={{ marginRight: 8 }} />
        <Text style={[styles.value, !value && { color: colors.subtle }]}>{value ? to12h(value) : "--:-- --"}</Text>
      </Pressable>
      {hint ? <Text style={[type.small, { fontSize: 11, marginTop: 4 }]}>{hint}</Text> : null}
      {open && Platform.OS === "android" ? <DateTimePicker value={temp} mode="time" onChange={handle} /> : null}
      {Platform.OS === "ios" ? (
        <SheetModal
          visible={open}
          onClose={() => setOpen(false)}
          title={label || "Select time"}
          footer={
            <Button
              title="Done"
              icon="checkmark"
              onPress={() => {
                commit(temp);
                setOpen(false);
              }}
            />
          }
        >
          <DateTimePicker value={temp} mode="time" display="spinner" themeVariant="light" onChange={handle} />
        </SheetModal>
      ) : null}
    </View>
  );
}

export function ToggleRow({ icon, title, subtitle, value, onChange, disabled }) {
  return (
    <View style={styles.toggleRow}>
      {icon ? (
        <View style={styles.toggleIcon}>
          <Ionicons name={icon} size={18} color={colors.tealDark} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.optionText}>{title}</Text>
        {subtitle ? <Text style={[type.small, { fontSize: 12 }]}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={!!value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: "#D5E0E8", true: colors.teal }}
        thumbColor="#fff"
      />
    </View>
  );
}

export async function pickImages({ multiple = false, max = 5 } = {}) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? max : 1,
    quality: 0.8,
    allowsEditing: !multiple,
    aspect: multiple ? undefined : [1, 1],
  });
  return result.canceled ? [] : result.assets;
}

export const toFilePart = (asset, fallbackName = "upload") => ({
  uri: asset.uri,
  name: asset.fileName || `${fallbackName}-${Date.now()}.jpg`,
  type: asset.mimeType || "image/jpeg",
});

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "700", color: colors.navy, marginBottom: 6 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.navy },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "92%",
  },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 10 },
  sheetHead: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  option: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: radius.md },
  optionText: { fontSize: 15, fontWeight: "700", color: colors.navy },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.tealTint,
    marginBottom: 10,
  },
  toggleIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
