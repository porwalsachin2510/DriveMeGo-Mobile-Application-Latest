import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import { homeHref } from "../src/utils/roles";
import { colors } from "../src/theme";

export default function Splash() {
  const router = useRouter();
  const { ready, isAuthenticated, onboarded, user } = useAuth();
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const minTimeDone = useRef(false);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.timing(progress, {
      toValue: 1,
      duration: 2200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      minTimeDone.current = true;
    });
  }, [fade, progress]);

  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      if (!minTimeDone.current) return;
      clearInterval(timer);
      if (isAuthenticated) router.replace(homeHref(user));
      else if (!onboarded) router.replace("/onboarding");
      else router.replace("/(auth)/login");
    }, 120);
    return () => clearInterval(timer);
  }, [ready, isAuthenticated, onboarded, user, router]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ["12%", "100%"] });

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#FFFFFF", "#EEF8FB"]} style={StyleSheet.absoluteFill} />
      <Image source={require("../assets/images/splash-road.png")} style={styles.road} contentFit="cover" />
      <Animated.View style={[styles.logoWrap, { opacity: fade }]}>
        <Image source={require("../assets/images/logo-full.png")} style={styles.logo} contentFit="contain" />
      </Animated.View>
      <View style={styles.track}>
        <Animated.View style={[styles.bar, { width }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  road: { position: "absolute", left: 0, right: 0, bottom: 0, height: "45%", opacity: 0.9 },
  logoWrap: { alignItems: "center", justifyContent: "center" },
  logo: { width: 280, height: 90 },
  track: {
    position: "absolute",
    bottom: 80,
    width: 130,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CFE8EE",
    overflow: "hidden",
  },
  bar: { height: "100%", borderRadius: 3, backgroundColor: colors.teal },
});
