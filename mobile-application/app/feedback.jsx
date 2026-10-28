import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SubScreen, errorMessage } from "../src/components/SubScreen";
import { Badge, Button, Card, Chip, Field, SectionTitle } from "../src/components/ui";
import { engagementService } from "../src/services";
import { formatDate } from "../src/utils/format";
import { colors } from "../src/theme";

const CATEGORIES = [
  { key: "GENERAL", label: "General" },
  { key: "APP", label: "App" },
  { key: "DRIVER", label: "Driver" },
  { key: "ROUTE", label: "Route" },
  { key: "PAYMENT", label: "Payment" },
  { key: "SUGGESTION", label: "Suggestion" },
  { key: "COMPLAINT", label: "Complaint" },
];

const STATUS_TONE = { OPEN: "warning", REVIEWED: "teal", RESOLVED: "success" };

export default function FeedbackScreen() {
  const [category, setCategory] = useState("GENERAL");
  const [rating, setRating] = useState(0);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await engagementService.myFeedback({ limit: 10 });
      setHistory(res?.data?.items || []);
    } catch {
      setHistory([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const submit = async () => {
    if (!rating) return Alert.alert("Rating needed", "Tap a star to rate your experience.");
    if (!subject.trim()) return Alert.alert("Subject needed", "Add a short subject.");
    if (message.trim().length < 10) return Alert.alert("Tell us more", "Please write at least 10 characters.");
    setSending(true);
    try {
      await engagementService.submitFeedback({ category, rating, subject, message });
      setRating(0);
      setSubject("");
      setMessage("");
      setCategory("GENERAL");
      Alert.alert("Thank you", "Your feedback has been sent to our team.");
      loadHistory();
    } catch (e) {
      Alert.alert("Could not send feedback", errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <SubScreen eyebrow="Feedback" title="Write Feedback" subtitle="Help us serve you better." icon="create-outline" keyboard>
      <Card style={{ padding: 16 }}>
        <Text style={styles.label}>How was your experience?</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`} hitSlop={4}>
              <Ionicons name={n <= rating ? "star" : "star-outline"} size={34} color={n <= rating ? colors.warning : colors.subtle} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Topic</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ marginHorizontal: -16, marginBottom: 16 }}>
          {CATEGORIES.map((c) => (
            <Chip key={c.key} label={c.label} active={category === c.key} onPress={() => setCategory(c.key)} />
          ))}
        </ScrollView>

        <Field label="Subject" required value={subject} onChangeText={setSubject} placeholder="Short summary" maxLength={120} />
        <Field label="Message" required value={message} onChangeText={setMessage} placeholder="Tell us what happened or what we can improve" multiline maxLength={2000} style={{ minHeight: 110, alignItems: "flex-start" }} textAlignVertical="top" />
        <Button title="Send Feedback" icon="paper-plane-outline" onPress={submit} loading={sending} />
      </Card>

      {history.length > 0 ? (
        <View style={{ marginTop: 22, gap: 12 }}>
          <SectionTitle title="Your feedback" />
          {history.map((f) => (
            <Card key={f._id} style={{ padding: 14 }}>
              <View style={styles.histHead}>
                <Text style={styles.histTitle} numberOfLines={1}>
                  {f.subject}
                </Text>
                <Badge label={f.status[0] + f.status.slice(1).toLowerCase()} tone={STATUS_TONE[f.status] || "teal"} />
              </View>
              <Text style={styles.histMeta}>
                {formatDate(f.createdAt)} - {f.rating}/5
              </Text>
              <Text style={styles.histBody} numberOfLines={3}>
                {f.message}
              </Text>
              {f.adminResponse ? (
                <View style={styles.reply}>
                  <Text style={styles.replyLabel}>DriveMeGo team</Text>
                  <Text style={styles.histBody}>{f.adminResponse}</Text>
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "700", color: colors.navy, marginBottom: 10 },
  stars: { flexDirection: "row", gap: 10, marginBottom: 20 },
  chips: { paddingHorizontal: 16, gap: 8 },
  histHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  histTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.navy },
  histMeta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  histBody: { fontSize: 13.5, color: colors.navy, marginTop: 8, lineHeight: 19 },
  reply: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: colors.tealTint },
  replyLabel: { fontSize: 11, fontWeight: "800", color: colors.tealDark, textTransform: "uppercase" },
});
