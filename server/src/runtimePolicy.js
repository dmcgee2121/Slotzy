export function normalizeRuntimeEnvironment(value) {
  return String(value ?? "development").trim().toLowerCase() || "development";
}

export function isProductionLikeEnvironment(value) {
  const environment = normalizeRuntimeEnvironment(value);
  return environment === "staging" || environment === "production";
}

export function areDevelopmentEndpointsEnabled(value) {
  const environment = normalizeRuntimeEnvironment(value);
  return environment === "development" || environment === "test";
}
