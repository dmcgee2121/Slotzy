/* Slotzy SPA core (prototype)
   Notes:
   - Uses localStorage for prototype auth/data (NOT secure; for MVP only)
   - Renders views into <main id="app">
   - Uses a modal for Login/Register
*/

import { storage } from "./core.js";
import * as dataStore from "./dataStore.js";
import { createAuthUi, initializeAuthMode, restoreSessionFromApi } from "./auth.js";
import { renderOwnerBookingsSection } from "./booking.js";
import { wireLogoutButton } from "./logout.js";
import { initDemoMode } from "./demo.js";

/* -------------------- STORAGE KEYS -------------------- */
const KEYS = {
  USER: "Slotzy_user",
  SERVICES: "Slotzy_services",
  BOOKINGS: "Slotzy_bookings",
};
const HOME_NOTICE_KEY = "Slotzy_homeNotice";
const CUSTOMER_LOGIN_DISABLED_MESSAGE = "Customer logins not enabled — use booking link";

/* -------------------- DEFAULT DATA -------------------- */
const defaultServices = [
  { id: "s1", title: "Haircut", duration: 30, price: 25, desc: "Standard cut" },
  { id: "s2", title: "Beard Trim", duration: 20, price: 15, desc: "Line-up + trim" },
  { id: "s3", title: "Cut + Beard", duration: 50, price: 35, desc: "Haircut + beard" },
];
const DEMO_OWNER_USERNAME = "owner_demo";

function initStorage() {
  if (typeof dataStore.isDemoMode === "function" && dataStore.isDemoMode()) {
    return;
  }
  if (!storage.get(KEYS.SERVICES)) storage.set(KEYS.SERVICES, defaultServices);
  if (!storage.get(KEYS.BOOKINGS)) storage.set(KEYS.BOOKINGS, []);
}

/* -------------------- HELPERS -------------------- */
function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function getUser() {
  return dataStore.getSessionUser();
}

function isStaffRole(role) {
  const normalized = String(role ?? "").trim().toLowerCase();
  return normalized === "owner" || normalized === "barber";
}

function isStaffUser(user) {
  return Boolean(user && isStaffRole(user.role));
}

function setHomeNotice(message) {
  const nextMessage = String(message ?? "").trim();
  if (!nextMessage) return;
  try {
    sessionStorage.setItem(HOME_NOTICE_KEY, nextMessage);
  } catch {
    // ignore storage failures
  }
}

function consumeHomeNotice() {
  try {
    const message = String(sessionStorage.getItem(HOME_NOTICE_KEY) ?? "").trim();
    if (!message) return "";
    sessionStorage.removeItem(HOME_NOTICE_KEY);
    return message;
  } catch {
    return "";
  }
}

function setUser(u) {
  if (!isStaffUser(u)) {
    setHomeNotice(CUSTOMER_LOGIN_DISABLED_MESSAGE);
    dataStore.clearSessionUser();
    updateNav();
    return false;
  }
  dataStore.setSessionUser({
    username: String(u.username ?? "").trim(),
    role: String(u.role ?? "").trim().toLowerCase(),
  });
  updateNav();
  return true;
}
function clearUser() {
  dataStore.clearSessionUser();
  updateNav();
}
function loadUserFromSession() {
  const user = getUser();
  if (isStaffUser(user)) return user;
  if (user) {
    setHomeNotice(CUSTOMER_LOGIN_DISABLED_MESSAGE);
    clearUser();
  }
  return null;
}

function getServices() { return storage.get(KEYS.SERVICES, []); }
function getBookings() { return storage.get(KEYS.BOOKINGS, []); }
function saveBookings(b) { storage.set(KEYS.BOOKINGS, b); }
function saveServices(services) { storage.set(KEYS.SERVICES, services); }

