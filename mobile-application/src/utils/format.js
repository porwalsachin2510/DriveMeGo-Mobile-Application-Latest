const pad = (n) => String(n).padStart(2, "0");

export const formatMoney = (amount, currency = "AED") => {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  const decimals = currency === "KWD" ? 3 : 2;
  return `${safe.toFixed(decimals)} ${currency}`;
};

export const toDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const LONG_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const formatDate = (value) => {
  const d = toDate(value);
  return d ? `${MONTHS[d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()}` : "-";
};

export const formatDateNumeric = (value) => {
  const d = toDate(value);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "-";
};

export const formatDateLong = (value) => {
  const d = toDate(value);
  return d ? `${LONG_DAYS[d.getDay()]}, ${LONG_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : "-";
};

export const formatDateTime = (value) => {
  const d = toDate(value);
  if (!d) return "-";
  const h = d.getHours();
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${formatDate(d)}, ${pad(h12)}:${pad(d.getMinutes())} ${suffix}`;
};

export const toISODate = (value) => {
  const d = toDate(value);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";
};

export const addMonths = (value, months) => {
  const d = new Date(toDate(value) || new Date());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  d.setDate(d.getDate() - 1);
  return d;
};

export const dayParts = (value) => {
  const d = toDate(value);
  if (!d) return { day: "-", date: "--", month: "---" };
  return { day: SHORT_DAYS[d.getDay()], date: pad(d.getDate()), month: MONTHS[d.getMonth()].toUpperCase() };
};

export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const normalizeDay = (day) => {
  const s = String(day || "").trim().slice(0, 3).toLowerCase();
  return WEEK_DAYS.find((d) => d.toLowerCase() === s) || null;
};

export const countTravelDays = (start, end, allowedDays) => {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e || e < s) return 0;
  const allowed = new Set((allowedDays?.length ? allowedDays : WEEK_DAYS).map(normalizeDay));
  let count = 0;
  const cursor = new Date(s);
  while (cursor <= e) {
    const name = SHORT_DAYS[cursor.getDay()];
    if (allowed.has(name)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

export const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "U";

export const bookingStatusMeta = (status) => {
  const s = String(status || "").toUpperCase();
  switch (s) {
    case "CONFIRMED":
    case "ACCEPTED":
    case "ACTIVE":
      return { label: "Confirmed", tone: "success" };
    case "COMPLETED":
      return { label: "Completed", tone: "success" };
    case "PENDING":
    case "PENDING_APPROVAL":
      return { label: "Pending Approval", tone: "warning" };
    case "BOOKED":
      return { label: "Booked", tone: "info" };
    case "CANCELLED":
    case "CANCELED":
    case "REJECTED":
      return { label: s === "REJECTED" ? "Rejected" : "Cancelled", tone: "danger" };
    case "UPCOMING":
      return { label: "Upcoming", tone: "info" };
    default:
      return { label: s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ") : "Unknown", tone: "muted" };
  }
};
