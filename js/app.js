/* legacy/kept for compatibility
   Deprecated entry point. Primary app boot is `js/main.js`.
   This shim intentionally keeps only compatibility behavior for older pages:
   - ensures data model bootstrap runs
   - wires logout button redirect when present
*/

import * as dataStore from "./dataStore.js";
import { wireLogoutButton } from "./logout.js";

(function initLegacyAppShim() {
  dataStore.ensureDataModel();

  const logoutButton = document.getElementById("logoutBtn") || document.getElementById("btn-logout");
  if (!logoutButton) return;

  if (!logoutButton.id) {
    logoutButton.id = "slotzy-legacy-logout";
  }

  const redirectPath = window.location.pathname.includes("/pages/") ? "../index.html" : "/index.html";
  wireLogoutButton({ buttonId: logoutButton.id, redirectPath });
})();
