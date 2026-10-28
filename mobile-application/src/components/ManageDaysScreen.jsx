import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Screen } from "./Screen";
import { AppHeader } from "./AppHeader";
import { Button, Card } from "./ui";
import { PageTitle } from "./driver";
import { employeeService } from "../services/driver";
import { getErrorMessage } from "../api/client";
import { colors, radius, type } from "../theme";

const DAYS_AHEAD = 14;
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function ManageDaysScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [selected, setSelected] = useState([]);
  const [reason, setReason] = useState("");

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      return { key: isoDay(d), weekday: WEEKDAY[d.getDay()], label: `${d.getDate()} ${MONTH[d.getMonth()]}` };
    });
  }, []);

  const toggle = (key) => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const mutation = useMutation({
    mutationFn: ({ action }) => employeeService.manageDays(action, selected, reason.trim() || undefined),
    onSuccess: (res, { action }) => {
      qc.invalidateQueries({ queryKey: ["employee"] });
      setSelected([]);
      setReason("");
      Alert.alert(action === "book" ? "Days booked" : "Days cancelled", res?.message || "Your schedule has been updated.");
    },
    onError: (e) => Alert.alert("Could not update", getErrorMessage(e)),
  });

  const run = (action) => {
    if (!selected.length) return Alert.alert("Select days", "Choose at least one day first.");
    if (action === "cancel") {
      Alert.alert("Cancel selected days?", `You will be removed from trips on ${selected.length} day(s).`, [
        { text: "Keep", style: "cancel" },
        { text: "Cancel Days", style: "destructive", onPress: () => mutation.mutate({ action }) },
      ]);
      return;
    }
    mutation.mutate({ action });
  };

  const back = () => (router.canGoBack() ? router.back() : null);

  return (
    <Screen header={<AppHeader onBack={back} />}>
      <PageTitle title="Manage My Days" subtitle="Book or cancel your transport for specific days" />
      <Card>
        <Text style={type.h3}>Select days</Text>
        <Text style={[type.small, { marginBottom: 12 }]}>{`${selected.length} selected`}</Text>
        <View style={styles.grid}>
          {days.map((d) => {
            const active = selected.includes(d.key);
            return (
              <Pressable
                key={d.key}
                onPress={() => toggle(d.key)}
                style={[styles.day, active && styles.dayActive]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${d.weekday} ${d.label}`}
              >
                <Text style={[styles.weekday, active && styles.textActive]}>{d.weekday}</Text>
                <Text style={[styles.dayLabel, active && styles.textActive]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={[type.h3, { marginBottom: 8 }]}>Reason (optional)</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Working from home, leave, exams"
          placeholderTextColor={colors.subtle}
          style={styles.input}
          multiline
          accessibilityLabel="Reason"
        />
      </Card>

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button title="Cancel Days" variant="outline" icon="close" onPress={() => run("cancel")} loading={mutation.isPending && mutation.variables?.action === "cancel"} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Book Days" icon="checkmark" onPress={() => run("book")} loading={mutation.isPending && mutation.variables?.action === "book"} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  day: { width: "23%", paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", backgroundColor: "#fff" },
  dayActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  weekday: { fontSize: 11, fontWeight: "700", color: colors.subtle, textTransform: "uppercase" },
  dayLabel: { fontSize: 14, fontWeight: "800", color: colors.navy, marginTop: 2 },
  textActive: { color: "#fff" },
  input: { minHeight: 70, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, fontSize: 15, color: colors.navy, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 12, marginTop: 18 },
});
