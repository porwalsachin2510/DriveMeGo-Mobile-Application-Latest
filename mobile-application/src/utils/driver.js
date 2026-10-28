const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const asDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const statusOf = (b) => String(b?.bookingStatus || b?.status || "").toUpperCase().replace(/\s+/g, "_");

export const placeName = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.name || value.address || value.locationName || value.stopName || value.label || "";
};

export const shortDate = (value) => {
  const d = asDate(value);
  return d ? `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}` : "--";
};

export const longDate = (value) => {
  const d = asDate(value);
  return d ? `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : "--";
};

export const dateTimeLabel = (value) => {
  const d = asDate(value);
  if (!d) return "--";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${clock(d)}`;
};

export const clock = (value) => {
  const d = asDate(value);
  if (!d) return "--";
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
};

export const dayChip = (value) => {
  const d = asDate(value);
  return d
    ? { weekday: DAYS[d.getDay()].toUpperCase(), day: d.getDate(), month: MONTHS[d.getMonth()].toUpperCase() }
    : { weekday: "--", day: "--", month: "" };
};

export const toTime12 = (value) => {
  if (!value) return "--";
  const m = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(value);
  let h = parseInt(m[1], 10);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
};

export const sameDay = (a, b = new Date()) => {
  const x = asDate(a);
  const y = asDate(b);
  return !!x && !!y && x.toDateString() === y.toDateString();
};

export const bookingRoute = (b) => ({
  from: placeName(b?.fromLocation) || placeName(b?.pickupLocation) || "Pickup",
  to: placeName(b?.toLocation) || placeName(b?.dropoffLocation) || "Dropoff",
});

export const bookingDate = (b) => b?.tripDate || b?.travelDate || b?.date || b?.scheduledAt || b?.createdAt;

export const bookingTime = (b) => b?.startTime || b?.travelTime || b?.time || "--";

export const passengerName = (p) =>
  p?.name || p?.fullName || p?.passengerId?.fullName || p?.employeeId?.fullName || p?.employeeName || "Passenger";

export const passengerCountOf = (b) => b?.passengerCount ?? b?.passengers?.length ?? 0;

export const money = (amount, currency = "AED") =>
  `${Number(amount || 0).toLocaleString("en-US")} ${currency}`;
