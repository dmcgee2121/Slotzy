const SHELL_CACHE_NAME = "slotzy-shell-v1";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/pages/index.html",
  "/css/styles.css",
  "/css/owner-dashboard.css",
  "/js/main.js",
  "/js/app.js",
  "/js/auth.js",
  "/js/core.js",
  "/js/dataStore.js",
  "/js/nav.js",
  "/js/session-ui.js",
  "/assets/images/slotzy-logo.png",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/icon-maskable-512.png",
  "/manifest.json",
];

const SHELL_ASSET_PATHS = new Set(
  SHELL_ASSETS.map((asset) => new URL(asset, self.location.origin).pathname)
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;
  const isShellPath = pathname === "/" || SHELL_ASSET_PATHS.has(pathname);
  const isNavigation = request.mode === "navigate";

  if (pathname.startsWith("/api/") || pathname.startsWith("/server/")) {
    return;
  }

  if (!isShellPath && !isNavigation) {
    return;
  }

  if (!isShellPath && isNavigation) {
    return;
  }

  if (isNavigation) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    return cache.match("/index.html");
  }
}
