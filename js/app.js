/* Slotzy SPA core (prototype)
   Notes:
   - Uses localStorage for prototype auth/data (NOT secure; for MVP only)
   - Renders views into <main id="app">
   - Uses a modal for Login/Register
*/

import { storage, attachLogoutHandler } from "./core.js";

/* -------------------- STORAGE KEYS -------------------- */
const KEYS = {
  USER: "Slotzy_user",
  USERS: "Slotzy_users",
  SERVICES: "Slotzy_services",
  BOOKINGS: "Slotzy_bookings",
};

/* -------------------- DEFAULT DATA -------------------- */
const defaultServices = [
  { id: "s1", title: "Haircut", duration: 30, price: 25, desc: "Standard cut" },
  { id: "s2", title: "Beard Trim", duration: 20, price: 15, desc: "Line-up + trim" },
  { id: "s3", title: "Cut + Beard", duration: 50, price: 35, desc: "Haircut + beard" },
];

function initStorage() {
  if (!storage.get(KEYS.SERVICES)) storage.set(KEYS.SERVICES, defaultServices);
  if (!storage.get(KEYS.BOOKINGS)) storage.set(KEYS.BOOKINGS, []);
  if (!storage.get(KEYS.USERS)) storage.set(KEYS.USERS, []); // array of {username, password, role}
}

/* -------------------- HELPERS -------------------- */
function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function getUser() {
  try { return JSON.parse(sessionStorage.getItem("Slotzy_user") || "null"); }
  catch { return null; }
}
function setUser(u) {
  sessionStorage.setItem("Slotzy_user", JSON.stringify(u));
  updateNav();
}
function clearUser() {
  sessionStorage.removeItem("Slotzy_user");
  updateNav();
}


function getUsers() { return storage.get(KEYS.USERS, []); }
function saveUsers(users) { storage.set(KEYS.USERS, users); }

function getServices() { return storage.get(KEYS.SERVICES, []); }
function getBookings() { return storage.get(KEYS.BOOKINGS, []); }
function saveBookings(b) { storage.set(KEYS.BOOKINGS, b); }

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

const btnHome = document.getElementById("btn-home");
const btnLogin = document.getElementById("btn-login");
const btnDashboard = document.getElementById("btn-dashboard");
const btnLogout = document.getElementById("logoutBtn") || document.getElementById("btn-logout");

/* -------------------- NAV BUTTONS -------------------- */
btnHome?.addEventListener("click", renderHome);
btnLogin?.addEventListener("click", openAuthModal);
btnDashboard?.addEventListener("click", goToDashboard);
attachLogoutHandler();

/* -------------------- NAV STATE -------------------- */
function updateNav() {
  const user = getUser();
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

/* -------------------- HOME -------------------- */
function renderHome() {
  app.innerHTML = `
    <section class="page active">
      <h1>Welcome to Slotzy</h1>
      <p>Book appointments with top professionals near you.</p>
      <button id="btn-get-started" class="btn btn-primary">Get Started</button>
    </section>
  `;
  document.getElementById("btn-get-started")?.addEventListener("click", openAuthModal);
}

/* -------------------- MODAL: SHOW/HIDE -------------------- */
function showModal() {
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => modal.classList.add("show"));
}

function hideModal() {
  modal.classList.remove("show");
  modal.addEventListener("transitionend", function handler() {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    modalPanel.innerHTML = "";
    modal.removeEventListener("transitionend", handler);
  });
}

/* Close on backdrop click */
modal?.addEventListener("click", (e) => {
  if (e.target === modal) hideModal();
});

/* -------------------- MODAL: AUTH -------------------- */
function openAuthModal() {
  modalPanel.innerHTML = `
    <h2 id="modal-title">Login</h2>
    <div class="modal-toggle">
      <button type="button" id="show-login" class="btn btn-ghost active">Login</button>
      <button type="button" id="show-register" class="btn btn-ghost">Register</button>
    </div>

    <form id="auth-form">
      <label>Username</label>
      <input type="text" id="auth-username" required />

      <label>Password</label>
      <input type="password" id="auth-password" required />

      <div id="role-wrap" style="display:none;">
        <label>Role</label>
        <select id="auth-role">
          <option value="customer">Customer</option>
          <option value="owner">Business Owner</option>
        </select>
      </div>

      <button type="submit" class="btn btn-primary" id="submit-btn">Continue</button>
      <button type="button" class="btn btn-ghost" id="close-modal">Close</button>
    </form>
  `;

  showModal();

  const showLoginBtn = document.getElementById("show-login");
  const showRegisterBtn = document.getElementById("show-register");
  const roleWrap = document.getElementById("role-wrap");
  const modalTitle = document.getElementById("modal-title");

  function setMode(mode) {
    const isRegister = mode === "register";
    modalTitle.textContent = isRegister ? "Register" : "Login";
    roleWrap.style.display = isRegister ? "block" : "none";
    showLoginBtn.classList.toggle("active", !isRegister);
    showRegisterBtn.classList.toggle("active", isRegister);
  }

  showLoginBtn.addEventListener("click", () => setMode("login"));
  showRegisterBtn.addEventListener("click", () => setMode("register"));

  document.getElementById("close-modal")?.addEventListener("click", hideModal);

  document.getElementById("auth-form")?.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = document.getElementById("auth-username").value.trim();
    const password = document.getElementById("auth-password").value.trim();
    const role = document.getElementById("auth-role").value;
    const isRegister = showRegisterBtn.classList.contains("active");

    if (!username || !password) return alert("Enter both username and password.");

    const users = getUsers();

    if (isRegister) {
      const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase());
      if (exists) return alert("That username is taken. Try another.");

      // Prototype only: storing password in localStorage is not secure.
      users.push({ username, password, role });
      saveUsers(users);
      setUser({ username, role });
      hideModal();
      goToDashboard();
      return;
    }

    // Login
    const match = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!match || match.password !== password) return alert("Invalid username or password.");
    setUser({ username: match.username, role: match.role });
    hideModal();
    goToDashboard();
  });
}

