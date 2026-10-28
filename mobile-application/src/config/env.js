import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

const stripSlash = (url) => (url || "").replace(/\/+$/, "");

export const API_URL = stripSlash(process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || "http://localhost:5000");
export const API_BASE = `${API_URL}/api`;
export const SOCKET_URL = API_URL;
export const WEB_URL = stripSlash(process.env.EXPO_PUBLIC_WEB_URL || extra.webUrl || "https://drivemego.com");
