import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SubScreen, errorMessage } from "../src/components/SubScreen";
import { Badge, Button, Card, Chip, EmptyState, Field, Loading } from "../src/components/ui";
import { engagementService } from "../src/services";
import { colors, radius } from "../src/theme";

const RELATIONSHIPS = ["Family", "Spouse", "Friend", "Colleague"];
const emptyForm = { name: "", phone: "", relationship: "Family" };

export default function EmergencyContactsScreen() {
  const [contacts, setContacts] = useState([]);
  const [max, setMax] = useState(5);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const res = await engagementService.contacts();
      setContacts(res?.data?.contacts || []);
      setMax(res?.data?.max || 5);
    } catch (e) {
      setError(errorMessage(e, "Could not load your emergency contacts."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const openForm = (contact) => {
    setEditingId(contact?._id || null);
    setForm(contact ? { name: contact.name, phone: contact.phone, relationship: contact.relationship } : emptyForm);
  };

  const save = async () => {
    if (!form.name.trim()) return Alert.alert("Name required", "Enter the contact's name.");
    if (!form.phone.trim()) return Alert.alert("Phone required", "Enter the contact's phone number.");
    setSaving(true);
    try {
      if (editingId) await engagementService.updateContact(editingId, form);
      else await engagementService.createContact(form);
      setForm(null);
      setEditingId(null);
      await load(false);
    } catch (e) {
      Alert.alert("Could not save contact", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const makePrimary = async (id) => {
    try {
      await engagementService.updateContact(id, { isPrimary: true });
      await load(false);
    } catch (e) {
      Alert.alert("Could not update", errorMessage(e));
    }
  };

  const remove = (contact) =>
    Alert.alert("Remove contact", `Remove ${contact.name} from your emergency contacts?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await engagementService.deleteContact(contact._id);
            await load(false);
          } catch (e) {
            Alert.alert("Could not remove", errorMessage(e));
          }
        },
      },
    ]);

  const canAdd = contacts.length < max;

  return (
    <SubScreen eyebrow="Safety" title="Emergency Contacts" subtitle="People we can reach instantly when you need help." icon="call-outline" refreshing={refreshing} onRefresh={() => load(true)} keyboard>
      {loading ? (
        <Loading label="Loading contacts..." />
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Something went wrong" message={error} action={<Button title="Try again" onPress={() => load(false)} />} />
      ) : (
        <View style={{ gap: 14 }}>
          {contacts.length === 0 && !form ? (
            <EmptyState icon="people-outline" title="No emergency contacts" message="Add someone you trust so they are the first to be reached." />
          ) : (
            contacts.map((c) => (
              <Card key={c._id} style={styles.contact}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={22} color={colors.tealDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {c.name}
                    </Text>
                    {c.isPrimary ? <Badge label="Primary" tone="success" /> : null}
                  </View>
                  <Text style={styles.sub}>
                    {c.relationship} - {c.phone}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <IconButton icon="call" label={`Call ${c.name}`} onPress={() => Linking.openURL(`tel:${c.phone}`)} />
                  {!c.isPrimary ? <IconButton icon="star-outline" label="Make primary" onPress={() => makePrimary(c._id)} /> : null}
                  <IconButton icon="create-outline" label="Edit contact" onPress={() => openForm(c)} />
                  <IconButton icon="trash-outline" label="Remove contact" danger onPress={() => remove(c)} />
                </View>
              </Card>
            ))
          )}

          {form ? (
            <Card style={{ padding: 16 }}>
              <Text style={styles.formTitle}>{editingId ? "Edit contact" : "Add contact"}</Text>
              <Field label="Full name" required icon="person-outline" value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="Contact name" maxLength={80} />
              <Field label="Phone number" required icon="call-outline" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} placeholder="+971 50 000 0000" keyboardType="phone-pad" maxLength={20} />
              <View style={styles.chips}>
                {RELATIONSHIPS.map((r) => (
                  <Chip key={r} label={r} active={form.relationship === r} onPress={() => setForm({ ...form, relationship: r })} />
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <View style={{ flex: 1 }}>
                  <Button title="Cancel" variant="outline" icon="close" onPress={() => setForm(null)} disabled={saving} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Save" icon="checkmark" onPress={save} loading={saving} />
                </View>
              </View>
            </Card>
          ) : canAdd ? (
            <Button title="Add Emergency Contact" icon="add" onPress={() => openForm(null)} />
          ) : (
            <Text style={styles.limit}>You have reached the limit of {max} contacts.</Text>
          )}
        </View>
      )}
    </SubScreen>
  );
}

function IconButton({ icon, label, onPress, danger }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={[styles.iconBtn, danger && { backgroundColor: colors.dangerSoft }]}>
      <Ionicons name={icon} size={16} color={danger ? colors.danger : colors.tealDark} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contact: { padding: 14, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center", position: "absolute", left: 14, top: 14 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 56 },
  name: { flexShrink: 1, fontSize: 16, fontWeight: "800", color: colors.navy },
  sub: { fontSize: 13, color: colors.muted, marginTop: 3, paddingLeft: 56 },
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  iconBtn: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  formTitle: { fontSize: 16, fontWeight: "800", color: colors.navy, marginBottom: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  limit: { textAlign: "center", color: colors.muted, fontSize: 13 },
});
