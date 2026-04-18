import * as dataStore from "./dataStore.js";

const API_BASE = "http://localhost:3001";
const AUTH_PING_PATH = "/api/health";
const AUTH_MODE_TIMEOUT_MS = 1000;
const AUTH_MODE_CACHE_MS = 5000;
const AUTH_MODE_SERVER = "server";
const AUTH_MODE_LOCAL = "local";
const FRIENDLY_OFFLINE_ERROR = "Cannot reach the auth server. Start backend on http://localhost:3001 and try again.";
const LOCAL_MODE_MESSAGE = "Backend offline — using local demo login.";
const CUSTOMER_LOGIN_DISABLED_MESSAGE = "Customer logins not enabled — use booking link";

let authMode = AUTH_MODE_SERVER;
let authModePromise = null;
let authModeLastCheckedAt = 0;

syncAuthModeDocument();

function normalizeRole(role) {
  const value = String(role ?? "").trim().toLowerCase();
  if (value === "owner" || value === "customer" || value === "barber") return value;
  return "owner";
}

function isCustomerRole(role) {
  return normalizeRole(role) === "customer";
}

function normalizeAuthUser(user) {
  if (!user || typeof user !== "object") return null;
  const username = String(user.username ?? "").trim();
  if (!username) return null;
  return {
    username,
    role: normalizeRole(user.role),
  };
}

function syncAuthUserToLocalUsers(authUser) {
  const normalizedUser = normalizeAuthUser(authUser);
  if (!normalizedUser) return;

  const users = dataStore.getUsers();
  const matchIndex = users.findIndex(
    (candidate) => String(candidate?.username ?? "").toLowerCase() === normalizedUser.username.toLowerCase()
  );
  const current = matchIndex >= 0 ? users[matchIndex] : {};

  const shops = dataStore.getShops();
  const fallbackShopId = String(shops[0]?.id ?? "").trim();
  const role = normalizeRole(normalizedUser.role);
  const next = {
    ...current,
    username: normalizedUser.username,
    role,
    displayName: String(current?.displayName ?? normalizedUser.username).trim() || normalizedUser.username,
  };

  if (role === "owner" || role === "barber") {
    const shopId = String(current?.shopId ?? fallbackShopId).trim();
    next.shopId = shopId || null;
  } else {
    next.shopId = null;
  }

  if (matchIndex >= 0) users[matchIndex] = next;
  else users.push(next);

  dataStore.saveUsers(users);
}

