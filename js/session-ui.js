import * as dataStore from "./dataStore.js";
import { doLogout } from "./logout.js";

(function () {
  let escapeHandler = null;
  let toastTimer = null;

  function getSessionUser() {
    return dataStore.getSessionUser();
  }

  function updateUserBadge() {
    const badge = document.getElementById("userBadge");
    if (!badge) return;

    const user = getSessionUser();
    const username = user && typeof user.username === "string"
      ? user.username.trim()
      : "";
    const firstName = getProfileFirstName(username);

    if (!username) {
      badge.textContent = "";
      badge.removeAttribute("title");
      badge.classList.add("hidden");
      return;
    }

    badge.textContent = `Welcome, ${firstName || username}`;
    badge.title = `Logged in as ${username}`;
    badge.classList.remove("hidden");
  }

  function getProfilesMap() {
    return dataStore.getProfiles();
  }

  function getProfileFirstName(username) {
    const key = String(username ?? "").trim();
    if (!key) return "";
    const profiles = getProfilesMap();
    const profile = profiles[key];
    if (!profile || typeof profile !== "object") return "";

    const fullName = String(profile.fullName ?? "").trim();
    if (!fullName) return "";
    const firstName = fullName.split(/\s+/)[0];
    return firstName || "";
  }

  function getModalNodes() {
    const existingOverlay = document.getElementById("modal");
    const existingPanel = document.getElementById("modal-panel");
    if (existingOverlay && existingPanel) {
      return {
        overlay: existingOverlay,
        panel: existingPanel,
        isSharedAppModal: true,
      };
    }

    let overlay = document.getElementById("modalOverlay");
    let panel = document.getElementById("modalPanel");

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "modalOverlay";
      overlay.className = "modal-overlay hidden";
      document.body.appendChild(overlay);
    }
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "modalPanel";
      panel.className = "modal-panel hidden";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      document.body.appendChild(panel);
    }

    return { overlay, panel, isSharedAppModal: false };
  }

  function closeModal(modalNodes) {
    const { overlay, panel, isSharedAppModal } = modalNodes;
    if (isSharedAppModal) {
      overlay.classList.remove("show");
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      panel.innerHTML = "";
    } else {
      overlay.classList.add("hidden");
      panel.classList.add("hidden");
      panel.innerHTML = "";
    }

    if (escapeHandler) {
      document.removeEventListener("keydown", escapeHandler);
      escapeHandler = null;
    }
  }

  function confirmLogout() {
    const isPagesRoute = window.location.pathname.includes("/pages/");
    doLogout(isPagesRoute ? "../index.html" : "/index.html");
  }

  function openLogoutModal() {
    const modalNodes = getModalNodes();
    const { overlay, panel, isSharedAppModal } = modalNodes;

    panel.innerHTML = `
      <h2>Log out?</h2>
      <p class="small session-modal-copy">You'll need to sign in again to access your dashboard.</p>
      <div class="session-modal-actions">
        <button type="button" class="btn btn-ghost" data-action="cancel-logout">Cancel</button>
        <button type="button" class="btn btn-primary" data-action="confirm-logout">Log out</button>
      </div>
    `;

    if (isSharedAppModal) {
      overlay.classList.remove("hidden");
      overlay.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => overlay.classList.add("show"));
    } else {
      overlay.classList.remove("hidden");
      panel.classList.remove("hidden");
    }

    panel.querySelector('[data-action="cancel-logout"]')?.addEventListener("click", () => {
      closeModal(modalNodes);
    });
    panel.querySelector('[data-action="confirm-logout"]')?.addEventListener("click", () => {
      closeModal(modalNodes);
      confirmLogout();
    });

    const overlayClose = (event) => {
      if (event.target !== overlay) return;
      closeModal(modalNodes);
    };
    overlay.addEventListener("click", overlayClose, { once: true });

    escapeHandler = (event) => {
      if (event.key !== "Escape") return;
      closeModal(modalNodes);
    };
    document.addEventListener("keydown", escapeHandler);
  }

  function attachLogoutModal(root = document) {
    const buttons = root.querySelectorAll(".logout-btn, #logoutBtn, #btn-logout");
    buttons.forEach((button) => {
      if (button.dataset.logoutModalBound === "true") return;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        openLogoutModal();
      });
      button.dataset.logoutModalBound = "true";
    });
  }

  function getToastNode() {
    let toast = document.getElementById("toast");
    if (toast) return toast;

    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast hidden";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
    return toast;
  }

  function showToast(message, type = "success") {
    const toast = getToastNode();
    const safeMessage = String(message ?? "").trim();
    if (!safeMessage) return;

    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }

    toast.textContent = safeMessage;
    toast.classList.remove("hidden", "toast-success", "toast-error", "toast-info");
    if (type === "error") {
      toast.classList.add("toast-error");
    } else {
      toast.classList.add("toast-success");
    }

    toastTimer = window.setTimeout(() => {
      toast.classList.add("hidden");
      toast.classList.remove("toast-success", "toast-error", "toast-info");
      toastTimer = null;
    }, 2500);
  }

  // Expose for module scripts that want to delegate logout handling.
  window.attachLogoutModal = attachLogoutModal;
  window.showToast = showToast;

  function initSessionUi() {
    updateUserBadge();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSessionUi);
  } else {
    initSessionUi();
  }
})();
