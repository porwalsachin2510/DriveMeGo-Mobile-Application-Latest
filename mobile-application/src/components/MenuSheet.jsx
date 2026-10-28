import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, type } from "../theme";

export function MenuSheet({ visible, onClose, items, title = "Menu", subtitle = "Explore more options" }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const go = (href) => {
    onClose();
    router.push(href);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grabber} />
        <View style={styles.head}>
          <View style={styles.headIcon}>
            <Ionicons name="person" size={22} color={colors.teal} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.h1}>{title}</Text>
            <Text style={type.small}>{subtitle}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={28} color={colors.navy} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
          {items.map((item, i) => (
            <Pressable
              key={item.title}
              onPress={() => go(item.href)}
              style={({ pressed }) => [styles.row, i < items.length - 1 && styles.rowBorder, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={item.icon} size={24} color={colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{item.title}</Text>
                {item.subtitle ? <Text style={type.small}>{item.subtitle}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.navySoft} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: "#FBFEFF", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 10 },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: "#C8D6E0", marginBottom: 14 },
  head: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 8 },
  headIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowIcon: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
});
