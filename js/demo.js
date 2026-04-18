import * as dataStore from "./dataStore.js";

function cleanupDemoQueryParams() {
  const cleanedUrl = new URL(window.location.href);
  cleanedUrl.searchParams.delete("demo");
  cleanedUrl.searchParams.delete("reset");
  window.history.replaceState({}, "", cleanedUrl.pathname + cleanedUrl.search + cleanedUrl.hash);
}

export function initDemoMode() {
  const params = new URLSearchParams(window.location.search);
  const resetRequested = params.get("reset") === "1";
  const demoRequested = params.get("demo") === "1";
  const hasDemoQuery = resetRequested || demoRequested;

  try {
    if (resetRequested) {
      dataStore.resetSlotzyData({ demoOnly: false });
      dataStore.setDemoMode(false);
    }

    if (demoRequested) {
      dataStore.setDemoMode(true);
      dataStore.seedDemoDataIfMissing({ force: resetRequested });
    } else if (dataStore.isDemoMode()) {
      // Keep demo sessions usable on refreshes while the tab is open.
      dataStore.seedDemoDataIfMissing({ force: false });
    }
  } catch (error) {
    console.warn("[Slotzy:demo] Failed to initialize demo mode.", error);
  } finally {
    if (hasDemoQuery) {
      cleanupDemoQueryParams();
    }
  }

  return {
    demoRequested,
    resetRequested,
    active: dataStore.isDemoMode(),
  };
}