function getErrorMessage(payload, fallback) {
  if (payload && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  if (payload && typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  return fallback;
}

function setAuthMode(nextMode) {
  authMode = nextMode === AUTH_MODE_LOCAL ? AUTH_MODE_LOCAL : AUTH_MODE_SERVER;
  dataStore.setApiEnabled(authMode === AUTH_MODE_SERVER);
  syncAuthModeDocument();
  return authMode;
}

function syncAuthModeDocument() {
  if (typeof document === "undefined" || !document.documentElement) return;
  document.documentElement.dataset.authMode = authMode;
}

function isOfflineErrorMessage(message) {
  return String(message ?? "").trim() === FRIENDLY_OFFLINE_ERROR;
}

async function requestJson(path, { method = "GET", token = "", body } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(FRIENDLY_OFFLINE_ERROR);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Unable to complete authentication right now."));
  }

  return payload ?? {};
}

async function pingAuthServer() {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = window.setTimeout(() => {
    controller?.abort();
  }, AUTH_MODE_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${AUTH_PING_PATH}`, {
      method: "GET",
      cache: "no-store",
      signal: controller?.signal,
    });
    if (!response.ok) {
      throw new Error("health_check_failed");
    }
    return setAuthMode(AUTH_MODE_SERVER);
  } catch {
    return setAuthMode(AUTH_MODE_LOCAL);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function checkAuthServerOnline({ force = false } = {}) {
  const now = Date.now();
  if (!force && authModePromise) {
    return authModePromise;
  }
  if (!force && authModeLastCheckedAt && (now - authModeLastCheckedAt) < AUTH_MODE_CACHE_MS) {
    return authMode;
  }

  authModePromise = pingAuthServer().finally(() => {
    authModeLastCheckedAt = Date.now();
    authModePromise = null;
  });
  return authModePromise;
}

export function getAuthMode() {
  return authMode;
}

export async function initializeAuthMode() {
  return checkAuthServerOnline();
}

async function resolveAuthMode({ refreshLocal = false } = {}) {
  if (refreshLocal && authMode === AUTH_MODE_LOCAL) {
    return checkAuthServerOnline({ force: true });
  }
  if (authModePromise) return authModePromise;
  if (authModeLastCheckedAt) return authMode;
  return initializeAuthMode();
}

async function submitServerAuth({ username, password, role, isRegister }) {
  const path = isRegister ? "/api/auth/register" : "/api/auth/login";
  const payload = isRegister
    ? { username, password, role: normalizeRole(role) }
    : { username, password };

  const response = await requestJson(path, {
    method: "POST",
    body: payload,
  });

  const token = String(response?.token ?? "").trim();
  const authUser = normalizeAuthUser(response?.user);
  if (!token || !authUser) {
    throw new Error("Auth response was missing required fields.");
  }
  if (isCustomerRole(authUser.role)) {
    dataStore.clearAuthToken();
    throw new Error(CUSTOMER_LOGIN_DISABLED_MESSAGE);
  }

  setAuthMode(AUTH_MODE_SERVER);
  dataStore.setAuthToken(token);
  syncAuthUserToLocalUsers(authUser);
  return authUser;
}

function findLocalUser(username, users = dataStore.getUsers()) {
  const normalizedUsername = String(username ?? "").trim().toLowerCase();
  if (!normalizedUsername) return null;
  return users.find(
    (candidate) => String(candidate?.username ?? "").trim().toLowerCase() === normalizedUsername
  ) || null;
}

function buildLocalUserRecord({ username, password, role }) {
  const normalizedUsername = String(username ?? "").trim();
  const normalizedRole = normalizeRole(role);
  const fallbackShopId = String(dataStore.getShops()[0]?.id ?? "").trim();

  return {
    username: normalizedUsername,
    password: String(password ?? ""),
    role: normalizedRole,
    displayName: normalizedUsername,
    shopId: normalizedRole === "owner" || normalizedRole === "barber"
      ? (fallbackShopId || null)
      : null,
  };
}

async function submitLocalAuth({ username, password, role, isRegister }) {
  setAuthMode(AUTH_MODE_LOCAL);

  const normalizedUsername = String(username ?? "").trim();
  const normalizedPassword = String(password ?? "");
  const users = dataStore.getUsers();
  const existingUser = findLocalUser(normalizedUsername, users);

  if (isRegister) {
    if (isCustomerRole(role)) {
      throw new Error(CUSTOMER_LOGIN_DISABLED_MESSAGE);
    }
    if (existingUser) {
      throw new Error("That username is already in use.");
    }

    const nextUser = buildLocalUserRecord({
      username: normalizedUsername,
      password: normalizedPassword,
      role,
    });
    dataStore.saveUsers([...users, nextUser]);
    dataStore.clearAuthToken();
    return normalizeAuthUser(nextUser);
  }

  if (isCustomerRole(existingUser?.role)) {
    throw new Error(CUSTOMER_LOGIN_DISABLED_MESSAGE);
  }
  if (!existingUser || String(existingUser?.password ?? "") !== normalizedPassword) {
    throw new Error("Invalid username or password.");
  }

  dataStore.clearAuthToken();
  return normalizeAuthUser(existingUser);
}

async function submitAuth(options) {
  const activeMode = await resolveAuthMode({ refreshLocal: true });
  if (activeMode === AUTH_MODE_LOCAL) {
    return submitLocalAuth(options);
  }

  try {
    return await submitServerAuth(options);
  } catch (error) {
    const message = String(error?.message ?? "").trim();
    if (!isOfflineErrorMessage(message)) {
      throw error;
    }

    setAuthMode(AUTH_MODE_LOCAL);
    return submitLocalAuth(options);
  }
}

export async function restoreSessionFromApi({ setUser, clearUser } = {}) {
  const activeMode = await resolveAuthMode();
  const existingSessionUser = dataStore.getSessionUser();

  if (activeMode === AUTH_MODE_LOCAL) {
    if (isCustomerRole(existingSessionUser?.role)) {
      dataStore.clearAuthToken();
      if (typeof clearUser === "function") clearUser();
      return {
        restored: false,
        reason: "customer_disabled",
        user: null,
      };
    }
    if (existingSessionUser && typeof setUser === "function") setUser(existingSessionUser);
    return {
      restored: Boolean(existingSessionUser),
      reason: existingSessionUser ? "local_session" : "local_mode",
      user: existingSessionUser || null,
    };
  }

  const token = dataStore.getAuthToken();
  if (!token) {
    if (existingSessionUser && typeof setUser === "function") setUser(existingSessionUser);
    if (!existingSessionUser && typeof clearUser === "function") clearUser();
    return {
      restored: Boolean(existingSessionUser),
      reason: token ? "ready" : "missing_token",
      user: existingSessionUser || null,
    };
  }

  try {
    const response = await requestJson("/api/auth/me", {
      method: "GET",
      token,
    });
    const authUser = normalizeAuthUser(response?.user);
    if (!authUser) {
      dataStore.clearAuthToken();
      if (typeof clearUser === "function") clearUser();
      return { restored: false, reason: "invalid_user" };
    }
    if (isCustomerRole(authUser.role)) {
      dataStore.clearAuthToken();
      if (typeof clearUser === "function") clearUser();
      return { restored: false, reason: "customer_disabled" };
    }

    syncAuthUserToLocalUsers(authUser);
    if (typeof setUser === "function") setUser(authUser);
    return { restored: true, user: authUser };
  } catch (error) {
    const message = String(error?.message ?? "").trim();
    if (isOfflineErrorMessage(message)) {
      setAuthMode(AUTH_MODE_LOCAL);
      if (existingSessionUser && typeof setUser === "function") setUser(existingSessionUser);
      return {
        restored: Boolean(existingSessionUser),
        reason: "offline",
        user: existingSessionUser || null,
        error: message,
      };
    }

    dataStore.clearAuthToken();
    if (typeof clearUser === "function") clearUser();
    return { restored: false, reason: "invalid_token", error: message };
  }
}

export function createAuthUi({
  modalPanel,
  showModal,
  hideModal,
  setUser,
  goToDashboard,
}) {
  function openAuthModal() {
    modalPanel.innerHTML = `
      <h2 id="modal-title">Login</h2>
      <div class="modal-toggle">
        <button type="button" id="show-login" class="btn btn-ghost active" aria-pressed="true">Login</button>
        <button type="button" id="show-register" class="btn btn-ghost" aria-pressed="false">Register</button>
      </div>
      <p id="auth-mode-note" class="small muted hidden" aria-live="polite" aria-atomic="true"></p>

      <form id="auth-form" aria-describedby="auth-error" novalidate>
        <label for="auth-username">Username</label>
        <input type="text" id="auth-username" autocomplete="username" required />

        <label for="auth-password">Password</label>
        <input type="password" id="auth-password" autocomplete="current-password" required />

        <div id="role-wrap" class="hidden" aria-hidden="true">
          <label for="auth-role">Role</label>
          <select id="auth-role">
            <option value="owner">Business Owner</option>
            <option value="barber">Barber</option>
          </select>
        </div>

        <button type="submit" class="btn btn-primary" id="submit-btn">Continue</button>
        <button type="button" class="btn btn-ghost" id="close-modal">Close</button>
        <div id="auth-error" class="small auth-error hidden" role="alert" aria-live="assertive" aria-atomic="true"></div>
      </form>
    `;

    showModal();
    document.getElementById("auth-username")?.focus();

    const showLoginBtn = document.getElementById("show-login");
    const showRegisterBtn = document.getElementById("show-register");
    const roleWrap = document.getElementById("role-wrap");
    const modalTitle = document.getElementById("modal-title");
    const authError = document.getElementById("auth-error");
    const submitBtn = document.getElementById("submit-btn");
    const authModeNote = document.getElementById("auth-mode-note");

    function setAuthError(message) {
      if (!authError) return;
      const text = String(message ?? "").trim();
      authError.textContent = text;
      authError.classList.toggle("hidden", !text);
    }

    function renderAuthModeMessage(mode) {
      if (!authModeNote) return;
      const isLocal = String(mode ?? getAuthMode()) === AUTH_MODE_LOCAL;
      authModeNote.textContent = isLocal ? LOCAL_MODE_MESSAGE : "";
      authModeNote.classList.toggle("hidden", !isLocal);
    }

    function setMode(mode) {
      const isRegister = mode === "register";
      modalTitle.textContent = isRegister ? "Register" : "Login";
      roleWrap.classList.toggle("hidden", !isRegister);
      roleWrap.setAttribute("aria-hidden", isRegister ? "false" : "true");
      showLoginBtn.classList.toggle("active", !isRegister);
      showRegisterBtn.classList.toggle("active", isRegister);
      showLoginBtn.setAttribute("aria-pressed", isRegister ? "false" : "true");
      showRegisterBtn.setAttribute("aria-pressed", isRegister ? "true" : "false");
      setAuthError("");
    }

    renderAuthModeMessage(getAuthMode());
    resolveAuthMode().then(renderAuthModeMessage);

    showLoginBtn.addEventListener("click", () => setMode("login"));
    showRegisterBtn.addEventListener("click", () => setMode("register"));

    document.getElementById("close-modal")?.addEventListener("click", hideModal);

    document.getElementById("auth-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      setAuthError("");

      const username = document.getElementById("auth-username").value.trim();
      const password = document.getElementById("auth-password").value.trim();
      const role = document.getElementById("auth-role").value;
      const isRegister = showRegisterBtn.classList.contains("active");

      if (!username || !password) {
        setAuthError("Enter both username and password.");
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      try {
        const authUser = await submitAuth({
          username,
          password,
          role,
          isRegister,
        });
        renderAuthModeMessage(getAuthMode());
        setUser(authUser);
        hideModal();
        goToDashboard();
      } catch (error) {
        renderAuthModeMessage(getAuthMode());
        setAuthError(error?.message || "Unable to sign in right now.");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  return { openAuthModal };
}

