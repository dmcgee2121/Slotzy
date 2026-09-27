import "./public-config.js";

const LOCAL_API_BASE_URL = "http://localhost:3001/api";

function readConfiguredApiBaseUrl() {
  const value = globalThis?.SLOTZY_CONFIG?.apiBaseUrl;
  return String(value ?? "").trim();
}

export function normalizeApiBaseUrl(value) {
  const input = String(value ?? "").trim().replace(/\/+$/, "");
  if (!input) return LOCAL_API_BASE_URL;
  return /\/api$/i.test(input) ? input : `${input}/api`;
}

export const API_BASE_URL = normalizeApiBaseUrl(readConfiguredApiBaseUrl());

export function getApiOrigin() {
  return API_BASE_URL.replace(/\/api$/i, "");
}

export function buildApiUrl(path = "") {
  const suffix = String(path ?? "").replace(/^\/+/, "").replace(/^api\//i, "");
  return suffix ? `${API_BASE_URL}/${suffix}` : API_BASE_URL;
}
