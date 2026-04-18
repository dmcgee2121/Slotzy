const SESSION_KEYS_TO_CLEAR = ["Slotzy_user", "Slotzy_auth_token", "Slotzy_token"];
const LOCAL_KEYS_TO_CLEAR = ["Slotzy_auth_token", "Slotzy_token"];

function clearStorageKeys(storage, keys) {
  keys.forEach((key) => {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore storage errors during logout.
    }
  });
}

export function doLogout(redirectPath) {
  clearStorageKeys(sessionStorage, SESSION_KEYS_TO_CLEAR);
  clearStorageKeys(localStorage, LOCAL_KEYS_TO_CLEAR);

  window.location.href = redirectPath || "../index.html";
}

export function wireLogoutButton({ buttonId = "logoutBtn", redirectPath } = {}) {
  const button = document.getElementById(buttonId);
  if (!button) return;
  if (button.dataset.logoutBound === "true") return;

  button.addEventListener("click", (event) => {
    event.preventDefault();
    doLogout(redirectPath);
  });
  button.dataset.logoutBound = "true";
}
