import "./frontend-version.js";

const ALLOWED_EVENTS = new Set(["frontend.runtime_error", "frontend.cache_state"]);
const ALLOWED_CATEGORIES = new Set([
  "runtime_exception",
  "unhandled_rejection",
  "resource_load_failure",
  "asset_version_mismatch",
  "cache_version_mismatch",
  "service_worker_update",
  "cache_inspection_unavailable",
]);
const ALLOWED_ERROR_CLASSES = new Set([
  "Error", "TypeError", "ReferenceError", "RangeError", "SyntaxError", "NetworkError", "UnknownError",
]);
const SAFE_PAGES = new Set([
  "home", "admin", "book", "business-owner", "client-history-overview", "dev-emails", "manage",
  "manage-appointments", "manage-barbers", "manage-services", "owner-earnings", "owner-setup", "owner-today",
  "pricing", "settings", "unknown",
]);

function buildInfo() {
  const source = globalThis.SLOTZY_BUILD_INFO || {};
  return {
    appVersion: String(source.appVersion || "unknown"),
    buildId: String(source.buildId || "unknown"),
    cacheVersion: String(source.cacheVersion || "unknown"),
  };
}

function safePageName(value = globalThis.location?.pathname) {
  let pathname = "";
  try {
    pathname = new URL(String(value || "/"), "https://slotzy.invalid").pathname;
  } catch {
    pathname = "/";
  }
  if (pathname === "/" || pathname.endsWith("/index.html")) return "home";
  const filename = pathname.split("/").filter(Boolean).pop() || "";
  const page = filename.replace(/\.html$/i, "").toLowerCase();
  return SAFE_PAGES.has(page) ? page : "unknown";
}

function browserFamily(userAgent = globalThis.navigator?.userAgent) {
  const value = String(userAgent || "");
  if (/Edg\//.test(value)) return "edge";
  if (/Firefox\//.test(value)) return "firefox";
  if (/Chrome\//.test(value) || /CriOS\//.test(value)) return "chrome";
  if (/Safari\//.test(value)) return "safari";
  return "other";
}

function apiMode() {
  const configured = String(globalThis.SLOTZY_CONFIG?.apiBaseUrl || "").trim();
  if (!configured) return "local_default";
  try {
    const hostname = new URL(configured).hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1") return "local_configured";
    if (hostname.includes("staging")) return "staging_configured";
    return "hosted_configured";
  } catch {
    return "invalid_configuration";
  }
}

function safeErrorClass(value) {
  const name = String(value?.name || value || "UnknownError");
  return ALLOWED_ERROR_CLASSES.has(name) ? name : "UnknownError";
}

function classifyError(value, fallback = "runtime_exception") {
  const message = String(value?.message || value || "").toLowerCase();
  if (/loading chunk|dynamically imported module|module script|unexpected token.*(?:<|html)/.test(message)) {
    return "asset_version_mismatch";
  }
  if (/failed to fetch|networkerror|load failed|script error/.test(message)) {
    return "resource_load_failure";
  }
  return ALLOWED_CATEGORIES.has(fallback) ? fallback : "runtime_exception";
}

function fingerprint(parts) {
  const input = parts.join("|");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fe-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function buildSafeDiagnostic(input = {}) {
  const info = buildInfo();
  const event = ALLOWED_EVENTS.has(input.event) ? input.event : "frontend.runtime_error";
  const category = ALLOWED_CATEGORIES.has(input.category) ? input.category : "runtime_exception";
  const page = safePageName(input.route);
  const errorClass = safeErrorClass(input.errorClass);
  const output = {
    event,
    category,
    page,
    frontendVersion: info.appVersion,
    buildId: info.buildId,
    cacheVersion: info.cacheVersion,
    browserFamily: browserFamily(input.userAgent),
    apiMode: apiMode(),
    timestamp: new Date().toISOString(),
    fingerprint: fingerprint([event, category, page, errorClass, info.buildId]),
  };
  if (event === "frontend.runtime_error") output.errorClass = errorClass;
  return output;
}

function emitSafeDiagnostic(input, write = console.warn) {
  const event = buildSafeDiagnostic(input);
  write("[Slotzy:diagnostic]", JSON.stringify(event));
  return event;
}

async function inspectExpectedCache() {
  if (!("caches" in globalThis) || !("serviceWorker" in navigator)) return;
  try {
    const names = await caches.keys();
    const expected = buildInfo().cacheVersion;
    const hasExpected = names.includes(expected);
    const hasOtherSlotzyCache = names.some((name) => /^slotzy-shell-v\d+$/.test(name) && name !== expected);
    if (!hasExpected && hasOtherSlotzyCache) {
      emitSafeDiagnostic({ event: "frontend.cache_state", category: "cache_version_mismatch" });
    }
  } catch {
    emitSafeDiagnostic({ event: "frontend.cache_state", category: "cache_inspection_unavailable" });
  }
}

function installFrontendDiagnostics() {
  if (globalThis.__slotzyDiagnosticsInstalled) return;
  globalThis.__slotzyDiagnosticsInstalled = true;

  globalThis.addEventListener?.("error", (event) => {
    const isResourceFailure = event?.target && event.target !== globalThis;
    const category = isResourceFailure
      ? "resource_load_failure"
      : classifyError(event?.error || event?.message);
    emitSafeDiagnostic({
      event: "frontend.runtime_error",
      category,
      errorClass: isResourceFailure ? "NetworkError" : safeErrorClass(event?.error),
    });
    event?.preventDefault?.();
  }, true);

  globalThis.addEventListener?.("unhandledrejection", (event) => {
    emitSafeDiagnostic({
      event: "frontend.runtime_error",
      category: classifyError(event?.reason, "unhandled_rejection"),
      errorClass: safeErrorClass(event?.reason),
    });
    event?.preventDefault?.();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      emitSafeDiagnostic({ event: "frontend.cache_state", category: "service_worker_update" });
    });
    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener?.("updatefound", () => {
        emitSafeDiagnostic({ event: "frontend.cache_state", category: "service_worker_update" });
      });
      return inspectExpectedCache();
    }).catch(() => {
      emitSafeDiagnostic({ event: "frontend.cache_state", category: "cache_inspection_unavailable" });
    });
  }
}

globalThis.SlotzyDiagnostics = Object.freeze({
  buildSafeDiagnostic,
  emitSafeDiagnostic,
  getApiMode: apiMode,
  getBrowserFamily: browserFamily,
  getBuildInfo: buildInfo,
  getSafePageName: safePageName,
  install: installFrontendDiagnostics,
});

installFrontendDiagnostics();
