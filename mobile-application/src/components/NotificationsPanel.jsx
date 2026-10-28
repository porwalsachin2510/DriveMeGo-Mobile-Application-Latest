import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "./Screen";
import { AppHeader } from "./AppHeader";
import { EmptyState, Loading } from "./ui";
import { DriverBanner, PageTitle, SegmentTabs } from "./driver";
import { useAuth } from "../context/AuthContext";
import { notificationService } from "../services";
import { asDate, clock, shortDate } from "../utils/driver";
import { colors, radius, shadow } from "../theme";

const TRIP_WORDS = /trip|booking|pickup|drop|route|driver|assign/i;

const iconFor = (n) => {
  const t = `${n.type || ""} ${n.title || ""}`.toLowerCase();
  if (/payment|earning|wallet/.test(t)) return ["cash-outline", "#F59E0B", "#FEF3E2"];
  if (/reminder|upcoming/.test(t)) return ["notifications-outline", "#7C3AED", "#F1EAFE"];
  if (/message|dispatch/.test(t)) return ["chatbubble-ellipses-outline", colors.danger, colors.dangerSoft];
  if (/system|update|account|approved/.test(t)) return ["megaphone-outline", colors.success, colors.successSoft];
  if (/assign/.test(t)) return ["person-outline", colors.info, colors.infoSoft];
  return ["navigate-outline", colors.success, colors.successSoft];
};

const when = (value) => {
  const d = asDate(value);
  if (!d) return "";
  const now = new Date();
  const y = new Date();
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `Today, ${clock(d)}`;
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${clock(d)}`;
  return `${shortDate(d)}, ${clock(d)}`;
};

export function NotificationsPanel({ liveHref, withFilters = false, subtitle }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");

  const list = useQuery({
    queryKey: ["notifications", "list", userId],
    queryFn: () => notificationService.list(userId, 1, 50),
    enabled: !!userId,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  const markRead = useMutation({ mutationFn: notificationService.markRead, onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: () => notificationService.markAllRead(userId), onSuccess: invalidate });

  const items = list.data?.notifications || [];
  const isUnread = (n) => !(n.isRead ?? n.read);
  const isTrip = (n) => TRIP_WORDS.test(`${n.type || ""} ${n.title || ""} ${n.message || ""}`);
  const tripCount = items.filter(isTrip).length;

  const visible = useMemo(() => {
    if (filter === "trip") return items.filter(isTrip);
    if (filter === "system") return items.filter((n) => !isTrip(n));
    return items;
  }, [items, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const unread = items.filter(isUnread).length;

  return (
    <Screen header={<AppHeader />} tabBarSpace refreshing={list.isRefetching} onRefresh={() => list.refetch()}>
      <DriverBanner liveHref={liveHref} />
      <View style={{ height: 6 }} />
      <PageTitle title="Notifications" subtitle={subtitle} />
      {withFilters ? (
        <View style={{ marginBottom: 14 }}>
          <SegmentTabs
            value={filter}
            onChange={setFilter}
            items={[
              { key: "all", label: "All", count: items.length },
              { key: "trip", label: "Trip Updates", count: tripCount },
              { key: "system", label: "System", count: items.length - tripCount },
            ]}
          />
        </View>
      ) : null}
      {unread > 0 ? (
        <Pressable onPress={() => markAll.mutate()} style={styles.markAll}>
          <Ionicons name="checkmark-done" size={16} color={colors.tealDark} />
          <Text style={styles.markAllText}>Mark all as read</Text>
        </Pressable>
      ) : null}

      {list.isLoading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <EmptyState icon="notifications-off-outline" title="No notifications" message="You are all caught up." />
      ) : (
        <View style={{ gap: 12 }}>
          {visible.map((n) => {
            const [name, fg, bg] = iconFor(n);
            return (
              <Pressable
                key={n._id}
                onPress={() => isUnread(n) && markRead.mutate(n._id)}
                style={styles.card}
              >
                <View style={[styles.icon, { backgroundColor: bg }]}>
                  <Ionicons name={name} size={22} color={fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{n.title}</Text>
                  {n.message ? (
                    <Text style={styles.message} numberOfLines={2}>
                      {n.message}
                    </Text>
                  ) : null}
                  <Text style={styles.time}>{when(n.createdAt)}</Text>
                </View>
                {isUnread(n) ? <View style={styles.unread} /> : <Ionicons name="chevron-forward" size={16} color={colors.subtle} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  markAll: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  markAllText: { fontSize: 13, fontWeight: "700", color: colors.tealDark },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border, ...shadow },
  icon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "800", color: colors.navy },
  message: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 },
  time: { fontSize: 12, color: colors.subtle, marginTop: 4 },
  unread: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.teal },
});
