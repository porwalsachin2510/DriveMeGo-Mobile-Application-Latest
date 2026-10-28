import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

export const storage = {
  async get(key) {
    if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key, value) {
    if (isWeb) return globalThis.localStorage?.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },
  async remove(key) {
    if (isWeb) return globalThis.localStorage?.removeItem(key);
    return SecureStore.deleteItemAsync(key);
  },
  async getJSON(key) {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  setJSON(key, value) {
    return this.set(key, JSON.stringify(value));
  },
};

export const KEYS = {
  token: "dmg_token",
  user: "dmg_user",
  onboarded: "dmg_onboarded",
};
