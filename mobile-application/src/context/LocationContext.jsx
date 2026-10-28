import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import { useAuth } from "./AuthContext";
import { b2cDriverService, managedDriverService } from "../services/driver";
import { ROLES } from "../utils/roles";

const LocationContext = createContext(null);
const PUSH_INTERVAL_MS = 5000;

export function LocationProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [sharing, setSharing] = useState(false);
  const [coords, setCoords] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const subscription = useRef(null);
  const lastPush = useRef(0);
  const tripIdRef = useRef(null);
  const roleRef = useRef(user?.role);

  useEffect(() => {
    roleRef.current = user?.role;
  }, [user?.role]);

  const setActiveTripId = useCallback((id) => {
    tripIdRef.current = id || null;
  }, []);

  const push = useCallback(async (c) => {
    const now = Date.now();
    if (now - lastPush.current < PUSH_INTERVAL_MS) return;
    lastPush.current = now;
    try {
      if (roleRef.current === ROLES.B2C_PARTNER_DRIVER) {
        await b2cDriverService.updateLocation({
          latitude: c.latitude,
          longitude: c.longitude,
          tripId: tripIdRef.current || undefined,
        });
        return;
      }
      if (!tripIdRef.current) {
        const res = await managedDriverService.activeTrip().catch(() => null);
        tripIdRef.current = res?.trip?._id || null;
      }
      if (!tripIdRef.current) return;
      await managedDriverService.updateLocation({
        tripId: tripIdRef.current,
        latitude: c.latitude,
        longitude: c.longitude,
        speed: c.speed ?? undefined,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // transient network failures are retried on the next position update
    }
  }, []);

  const stop = useCallback(() => {
    subscription.current?.remove();
    subscription.current = null;
    setSharing(false);
  }, []);

  const start = useCallback(async () => {
    if (subscription.current) return true;
    setError(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      setError("Location permission is required to share your live location.");
      return false;
    }
    const handle = (pos) => {
      const c = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        speed: pos.coords.speed,
      };
      setCoords(c);
      setLastUpdated(new Date());
      push(c);
    };
    try {
      const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      handle(first);
      subscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: PUSH_INTERVAL_MS, distanceInterval: 5 },
        handle,
      );
      setSharing(true);
      return true;
    } catch {
      setError("Could not read your location. Check GPS and try again.");
      return false;
    }
  }, [push]);

  useEffect(() => {
    if (!isAuthenticated) stop();
  }, [isAuthenticated, stop]);

  useEffect(() => () => subscription.current?.remove(), []);

  const value = useMemo(
    () => ({ sharing, coords, lastUpdated, error, start, stop, setActiveTripId }),
    [sharing, coords, lastUpdated, error, start, stop, setActiveTripId],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export const useLocationSharing = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocationSharing must be used within LocationProvider");
  return ctx;
};