function normalizeService(service) {
  const name = String(service?.name ?? service?.title ?? "").trim() || "Service";
  const priceNumber = Number(service?.price ?? 0);
  const durationNumber = Number(service?.durationMinutes ?? service?.duration ?? 0);
  const price = Number.isFinite(priceNumber) ? Number(priceNumber.toFixed(2)) : 0;
  const durationMinutes = Number.isFinite(durationNumber) ? Math.round(durationNumber) : 0;
  return {
    ...service,
    id: String(service?.id ?? `s_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`),
    name,
    title: name,
    price,
    durationMinutes,
    duration: durationMinutes,
  };
}

function getNormalizedServices() {
  return getServices()
    .map(normalizeService)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function validateServiceInput({ name, price, durationMinutes }) {
  const errors = [];
  if (String(name ?? "").trim().length < 2) {
    errors.push("Name is required and must be at least 2 characters.");
  }
  if (!Number.isFinite(price) || price <= 0) {
    errors.push("Price is required and must be greater than 0.");
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 10 || durationMinutes > 240) {
    errors.push("Duration is required and must be between 10 and 240 minutes.");
  }
  return errors;
}

/* Load owner CSS once.
   Use import.meta.url so it works whether you're running locally (Live Server)
   or deploying under a sub-path (e.g., GitHub Pages).
*/
function ensureOwnerStylesLoaded() {
  const id = "slotzy-owner-css";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = new URL("../css/owner-dashboard.css", import.meta.url).href;
  document.head.appendChild(link);
}

/* -------------------- DOM REFERENCES -------------------- */
const app = document.getElementById("app");
const modal = document.getElementById("modal");
const modalPanel = document.getElementById("modal-panel");
let modalLastFocusedElement = null;
let modalKeydownHandler = null;

const btnHome = document.getElementById("btn-home");
const btnLogin = document.getElementById("btn-login");
const btnDashboard = document.getElementById("btn-dashboard");
const btnLogout = document.getElementById("logoutBtn") || document.getElementById("btn-logout");
const topbarContainer = document.querySelector(".topbar .container");
const primaryNav = document.getElementById("nav");
let homeNavEscapeHandler = null;

/* -------------------- MODAL: SHOW/HIDE -------------------- */
function showModal() {
  modalLastFocusedElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  bindModalKeyboardSupport();
  requestAnimationFrame(() => {
    modal.classList.add("show");
    const focusable = getModalFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      modalPanel?.focus();
    }
  });
}

function hideModal() {
  if (!modal) return;
  let didFinalize = false;
  const finalizeClose = () => {
    if (didFinalize) return;
    didFinalize = true;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    modalPanel.innerHTML = "";
    document.body.classList.remove("modal-open");
    unbindModalKeyboardSupport();
    if (modalLastFocusedElement && document.contains(modalLastFocusedElement)) {
      modalLastFocusedElement.focus();
    }
    modalLastFocusedElement = null;
  };

  modal.classList.remove("show");
  modal.addEventListener("transitionend", function handler() {
    finalizeClose();
    modal.removeEventListener("transitionend", handler);
  }, { once: true });
  window.setTimeout(() => {
    if (!modal.classList.contains("show")) finalizeClose();
  }, 320);
}

/* Close on backdrop click */
modal?.addEventListener("click", (e) => {
  if (e.target === modal) hideModal();
});

