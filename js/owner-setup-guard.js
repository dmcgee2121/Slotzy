import * as dataStore from "./dataStore.js";
import { shouldShowOwnerSetupWizard } from "./owner-setup-state.js";

(function () {
  const path = String(window.location.pathname ?? "").toLowerCase();
  if (path.endsWith("/owner-setup.html")) return;

  const sessionUser = dataStore.getSessionUser();
  const username = String(sessionUser?.username ?? "").trim();
  const role = String(sessionUser?.role ?? "").trim().toLowerCase();
  if (!username || role !== "owner") return;
  async function resolveSetupGuard() {
    // A fresh hosted owner can be routed from the dashboard using the single
    // authoritative auth read. Do that before requesting the other setup
    // collections so navigation cannot create a four-read burst immediately
    // before owner-setup.html initializes its own state.
    if (path.endsWith("/business-owner.html") && dataStore.getAuthToken()) {
      const users = await dataStore.getUsersAsync({ fallbackOnError: false });
      const authoritativeOwner = users.find(
        (user) => String(user?.username ?? "").trim().toLowerCase() === username.toLowerCase()
      );
      if (authoritativeOwner && !String(authoritativeOwner?.shopId ?? "").trim()) return true;
    }
    return shouldShowOwnerSetupWizard(username);
  }

  resolveSetupGuard()
    .then((shouldRedirect) => {
      if (!shouldRedirect) return;
      const target = new URL("./owner-setup.html", window.location.href);
      window.location.replace(target.href);
    })
    .catch((error) => {
      console.warn("[Slotzy:owner-setup] Could not resolve setup state.", error);
      // Do not leave an owner on a dashboard whose authoritative setup state
      // could not be established. The setup page has a dedicated retryable
      // error state and is the safe destination for an unresolved hosted
      // owner. Local/demo sessions have no bearer credential and retain their
      // established compatibility behavior.
      const cachedOwner = dataStore.getUsers().find(
        (user) => String(user?.username ?? "").trim().toLowerCase() === username.toLowerCase()
      );
      if (
        !path.endsWith("/business-owner.html")
        || !dataStore.getAuthToken()
        || String(cachedOwner?.shopId ?? "").trim()
      ) return;
      const target = new URL("./owner-setup.html", window.location.href);
      window.location.replace(target.href);
    });
})();
