export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DAY_LABELS = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export const BUFFER_OPTIONS = [0, 5, 10, 15];
export const MAX_SHOP_LOGO_BYTES = 1024 * 1024;
export const VALID_SHOP_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
export const DEFAULT_SHOP_LOGO_URL = new URL("../assets/images/slotzy-logo.png", import.meta.url).href;

export function createId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function toSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `shop-${Date.now()}`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

export function normalizeTimeValue(value, fallback) {
  const raw = String(value ?? "").trim();
  return /^\d{2}:\d{2}$/.test(raw) ? raw : fallback;
}

export function sanitizeBufferMinutes(value) {
  const parsed = Number(value);
  return BUFFER_OPTIONS.includes(parsed) ? parsed : 0;
}

export function getDefaultBookingPolicy() {
  return {
    allowSameDay: true,
    maxDaysAdvance: 30,
    cancelHours: 24,
    bufferMinutes: 0,
    requireDeposit: false,
    depositAmount: 0,
    lateGraceMinutes: 10,
    noShowStrikeLimit: 2,
  };
}

export function createDefaultAvailability() {
  return {
    timezone: "America/Chicago",
    bufferMinutes: 0,
    weekly: {
      mon: { enabled: true, start: "09:00", end: "17:00" },
      tue: { enabled: true, start: "09:00", end: "17:00" },
      wed: { enabled: true, start: "09:00", end: "17:00" },
      thu: { enabled: true, start: "09:00", end: "17:00" },
      fri: { enabled: true, start: "09:00", end: "17:00" },
      sat: { enabled: true, start: "09:00", end: "17:00" },
      sun: { enabled: false, start: "09:00", end: "17:00" },
    },
    timeOff: [],
  };
}

export function normalizeAvailability(entry) {
  const defaults = createDefaultAvailability();
  const source = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
  const timezone = String(source?.timezone ?? defaults.timezone).trim() || defaults.timezone;
  const bufferMinutes = sanitizeBufferMinutes(source?.bufferMinutes);
  const weekly = {};

  DAY_KEYS.forEach((dayKey) => {
    const fallback = defaults.weekly[dayKey];
    const row = source?.weekly?.[dayKey] || {};
    weekly[dayKey] = {
      enabled: Boolean(row.enabled ?? fallback.enabled),
      start: normalizeTimeValue(row.start, fallback.start),
      end: normalizeTimeValue(row.end, fallback.end),
    };
  });

  return {
    timezone,
    bufferMinutes,
    weekly,
    timeOff: Array.isArray(source?.timeOff) ? source.timeOff : [],
  };
}

export function hasEnabledWeeklyHours(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  const weekly = entry.weekly;
  if (!weekly || typeof weekly !== "object" || Array.isArray(weekly)) return false;
  return DAY_KEYS.some((dayKey) => Boolean(weekly?.[dayKey]?.enabled));
}

export function buildBookingLink(slug) {
  const normalizedSlug = String(slug ?? "").trim();
  if (!normalizedSlug) return "";
  const origin = String(window.location.origin ?? "").trim();
  if (origin) {
    return `${origin}/pages/book.html?shop=${encodeURIComponent(normalizedSlug)}`;
  }
  return `/pages/book.html?shop=${encodeURIComponent(normalizedSlug)}`;
}

export function getStoredShopLogoDataUrl(shop, legacyShop) {
  return String(
    shop?.logoDataUrl ??
    legacyShop?.logoDataUrl ??
    legacyShop?.logoUrl ??
    ""
  ).trim();
}

export async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result ?? "").trim();
      if (!/^data:image\/(?:png|jpeg|jpg|webp);/i.test(result)) {
        reject(new Error("invalid_logo_data"));
        return;
      }
      resolve(result);
    });
    reader.addEventListener("error", () => reject(reader.error || new Error("file_read_failed")));
    reader.readAsDataURL(file);
  });
}

export async function copyText(value) {
  const text = String(value ?? "").trim();
  if (!text) return false;

  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}
