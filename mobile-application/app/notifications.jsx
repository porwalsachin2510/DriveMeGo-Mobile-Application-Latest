import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../src/components/Screen";
import { AppHeader } from "../src/components/AppHeader";
import { Card, EmptyState, Loading } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { notificationService } from "../src/services";
import { formatDateTime } from "../src/utils/format";
import { colors, type } from "../src/theme";

export default function Notifications() {
  const { userId, isAuthenticated, ready } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const key = ["notifications", "list", userId];

  const list = useQuery({
    queryKey: key,
    queryFn: () => notificationService.list(userId, 1, 50),
    enabled: isAuthenticated && !!userId,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markRead = useMutation({ mutationFn: notificationService.markRead, onSuccess: refresh });
  const markAll = useMutation({
    mutationFn: () => notificationService.markAllRead(userId),
    onSuccess: refresh,
    onError: () => Alert.alert("Error", "Could not update notifications."),
  });
  const remove = useMutation({ mutationFn: notificationService.remove, onSuccess: refresh });

  if (ready && !isAuthenticated) return <Redirect href="/(auth)/login" />;

  const items = list.data?.notifications || [];
  const unread = items.filter((n) => !(n.isRead ?? n.read)).length;

  return (
    <Screen header={<AppHeader onBack={() => router.back()} />} refreshing={list.isRefetching} onRefresh={list.refetch}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={type.h1}>Notifications</Text>
          <Text style={type.small}>{unread ? `${unread} unread` : "You're all caught up"}</Text>
        </View>
        {unread ? (
          <Pressable onPress={() => markAll.mutate()} hitSlop={8}>
            <Text style={styles.link}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      {list.isLoading ? (
        <Loading />
      ) : !items.length ? (
        <EmptyState icon="notifications-off-outline" title="No notifications" message="Updates about your bookings and trips will appear here." />
      ) : (
        items.map((n) => {
          const isRead = n.isRead ?? n.read;
          return (
            <Pressable key={n._id} onPress={() => !isRead && markRead.mutate(n._id)} onLongPress={() => Alert.alert("Delete notification?", "", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => remove.mutate(n._id) }])}>
              <Card style={[styles.item, !isRead && styles.unread]}>
                <View style={styles.icon}>
                  <Ionicons name="notifications-outline" size={18} color={colors.tealDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{n.title}</Text>
                  <Text style={[type.small, { marginTop: 2 }]}>{n.message}</Text>
                  <Text style={styles.time}>{formatDateTime(n.createdAt)}</Text>
                </View>
                {!isRead ? <View style={styles.dot} /> : null}
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  link: { color: colors.tealDark, fontWeight: "800", fontSize: 13 },
  item: { flexDirection: "row", gap: 12, padding: 14, marginBottom: 10, alignItems: "flex-start" },
  unread: { borderColor: colors.teal, borderWidth: 1 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  title: { fontWeight: "800", color: colors.navy, fontSize: 14 },
  time: { fontSize: 11, color: colors.muted, marginTop: 6 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.teal, marginTop: 4 },
});
