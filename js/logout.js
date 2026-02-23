const SESSION_KEYS_TO_CLEAR = [
  "Slotzy_user",
  "Slotzy_token",
];

export function doLogout(redirectPath) {
  SESSION_KEYS_TO_CLEAR.forEach((key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore storage errors during logout.
    }
  });

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