function getModalFocusableElements() {
  if (!modalPanel) return [];
  return Array.from(
    modalPanel.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((node) => node instanceof HTMLElement && !node.classList.contains("hidden"));
}

function bindModalKeyboardSupport() {
  if (!modal || modalKeydownHandler) return;
  modalKeydownHandler = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      hideModal();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = getModalFocusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      modalPanel?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener("keydown", modalKeydownHandler);
}

function unbindModalKeyboardSupport() {
  if (!modalKeydownHandler) return;
  document.removeEventListener("keydown", modalKeydownHandler);
  modalKeydownHandler = null;
}

const { openAuthModal } = createAuthUi({
  modalPanel,
  showModal,
  hideModal,
  setUser,
  goToDashboard,
});

/* -------------------- NAV BUTTONS -------------------- */
btnHome?.addEventListener("click", renderHome);
btnLogin?.addEventListener("click", openAuthModal);
btnDashboard?.addEventListener("click", goToDashboard);
wireLogoutButton({ redirectPath: "/index.html" });

/* -------------------- NAV STATE -------------------- */
function updateNav() {
  const user = isStaffUser(getUser()) ? getUser() : null;
  if (user) {
    btnLogin?.classList.add("hidden");
    btnDashboard?.classList.remove("hidden");
    btnLogout?.classList.remove("hidden");
  } else {
    btnLogin?.classList.remove("hidden");
    btnDashboard?.classList.add("hidden");
    btnLogout?.classList.add("hidden");
  }
}

function closeHomeMobileNav() {
  if (!topbarContainer) return;
  topbarContainer.classList.remove("mobile-nav-open");
  const toggle = topbarContainer.querySelector(".mobile-nav-toggle");
  if (toggle instanceof HTMLButtonElement) {
    toggle.setAttribute("aria-expanded", "false");
  }
}

function initHomeMobileNav() {
  if (!topbarContainer || !primaryNav) return;
  if (topbarContainer.classList.contains("owner-shell-header")) return;
  if (topbarContainer.dataset.mobileNavReady === "true") return;

  const navId = String(primaryNav.id || "nav");
  primaryNav.id = navId;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "mobile-nav-toggle";
  toggle.setAttribute("aria-label", "Toggle navigation menu");
  toggle.setAttribute("aria-controls", navId);
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = `
    <span class="mobile-nav-toggle-label">Menu</span>
    <span class="mobile-nav-toggle-icon" aria-hidden="true"></span>
  `;

  const brand = topbarContainer.querySelector(".brand");
  if (brand instanceof HTMLElement) {
    brand.insertAdjacentElement("afterend", toggle);
  } else {
    topbarContainer.prepend(toggle);
  }

  toggle.addEventListener("click", () => {
    const isOpen = topbarContainer.classList.toggle("mobile-nav-open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  primaryNav.querySelectorAll("a, button").forEach((item) => {
    if (!(item instanceof HTMLElement)) return;
    item.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 768px)").matches) {
        closeHomeMobileNav();
      }
    });
  });

  homeNavEscapeHandler = (event) => {
    if (event.key !== "Escape") return;
    closeHomeMobileNav();
  };
  document.addEventListener("keydown", homeNavEscapeHandler);

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 768px)").matches) {
      closeHomeMobileNav();
    }
  });

  topbarContainer.dataset.mobileNavReady = "true";
}

/* -------------------- HOME -------------------- */
function renderHome() {
  const demoModeActive = typeof dataStore.isDemoMode === "function" && dataStore.isDemoMode();
  const homeNotice = consumeHomeNotice();
  app.innerHTML = `
    <section class="page active home-hero">
      <h1>Welcome to Slotzy</h1>
      <p>Owners and barbers sign in to manage the shop. Clients book publicly with a shared link and manage appointments from the receipt link.</p>
      <div class="home-login-row">
        <button id="btn-book-appointment" class="btn btn-primary" type="button">I'm a Client</button>
        <button id="btn-get-started" class="btn btn-ghost" type="button">Owner / Barber Login</button>
        ${demoModeActive
    ? '<button id="btn-demo-owner-login" class="btn btn-ghost" type="button">Login as Demo Owner</button>'
    : ""}
      </div>
      <p class="small muted">Ask your barber for their booking link or scan the QR. If you do not have a direct link yet, open the public booking page and choose a shop.</p>
      ${homeNotice
    ? `<p class="small booking-status" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(homeNotice)}</p>`
    : ""}
    </section>
  `;
  document.getElementById("btn-get-started")?.addEventListener("click", openAuthModal);
  document.getElementById("btn-book-appointment")?.addEventListener("click", () => {
    window.location.href = "/pages/book.html";
  });
  if (demoModeActive) {
    document.getElementById("btn-demo-owner-login")?.addEventListener("click", loginAsDemoOwner);
  }
}

