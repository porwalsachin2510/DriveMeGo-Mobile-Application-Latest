import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SubScreen, errorMessage } from "../src/components/SubScreen";
import { Badge, Button, Card, EmptyState, Loading } from "../src/components/ui";
import { engagementService } from "../src/services";
import { formatDate } from "../src/utils/format";
import { colors } from "../src/theme";

const PHASE = {
  LIVE: { label: "Live now", tone: "success" },
  UPCOMING: { label: "Upcoming", tone: "warning" },
  ENDED: { label: "Ended", tone: "danger" },
};

export default function ContestsScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(null);

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const res = await engagementService.contests();
      setItems(res?.data?.items || []);
    } catch (e) {
      setError(errorMessage(e, "Could not load contests."));
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

  const join = async (contest) => {
    setJoining(contest._id);
    try {
      const res = await engagementService.joinContest(contest._id);
      Alert.alert("You're in", res?.message || "Good luck!");
      await load(false);
    } catch (e) {
      Alert.alert("Could not join", errorMessage(e));
    } finally {
      setJoining(null);
    }
  };

  return (
    <SubScreen eyebrow="Rewards" title="Contests" subtitle="Win exciting rewards." icon="trophy-outline" refreshing={refreshing} onRefresh={() => load(true)}>
      {loading ? (
        <Loading label="Loading contests..." />
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Something went wrong" message={error} action={<Button title="Try again" onPress={() => load(false)} />} />
      ) : items.length === 0 ? (
        <EmptyState icon="trophy-outline" title="No contests right now" message="New contests are announced here. Check back soon." />
      ) : (
        <View style={{ gap: 14 }}>
          {items.map((c) => {
            const phase = PHASE[c.phase];
            return (
              <Card key={c._id} style={{ overflow: "hidden" }}>
                {c.coverImage ? <Image source={{ uri: c.coverImage }} style={styles.cover} contentFit="cover" /> : null}
                <View style={{ padding: 16, gap: 10 }}>
                  <View style={styles.head}>
                    <Text style={styles.title}>{c.title}</Text>
                    {c.won ? <Badge label="You won" tone="success" icon="trophy" /> : <Badge label={phase.label} tone={phase.tone} />}
                  </View>
                  {c.description ? <Text style={styles.desc}>{c.description}</Text> : null}
                  {c.prize ? (
                    <View style={styles.prize}>
                      <Ionicons name="gift-outline" size={18} color={colors.tealDark} />
                      <Text style={styles.prizeText}>{c.prize}</Text>
                    </View>
                  ) : null}
                  {c.rules?.length ? (
                    <View style={{ gap: 4 }}>
                      {c.rules.map((r, i) => (
                        <Text key={i} style={styles.rule}>
                          {"\u2022"} {r}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  <Text style={styles.dates}>
                    {formatDate(c.startsAt)} - {formatDate(c.endsAt)} | {c.entries} {c.entries === 1 ? "entry" : "entries"}
                  </Text>
                  {c.joined ? (
                    <Badge label={c.won ? "Winner" : "Entered"} tone="teal" icon="checkmark-circle" />
                  ) : c.phase === "LIVE" ? (
                    <Button title="Join Contest" icon="ticket-outline" onPress={() => join(c)} loading={joining === c._id} />
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", height: 140, backgroundColor: colors.tealSoft },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  title: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.navy },
  desc: { fontSize: 13.5, lineHeight: 19, color: colors.muted },
  prize: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.tealTint },
  prizeText: { flex: 1, fontSize: 14, fontWeight: "800", color: colors.navy },
  rule: { fontSize: 13, color: colors.muted },
  dates: { fontSize: 12, color: colors.muted },
});
