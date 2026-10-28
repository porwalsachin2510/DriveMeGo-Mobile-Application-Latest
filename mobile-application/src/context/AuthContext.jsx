import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api, { onUnauthorized, setAuthToken } from "../api/client";
import { KEYS, storage } from "../lib/storage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [onboarded, setOnboarded] = useState(false);

  const persistSession = useCallback(async (nextToken, nextUser) => {
    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    await storage.set(KEYS.token, nextToken);
    await storage.setJSON(KEYS.user, nextUser);
  }, []);

  const clearSession = useCallback(async () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    queryClient.clear();
    await storage.remove(KEYS.token);
    await storage.remove(KEYS.user);
  }, [queryClient]);

  useEffect(() => {
    onUnauthorized(() => {
      clearSession();
    });
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [savedToken, savedUser, savedOnboarded] = await Promise.all([
          storage.get(KEYS.token),
          storage.getJSON(KEYS.user),
          storage.get(KEYS.onboarded),
        ]);
        if (cancelled) return;
        setOnboarded(savedOnboarded === "1");
        if (savedToken && savedUser) {
          setAuthToken(savedToken);
          setToken(savedToken);
          setUser(savedUser);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post("/auth/login", { email: email.trim().toLowerCase(), password });
      await persistSession(data.token, data.user);
      return data.user;
    },
    [persistSession],
  );

  const register = useCallback(async ({ role, fullName, email, whatsappNumber, countryCode, password, profileImage }) => {
    const form = new FormData();
    form.append("role", role);
    form.append("fullName", fullName.trim());
    form.append("email", email.trim().toLowerCase());
    form.append("whatsappNumber", whatsappNumber.trim());
    form.append("countryCode", countryCode);
    form.append("password", password);
    form.append("termsAccepted", "true");
    form.append("termsVersion", "1.0");
    if (profileImage?.uri) {
      form.append("profileImage", {
        uri: profileImage.uri,
        name: profileImage.fileName || "profile.jpg",
        type: profileImage.mimeType || "image/jpeg",
      });
    }
    const { data } = await api.post("/auth/register", form);
    return data;
  }, []);

  const verifyEmail = useCallback(
    async (email, otp) => {
      const { data } = await api.post("/auth/verify-otp", { email: email.trim().toLowerCase(), otp });
      if (data.token && data.user) await persistSession(data.token, data.user);
      return data;
    },
    [persistSession],
  );

  const resendOtp = useCallback(async (email) => {
    const { data } = await api.post("/auth/resend-otp", { email: email.trim().toLowerCase() });
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Session is cleared locally regardless of server response.
    }
    await clearSession();
  }, [clearSession]);

  const completeOnboarding = useCallback(async () => {
    setOnboarded(true);
    await storage.set(KEYS.onboarded, "1");
  }, []);

  const updateUser = useCallback(async (patch) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...patch };
      storage.setJSON(KEYS.user, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      ready,
      token,
      user,
      userId: user?.id || user?._id || null,
      isAuthenticated: !!token && !!user,
      onboarded,
      login,
      register,
      verifyEmail,
      resendOtp,
      logout,
      completeOnboarding,
      updateUser,
    }),
    [ready, token, user, onboarded, login, register, verifyEmail, resendOtp, logout, completeOnboarding, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