function loginAsDemoOwner() {
  try {
    if (typeof dataStore.seedDemoDataIfMissing === "function") {
      dataStore.seedDemoDataIfMissing({ force: false });
    }

    const users = typeof dataStore.getUsers === "function" ? dataStore.getUsers() : [];
    const ownerRecord = users.find(
      (user) => String(user?.username ?? "").trim().toLowerCase() === DEMO_OWNER_USERNAME
    );
    if (!ownerRecord) {
      window.showToast?.("Demo owner account is unavailable. Reset demo data and try again.", "error");
      return;
    }

    const role = String(ownerRecord?.role ?? "owner").trim().toLowerCase() || "owner";
    setUser({ username: DEMO_OWNER_USERNAME, role });
    goToDashboard();
  } catch (error) {
    console.warn("[Slotzy:demo] Failed to sign in as demo owner.", error);
    window.showToast?.("Could not sign in as demo owner right now.", "error");
  }
}

/* -------------------- DASHBOARDS -------------------- */
function goToDashboard() {
  const u = getUser();
  if (!isStaffUser(u)) {
    setHomeNotice(CUSTOMER_LOGIN_DISABLED_MESSAGE);
    clearUser();
    navigateToIfNeeded("/index.html");
    return;
  }
  navigateToIfNeeded("/pages/business-owner.html");
}

function navigateToIfNeeded(targetPath) {
  const currentPath = window.location.pathname;
  if (currentPath === targetPath) return;
  window.location.href = targetPath;
}

function renderOwnerDashboard() {
  ensureOwnerStylesLoaded();

  const services = getNormalizedServices();
  const bookings = getBookings();

  app.innerHTML = `
    <div class="owner-dashboard">
      <div class="dashboard-header">
        <h1>Owner Dashboard</h1>
        <p>Signed in as <strong>${escapeHtml(getUser().username)}</strong></p>
        <div class="dashboard-actions">
          <button id="btn-owner-home" class="btn btn-ghost">Home</button>
          <button id="btn-owner-add-service" class="btn btn-primary">Add Service</button>
        </div>
      </div>

      <section class="card">
        <h2>Services</h2>
        ${services.length === 0
          ? `
            <section class="empty-state">
              <span class="empty-state-icon" aria-hidden="true">S</span>
              <h3>No services yet</h3>
              <p>Add your first service so customers can start booking.</p>
              <button id="btn-owner-empty-add" class="btn btn-ghost empty-state-cta" type="button">Add Service</button>
            </section>
          `
          : `
            <ul class="list">
              ${services.map((s) => `
                <li class="list-row">
                  <div>
                    <strong>${escapeHtml(s.name)}</strong>
                    <div class="muted">$${Number(s.price).toFixed(2)} • ${Number(s.durationMinutes)} min</div>
                  </div>
                  <div class="right owner-service-actions">
                    <button class="btn btn-ghost" type="button" data-action="edit-service" data-id="${escapeHtml(s.id)}">Edit</button>
                    <button class="btn btn-danger" type="button" data-action="delete-service" data-id="${escapeHtml(s.id)}">Delete</button>
                  </div>
                </li>
              `).join("")}
            </ul>
          `}
      </section>

      ${renderOwnerBookingsSection(bookings, escapeHtml)}
    </div>
  `;

  document.getElementById("btn-owner-home")?.addEventListener("click", renderHome);
  document.getElementById("btn-owner-add-service")?.addEventListener("click", () => openServiceModal());
  document.getElementById("btn-owner-empty-add")?.addEventListener("click", () => openServiceModal());
  app.querySelectorAll('button[data-action="edit-service"]').forEach((btn) => {
    btn.addEventListener("click", () => openServiceModal({ serviceId: String(btn.getAttribute("data-id") ?? "") }));
  });
  app.querySelectorAll('button[data-action="delete-service"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const serviceId = String(btn.getAttribute("data-id") ?? "");
      if (!serviceId) return;
      const servicesList = getNormalizedServices();
      const service = servicesList.find((item) => item.id === serviceId);
      if (!service) return;
      if (!window.confirm(`Delete "${service.name}"?`)) return;
      saveServices(servicesList.filter((item) => item.id !== serviceId));
      renderOwnerDashboard();
    });
  });
}