/* -------------------- DASHBOARDS -------------------- */
function goToDashboard() {
  const u = getUser();
  if (!u) { alert("Please sign in first."); return; }
  if (u.role === "owner") navigateToIfNeeded("/pages/business-owner.html");
  else navigateToIfNeeded("/pages/customer-dashboard.html");
}

function navigateToIfNeeded(targetPath) {
  const currentPath = window.location.pathname;
  if (currentPath === targetPath) return;
  window.location.href = targetPath;
}

function renderOwnerDashboard() {
  ensureOwnerStylesLoaded();

  const services = getServices();
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
        <ul class="list">
          ${services.map(s => `
            <li class="list-row">
              <div>
                <strong>${escapeHtml(s.title)}</strong>
                <div class="muted">${escapeHtml(s.desc || "")}</div>
              </div>
              <div class="right">
                <span>${Number(s.duration)}m</span>
                <span>$${Number(s.price)}</span>
              </div>
            </li>
          `).join("")}
        </ul>
      </section>

      <section class="card">
        <h2>Bookings</h2>
        <ul class="list">
          ${bookings.length === 0
            ? `<li class="muted">No bookings yet</li>`
            : bookings.map(b => `
              <li class="list-row">
                <div>
                  <strong>${escapeHtml(b.name)}</strong>
                  <div class="muted">${escapeHtml(b.serviceTitle)} • ${new Date(b.datetime).toLocaleString()}</div>
                </div>
              </li>
            `).join("")}
        </ul>
      </section>
    </div>
  `;

  document.getElementById("btn-owner-home")?.addEventListener("click", renderHome);
  document.getElementById("btn-owner-add-service")?.addEventListener("click", () => openAddServiceModal());
}

function openAddServiceModal() {
  modalPanel.innerHTML = `
    <h2>Add Service</h2>
    <form id="service-form">
      <label>Service Name</label>
      <input id="svc-title" required />

      <label>Duration (minutes)</label>
      <input id="svc-duration" type="number" min="5" step="5" value="30" required />

      <label>Price ($)</label>
      <input id="svc-price" type="number" min="0" step="1" value="25" required />

      <label>Description</label>
      <input id="svc-desc" placeholder="Optional" />

      <button class="btn btn-primary" type="submit">Save</button>
      <button class="btn btn-ghost" type="button" id="svc-cancel">Cancel</button>
    </form>
  `;
  showModal();

  document.getElementById("svc-cancel")?.addEventListener("click", hideModal);
  document.getElementById("service-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("svc-title").value.trim();
    const duration = Number(document.getElementById("svc-duration").value);
    const price = Number(document.getElementById("svc-price").value);
    const desc = document.getElementById("svc-desc").value.trim();

    if (!title) return alert("Service name is required.");
    if (!Number.isFinite(duration) || duration <= 0) return alert("Duration must be a positive number.");
    if (!Number.isFinite(price) || price < 0) return alert("Price must be 0 or more.");

    const services = getServices();
    const id = "s" + Math.random().toString(16).slice(2, 8);
    services.push({ id, title, duration, price, desc });
    storage.set(KEYS.SERVICES, services);

    hideModal();
    renderOwnerDashboard();
  });
}

function renderCustomerDashboard() {
  const u = getUser();
  const bookings = getBookings().filter(b => b.name === u.username);

  app.innerHTML = `
    <div class="customer-dashboard">
      <h1>My Bookings</h1>
      <p>Signed in as <strong>${escapeHtml(u.username)}</strong></p>
      <button id="btn-cust-home" class="btn btn-ghost">Home</button>

      <ul class="list">
        ${bookings.length === 0
          ? `<li class="muted">No bookings found</li>`
          : bookings.map(b => `
            <li class="list-row">
              <div>
                <strong>${escapeHtml(b.serviceTitle)}</strong>
                <div class="muted">${new Date(b.datetime).toLocaleString()}</div>
              </div>
            </li>
          `).join("")}
      </ul>
    </div>
  `;
  document.getElementById("btn-cust-home")?.addEventListener("click", renderHome);
}
function resetAllData() {
  sessionStorage.removeItem(KEYS.USER);
  localStorage.removeItem(KEYS.USERS);
  localStorage.removeItem(KEYS.SERVICES);
  localStorage.removeItem(KEYS.BOOKINGS);
}

// Open the site like: http://127.0.0.1:5500/?reset=1
if (new URLSearchParams(location.search).has("reset")) {
  resetAllData();
}

/* -------------------- BOOT -------------------- */
initStorage();
updateNav();
if (!app) {
  // Non-app-shell pages (e.g., owner management pages) should not auto-redirect.
  return;
}
if (getUser()) goToDashboard();
else renderHome();
