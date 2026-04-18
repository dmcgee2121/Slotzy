import * as dataStore from "./dataStore.js";
import { shouldShowOwnerSetupWizard } from "./owner-setup-state.js";

(function () {
  const path = String(window.location.pathname ?? "").toLowerCase();
  if (path.endsWith("/owner-setup.html")) return;

  const sessionUser = dataStore.getSessionUser();
  const username = String(sessionUser?.username ?? "").trim();
  const role = String(sessionUser?.role ?? "").trim().toLowerCase();
  if (!username || role !== "owner") return;

  shouldShowOwnerSetupWizard(username)
    .then((shouldRedirect) => {
      if (!shouldRedirect) return;
      const target = new URL("./owner-setup.html", window.location.href);
      window.location.replace(target.href);
    })
    .catch((error) => {
      console.warn("[Slotzy:owner-setup] Could not resolve setup state.", error);
    });
})();
