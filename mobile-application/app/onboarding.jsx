import { useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../src/components/Screen";
import { Button } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { colors, type } from "../src/theme";

const SLIDES = [
  {
    image: require("../assets/images/onboarding-1.png"),
    title: "Easy Booking,",
    accent: "Hassle-Free Travel",
    body: "Book your ride in just a few taps. Choose your route, seat and time — and we'll take care of the rest.",
  },
  {
    image: require("../assets/images/onboarding-2.png"),
    title: "Your Daily Commute,",
    accent: "Simplified",
    body: "Book rides, track in real-time and enjoy a smoother, safer and smarter travel experience — all in one place.",
  },
  {
    image: require("../assets/images/onboarding-3.png"),
    title: "Real-Time Tracking,",
    accent: "Greater Safety",
    body: "Track your ride in real-time, share your journey and travel with confidence — because your safety matters.",
  },
  {
    image: require("../assets/images/onboarding-4.png"),
    title: "Book with Ease,",
    accent: "Travel with Confidence",
    body: "Quick and simple booking, real-time updates and reliable service — so you can focus on what matters most.",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { completeOnboarding } = useAuth();
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const finish = async (target) => {
    await completeOnboarding();
    router.replace(target);
  };

  const next = () => {
    if (last) return finish("/(auth)/register");
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  return (
    <Screen scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
      <View style={{ paddingTop: insets.top + 8, alignItems: "center" }}>
        <Image source={require("../assets/images/logo-full.png")} style={styles.logo} contentFit="contain" />
      </View>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.title}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: 24 }}>
            <Image source={item.image} style={styles.art} contentFit="contain" />
            <Text style={[type.display, { fontSize: 28, lineHeight: 34 }]}>{item.title}</Text>
            <Text style={[type.display, { fontSize: 28, lineHeight: 34, color: colors.teal }]}>{item.accent}</Text>
            <Text style={[type.body, { color: colors.muted, marginTop: 12, fontSize: 15, lineHeight: 23 }]}>{item.body}</Text>
          </View>
        )}
        style={{ flex: 1 }}
      />
      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 16 }}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button title={last ? "Get Started" : "Next"} onPress={next} />
        <View style={styles.signInRow}>
          <Text style={type.small}>Already have an account? </Text>
          <Pressable onPress={() => finish("/(auth)/login")} hitSlop={8}>
            <Text style={{ color: colors.teal, fontWeight: "800", fontSize: 13 }}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 190, height: 52 },
  art: { width: "100%", height: 300, marginVertical: 12 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 18 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#D3DEE8" },
  dotActive: { backgroundColor: colors.teal, width: 22 },
  signInRow: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
});
