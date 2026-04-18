const API_BASE = "http://localhost:3001/api";
const ADMIN_TOKEN_KEY = "Slotzy_admin_token";

(function () {
  const adminStatus = document.getElementById("adminStatus");
  const adminDisabledCard = document.getElementById("adminDisabledCard");
  const adminLoginCard = document.getElementById("adminLoginCard");
  const adminConsole = document.getElementById("adminConsole");
  const adminSecretInput = document.getElementById("adminSecretInput");
  const adminLoginBtn = document.getElementById("adminLoginBtn");
  const adminSeedDemoBtn = document.getElementById("adminSeedDemoBtn");
  const adminClearAllBtn = document.getElementById("adminClearAllBtn");
  const adminLogoutBtn = document.getElementById("adminLogoutBtn");
  const adminShopsList = document.getElementById("adminShopsList");

  document.addEventListener("DOMContentLoaded", initAdminConsole);

  async function initAdminConsole() {
    bindEvents();
    await checkAdminStatus();
  }

  function bindEvents() {
    adminLoginBtn?.addEventListener("click", handleAdminLogin);
    adminSeedDemoBtn?.addEventListener("click", handleSeedDemoShop);
    adminClearAllBtn?.addEventListener("click", handleClearAllData);
    adminLogoutBtn?.addEventListener("click", () => {
      clearAdminToken();
      showConsole(false);
      showLogin(true);
      setStatus("Admin session cleared.", true);
    });
  }

  async function checkAdminStatus() {
    try {
      const data = await fetchJson("/admin/status");
      if (!data?.enabled) {
        showDisabled(true);
        showLogin(false);
        showConsole(false);
        setStatus("Admin disabled.", false);
        return;
      }

      showDisabled(false);
      if (getAdminToken()) {
        try {
          await loadShops();
          showConsole(true);
          showLogin(false);
          setStatus("Admin console ready.", true);
          return;
        } catch (error) {
          clearAdminToken();
          setStatus(getErrorMessage(error, "Admin session expired."), false);
        }
      }

      showLogin(true);
      showConsole(false);
      clearStatus();
    } catch (error) {
      showDisabled(false);
      showLogin(true);
      showConsole(false);
      setStatus(getErrorMessage(error, "Could not reach the admin API."), false);
    }
  }

  async function handleAdminLogin() {
    const secret = String(adminSecretInput?.value ?? "");
    if (!secret) {
      setStatus("Enter the admin secret.", false);
      return;
    }

    setStatus("Signing in...", true);
    try {
      const data = await fetchJson("/admin/login", {
        method: "POST",
        body: { secret },
      });
      const token = String(data?.token ?? "").trim();
      if (!token) {
        throw new Error("Admin token missing.");
      }
      setAdminToken(token);
      if (adminSecretInput) adminSecretInput.value = "";
      await loadShops();
      showLogin(false);
      showConsole(true);
      setStatus("Admin signed in.", true);
    } catch (error) {
      clearAdminToken();
      setStatus(getErrorMessage(error, "Could not sign in to admin console."), false);
    }
  }

  async function loadShops() {
    const data = await fetchJson("/admin/shops", {
      auth: true,
    });
    renderShops(Array.isArray(data?.shops) ? data.shops : []);
  }

  function renderShops(shops) {
    if (!adminShopsList) return;
    if (!shops.length) {
      adminShopsList.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>No shops yet</h3>
          <p>Seed a demo shop or wait for a pilot shop to be created.</p>
        </section>
      `;
      return;
    }

    adminShopsList.innerHTML = shops.map((shop) => `
      <article class="card owner-action-card section-stack" data-shop-id="${escapeHtml(shop.id)}" data-shop-slug="${escapeHtml(shop.slug)}" data-shop-name="${escapeHtml(shop.name)}">
        <h3>${escapeHtml(shop.name)}</h3>
        <p class="small">Slug: ${escapeHtml(shop.slug || "n/a")}</p>
        <p class="small">Created: ${escapeHtml(formatDate(shop.createdAtISO))}</p>
        <p class="small">Barbers: ${escapeHtml(String(shop.barberCount ?? 0))}</p>
        <p class="small">Bookings: ${escapeHtml(String(shop.bookingCount ?? 0))}</p>
        <div class="public-booking-qr-actions">
          <button class="btn btn-ghost" type="button" data-action="open-booking">Open Booking Page</button>
          <button class="btn btn-ghost" type="button" data-action="export-shop">Export Shop Data</button>
          <button class="btn btn-danger" type="button" data-action="reset-shop">Reset Shop Data</button>
        </div>
      </article>
    `).join("");

    adminShopsList.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", handleShopActionClick);
    });
  }

  async function handleShopActionClick(event) {
    const button = event.currentTarget;
    const action = String(button?.getAttribute("data-action") ?? "").trim();
    const card = button?.closest("[data-shop-id]");
    const shopId = String(card?.getAttribute("data-shop-id") ?? "").trim();
    const shopSlug = String(card?.getAttribute("data-shop-slug") ?? "").trim();
    const shopName = String(card?.getAttribute("data-shop-name") ?? "").trim() || "shop";
    if (!shopId || !action) return;

    if (action === "open-booking") {
      const url = `${window.location.origin}/pages/book.html?shop=${encodeURIComponent(shopSlug)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    if (action === "export-shop") {
      try {
        const payload = await fetchJson(`/admin/shops/${encodeURIComponent(shopId)}/export`, { auth: true });
        downloadJson(`${sanitizeFilename(shopName)}-export.json`, payload);
        setStatus(`Exported ${shopName}.`, true);
      } catch (error) {
        setStatus(getErrorMessage(error, "Could not export shop data."), false);
      }
      return;
    }

    if (action === "reset-shop") {
      const confirmed = window.confirm(`Reset pilot data for ${shopName}? This removes barbers, services, bookings, and availability for that shop.`);
      if (!confirmed) return;
      try {
        await fetchJson(`/admin/shops/${encodeURIComponent(shopId)}/reset`, {
          method: "POST",
          auth: true,
        });
        await loadShops();
        setStatus(`${shopName} was reset.`, true);
      } catch (error) {
        setStatus(getErrorMessage(error, "Could not reset shop data."), false);
      }
    }
  }

  async function handleSeedDemoShop() {
    try {
      await fetchJson("/admin/seed-demo-shop", {
        method: "POST",
        auth: true,
      });
      await loadShops();
      setStatus("Demo shop seeded.", true);
    } catch (error) {
      setStatus(getErrorMessage(error, "Could not seed demo shop."), false);
    }
  }

  async function handleClearAllData() {
    const confirmed = window.confirm("Clear all backend data? This is intended for developer use only.");
    if (!confirmed) return;

    try {
      await fetchJson("/admin/clear-all", {
        method: "POST",
        auth: true,
      });
      await loadShops();
      setStatus("All backend data cleared.", true);
    } catch (error) {
      setStatus(getErrorMessage(error, "Could not clear backend data."), false);
    }
  }

  async function fetchJson(path, { method = "GET", body, auth = false } = {}) {
    const headers = {
      "Content-Type": "application/json",
    };
    if (auth) {
      const token = getAdminToken();
      if (!token) {
        throw new Error("Admin sign-in required.");
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(getErrorMessage(payload, `Request failed: ${response.status}`));
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function getAdminToken() {
    try {
      return String(sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "").trim();
    } catch {
      return "";
    }
  }

  function setAdminToken(token) {
    try {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, String(token ?? ""));
    } catch {
      // ignore
    }
  }

  function clearAdminToken() {
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    } catch {
      // ignore
    }
  }

  function showDisabled(show) {
    adminDisabledCard?.classList.toggle("hidden", !show);
  }

  function showLogin(show) {
    adminLoginCard?.classList.toggle("hidden", !show);
  }

  function showConsole(show) {
    adminConsole?.classList.toggle("hidden", !show);
  }

  function setStatus(message, isSuccess) {
    if (!adminStatus) return;
    adminStatus.textContent = String(message ?? "");
    adminStatus.setAttribute("role", isSuccess ? "status" : "alert");
    adminStatus.setAttribute("aria-live", isSuccess ? "polite" : "assertive");
    adminStatus.setAttribute("aria-atomic", "true");
    adminStatus.classList.remove("status-success", "status-error");
    adminStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function clearStatus() {
    if (!adminStatus) return;
    adminStatus.textContent = "";
    adminStatus.classList.remove("status-success", "status-error");
  }

  function getErrorMessage(error, fallback) {
    if (error instanceof Error && error.message) return error.message;
    if (error && typeof error === "object") {
      const message = String(error.error ?? error.message ?? "").trim();
      if (message) return message;
    }
    return fallback;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(value) {
    const date = new Date(String(value ?? ""));
    if (!Number.isFinite(date.getTime())) return "Unknown";
    return date.toLocaleString();
  }

  function sanitizeFilename(value) {
    return String(value ?? "shop")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "shop";
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
})();
