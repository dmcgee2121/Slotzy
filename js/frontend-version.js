(function defineSlotzyBuildInfo(scope) {
  const buildInfo = Object.freeze({
    appVersion: "0.1.0-beta",
    buildId: "2026.10.10-p0-b1b",
    cacheVersion: "slotzy-shell-v6",
  });

  Object.defineProperty(scope, "SLOTZY_BUILD_INFO", {
    configurable: false,
    enumerable: true,
    writable: false,
    value: buildInfo,
  });
})(globalThis);
