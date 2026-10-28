import { useCallback, useMemo, useState } from "react";
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SubScreen, errorMessage } from "../src/components/SubScreen";
import { Button, Card, Chip, EmptyState, Field, Loading } from "../src/components/ui";
import { engagementService } from "../src/services";
import { colors } from "../src/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function FaqsScreen() {
  const [faqs, setFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const res = await engagementService.faqs();
      setFaqs(res?.data?.faqs || []);
      setCategories(res?.data?.categories || []);
    } catch (e) {
      setError(errorMessage(e, "Could not load FAQs."));
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs.filter((f) => (category === "All" || f.category === category) && (!q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)));
  }, [faqs, category, query]);

  const toggle = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId((current) => (current === id ? null : id));
  };

  return (
    <SubScreen eyebrow="Help" title="FAQs" subtitle="Find answers to common questions." icon="help-circle-outline" refreshing={refreshing} onRefresh={() => load(true)}>
      <Field icon="search-outline" value={query} onChangeText={setQuery} placeholder="Search questions" returnKeyType="search" containerStyle={{ marginBottom: 12 }} />
      {categories.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ marginHorizontal: -20 }}>
          {["All", ...categories].map((c) => (
            <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
          ))}
        </ScrollView>
      ) : null}

      {loading ? (
        <Loading label="Loading FAQs..." />
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Something went wrong" message={error} action={<Button title="Try again" onPress={() => load(false)} />} />
      ) : visible.length === 0 ? (
        <EmptyState icon="help-buoy-outline" title="No matching questions" message="Try a different search, or contact our support team from the More tab." />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {visible.map((f, i) => {
            const open = openId === f._id;
            return (
              <View key={f._id} style={i > 0 && styles.divider}>
                <Pressable onPress={() => toggle(f._id)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.question}>
                  <Text style={styles.questionText}>{f.question}</Text>
                  <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.tealDark} />
                </Pressable>
                {open ? <Text style={styles.answer}>{f.answer}</Text> : null}
              </View>
            );
          })}
        </Card>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: 20, gap: 8, paddingBottom: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  question: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  questionText: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.navy },
  answer: { paddingHorizontal: 16, paddingBottom: 16, fontSize: 14, lineHeight: 21, color: colors.muted },
});
