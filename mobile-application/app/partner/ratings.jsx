import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { PartnerHeader } from "../../src/components/partner";
import { Card, EmptyState, Loading } from "../../src/components/ui";
import { ratingsService } from "../../src/services/partner";
import { formatDate } from "../../src/utils/format";
import { colors, type } from "../../src/theme";

function Stars({ value, size = 16 }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= Math.round(value) ? "star" : "star-outline"} size={size} color="#F5B301" />
      ))}
    </View>
  );
}

export default function PartnerRatings() {
  const q = useQuery({ queryKey: ["partner", "ratings"], queryFn: () => ratingsService.driverRatings({ limit: 30 }) });
  const d = q.data?.data || q.data || {};
  const ratings = d.ratings || d.history || [];
  const avg = Number(d.averageRating ?? d.average ?? 0);
  const total = Number(d.totalRatings ?? d.count ?? ratings.length);

  return (
    <Screen header={<PartnerHeader back />} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Text style={type.h1}>My Ratings</Text>
      <Text style={[type.small, { marginBottom: 14 }]}>Feedback from your passengers.</Text>

      {q.isLoading ? (
        <Loading />
      ) : (
        <>
          <Card style={styles.hero}>
            <Text style={styles.avg}>{avg.toFixed(1)}</Text>
            <Stars value={avg} size={22} />
            <Text style={[type.small, { marginTop: 6 }]}>
              Based on {total} rating{total === 1 ? "" : "s"}
            </Text>
          </Card>

          <Text style={[type.h2, { marginVertical: 12 }]}>Recent reviews</Text>
          {ratings.length === 0 ? (
            <EmptyState icon="star-outline" title="No ratings yet" message="Passengers can rate you after completed trips." />
          ) : (
            ratings.map((r, i) => (
              <Card key={r._id || i} style={styles.item}>
                <View style={styles.rowBetween}>
                  <Text style={type.h3} numberOfLines={1}>
                    {r.passengerName || r.passenger?.fullName || "Passenger"}
                  </Text>
                  <Stars value={Number(r.rating || 0)} size={14} />
                </View>
                {r.feedback || r.comment || r.review ? <Text style={type.body}>{r.feedback || r.comment || r.review}</Text> : null}
                <Text style={[type.small, { fontSize: 12 }]}>{formatDate(r.date || r.createdAt || r.ratedAt)}</Text>
              </Card>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", padding: 22, gap: 6 },
  avg: { fontSize: 48, fontWeight: "800", color: colors.navy },
  item: { padding: 14, marginBottom: 10, gap: 6 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
});