function openServiceModal({ serviceId = "" } = {}) {
  const services = getNormalizedServices();
  const editingService = services.find((item) => item.id === serviceId) || null;
  const isEditing = Boolean(editingService);

  modalPanel.innerHTML = `
    <h2>${isEditing ? "Edit Service" : "Add Service"}</h2>
    <form id="service-form">
      <label>Service Name</label>
      <input id="svc-title" value="${escapeHtml(editingService?.name ?? "")}" required />

      <label>Duration (minutes)</label>
      <input id="svc-duration" type="number" min="10" max="240" step="1" value="${Number(editingService?.durationMinutes ?? 30)}" required />

      <label>Price ($)</label>
      <input id="svc-price" type="number" min="0.01" step="0.01" value="${Number(editingService?.price ?? 25)}" required />

      <label>Description</label>
      <input id="svc-desc" placeholder="Optional" value="${escapeHtml(editingService?.desc ?? "")}" />

      <div id="svc-error" class="service-form-error hidden"></div>

      <button class="btn btn-primary" type="submit">Save</button>
      <button class="btn btn-ghost" type="button" id="svc-cancel">Cancel</button>
    </form>
  `;
  showModal();

  document.getElementById("svc-cancel")?.addEventListener("click", hideModal);
  document.getElementById("service-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("svc-title").value.trim();
    const durationMinutes = Number(document.getElementById("svc-duration").value);
    const price = Number(document.getElementById("svc-price").value);
    const desc = document.getElementById("svc-desc").value.trim();
    const errorBox = document.getElementById("svc-error");

    const errors = validateServiceInput({ name, durationMinutes, price });
    const duplicate = services.some(
      (item) => item.id !== serviceId && item.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) errors.push("A service with that name already exists.");

    if (errors.length > 0) {
      if (errorBox) {
        errorBox.innerHTML = errors.map(escapeHtml).join("<br />");
        errorBox.classList.remove("hidden");
      }
      return;
    }

    if (errorBox) {
      errorBox.innerHTML = "";
      errorBox.classList.add("hidden");
    }

    let nextServices = [];
    if (isEditing) {
      nextServices = services.map((item) => (
        item.id === serviceId
          ? normalizeService({ ...item, name, title: name, durationMinutes, duration: durationMinutes, price, desc })
          : item
      ));
    } else {
      const id = `s_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
      nextServices = [...services, normalizeService({ id, name, title: name, durationMinutes, duration: durationMinutes, price, desc })];
    }
    saveServices(nextServices);

    hideModal();
    renderOwnerDashboard();
  });
}

function registerPwaServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const swUrl = new URL("../sw.js", import.meta.url).href;
    navigator.serviceWorker.register(swUrl).catch((error) => {
      console.warn("[Slotzy:PWA] Service worker registration failed.", error);
    });
  });
}

registerPwaServiceWorker();

/* -------------------- BOOT -------------------- */
async function boot() {
  initDemoMode();
  initStorage();
  initHomeMobileNav();
  loadUserFromSession();
  await initializeAuthMode();
  await restoreSessionFromApi({ setUser, clearUser });
  updateNav();
  if (getUser()) goToDashboard();
  else renderHome();
}

boot();
