import * as dataStore from "./dataStore.js";
import { doLogout } from "./logout.js";
import { showToast as showToastBase } from "./toast.js";

(function () {
  let escapeHandler = null;
  const DEMO_BANNER_ID = "demoModeBanner";

  function getSessionUser() {
    return dataStore.getSessionUser();
  }

  function getDemoResetUrl() {
    const isPagesRoute = window.location.pathname.includes("/pages/");
    return isPagesRoute
      ? "../index.html?reset=1&demo=1"
      : "./index.html?reset=1&demo=1";
  }

  function renderDemoModeBanner() {
    const existing = document.getElementById(DEMO_BANNER_ID);
    const isActive = typeof dataStore.isDemoMode === "function" && dataStore.isDemoMode();

    if (!isActive) {
      existing?.remove();
      return;
    }

    const banner = existing || document.createElement("aside");
    banner.id = DEMO_BANNER_ID;
    banner.className = "demo-mode-banner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.innerHTML = `
      <span class="demo-mode-banner__text"><strong>Demo Mode ON</strong></span>
      <button type="button" class="btn btn-ghost demo-mode-banner__reset">Reset Demo</button>
    `;

    const resetBtn = banner.querySelector(".demo-mode-banner__reset");
    resetBtn?.addEventListener("click", () => {
      window.location.href = getDemoResetUrl();
    });

    if (!existing) {
      document.body.prepend(banner);
    }
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
      <h2 id="logout-modal-title">Log out?</h2>
      <p class="small session-modal-copy">You'll need to sign in again to access your dashboard.</p>
      <div class="session-modal-actions">
        <button type="button" class="btn btn-ghost" data-action="cancel-logout">Cancel</button>
        <button type="button" class="btn btn-primary" data-action="confirm-logout">Log out</button>
      </div>
    `;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "logout-modal-title");

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
    panel.querySelector('[data-action="cancel-logout"]')?.focus();

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

  function initMobileDashboardNav() {
    const headers = document.querySelectorAll(".owner-shell-header");
    if (!headers.length) return;

    headers.forEach((header, index) => {
      if (!(header instanceof HTMLElement)) return;
      if (header.dataset.mobileNavReady === "true") return;

      const nav = header.querySelector(".owner-header-actions");
      if (!(nav instanceof HTMLElement)) return;

      const navId = String(nav.id || `owner-header-nav-${index + 1}`);
      nav.id = navId;

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "owner-mobile-nav-toggle";
      toggleBtn.setAttribute("aria-controls", navId);
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.setAttribute("aria-label", "Toggle navigation menu");
      toggleBtn.innerHTML = `
        <span class="owner-mobile-nav-label">Menu</span>
        <span class="owner-mobile-nav-icon" aria-hidden="true"></span>
      `;

      const brand = header.querySelector(".owner-brand");
      if (brand instanceof HTMLElement) {
        brand.insertAdjacentElement("afterend", toggleBtn);
      } else {
        header.prepend(toggleBtn);
      }

      const closeMenu = () => {
        header.classList.remove("mobile-nav-open");
        toggleBtn.setAttribute("aria-expanded", "false");
      };

      toggleBtn.addEventListener("click", () => {
        const isOpen = header.classList.toggle("mobile-nav-open");
        toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });

      nav.querySelectorAll("a, button").forEach((item) => {
        if (!(item instanceof HTMLElement)) return;
        item.addEventListener("click", () => {
          if (window.matchMedia("(max-width: 768px)").matches) {
            closeMenu();
          }
        });
      });

      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        closeMenu();
      });

      window.addEventListener("resize", () => {
        if (!window.matchMedia("(max-width: 768px)").matches) {
          closeMenu();
        }
      });

      header.dataset.mobileNavReady = "true";
    });
  }

  function showToast(message, typeOrOptions = "success", durationMs = 2500) {
    if (typeOrOptions && typeof typeOrOptions === "object" && !Array.isArray(typeOrOptions)) {
      showToastBase(message, typeOrOptions);
      return;
    }

    showToastBase(message, {
      type: String(typeOrOptions ?? "success"),
      duration: durationMs,
    });
  }

  // Expose for module scripts that want to delegate logout handling.
  window.attachLogoutModal = attachLogoutModal;
  window.showToast = showToast;

  function initSessionUi() {
    renderDemoModeBanner();
    updateUserBadge();
    initMobileDashboardNav();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSessionUi);
  } else {
    initSessionUi();
  }
})();
