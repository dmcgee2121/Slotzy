import * as dataStore from "./dataStore.js";

(function () {
  let didBind = false;
  const sessionUser = dataStore.getSessionUser();
  const currentUsername = String(sessionUser?.username ?? "").trim();
  const currentRole = String(sessionUser?.role ?? "").toLowerCase();
  const isStaff = currentRole === "owner" || currentRole === "barber";

  document.addEventListener("DOMContentLoaded", initQuickAddService);

  function initQuickAddService() {
    if (didBind) return;
    didBind = true;

    const quickAddBtn = document.getElementById("quickAddServiceBtn");
    const modal = document.getElementById("quickServiceModal");
    const nameInput = document.getElementById("serviceNameQuick");
    const priceInput = document.getElementById("servicePriceQuick");
    const durationInput = document.getElementById("serviceDurationQuick");
    const createBtn = document.getElementById("createQuickServiceBtn");
    const cancelBtn = document.getElementById("cancelQuickServiceBtn");
    const statusEl = document.getElementById("quickServiceStatus");

    if (!quickAddBtn || !modal || !nameInput || !priceInput || !durationInput || !createBtn || !cancelBtn || !statusEl) {
      return;
    }

    if (!isStaff || !currentUsername) {
      quickAddBtn.classList.add("hidden");
      return;
    }

    quickAddBtn.addEventListener("click", () => {
      clearStatus();
      nameInput.value = "";
      priceInput.value = "";
      durationInput.value = "";
      openModal();
      nameInput.focus();
    });

    cancelBtn.addEventListener("click", closeModal);
    createBtn.addEventListener("click", handleCreateService);
    modal.addEventListener("click", (event) => {
      if (event.target !== modal) return;
      closeModal();
    });
    modal.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeModal();
    });

    function handleCreateService() {
      clearStatus();

      const name = String(nameInput.value || "").trim();
      const price = Number(priceInput.value);
      const duration = Number(durationInput.value);

      if (name.length < 2) {
        setStatus("Service name must be at least 2 characters.", false);
        return;
      }
      if (!Number.isFinite(price) || price < 0) {
        setStatus("Price must be 0 or greater.", false);
        return;
      }
      if (!Number.isFinite(duration) || duration < 5) {
        setStatus("Duration must be at least 5 minutes.", false);
        return;
      }

      const services = loadServices();
      const lowerName = name.toLowerCase();
      const hasDuplicate = services.some((service) => {
        const existing = String(service?.name ?? service?.title ?? "").trim().toLowerCase();
        const barber = String(service?.barberUsername ?? service?.ownerUsername ?? "");
        return existing === lowerName && barber === currentUsername;
      });
      if (hasDuplicate) {
        setStatus("A service with that name already exists.", false);
        return;
      }

      const shopId = resolveCurrentShopId();
      services.push({
        id: makeServiceId(),
        name,
        title: name,
        price: Math.round(price * 100) / 100,
        duration: Math.round(duration),
        durationMinutes: Math.round(duration),
        active: true,
        createdAtISO: new Date().toISOString(),
        shopId,
        barberUsername: currentUsername,
        ownerUsername: currentUsername,
      });
      saveServices(services);

      setStatus("Service created successfully.", true);
      window.showToast?.("Service added successfully.", "success");
      window.setTimeout(() => {
        closeModal();
      }, 250);
    }

    function openModal() {
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => {
        modal.classList.add("show");
        nameInput.focus();
      });
    }

    function closeModal() {
      modal.classList.remove("show");
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      clearStatus();
    }

    function setStatus(message, isSuccess) {
      statusEl.textContent = String(message ?? "");
      statusEl.setAttribute("role", isSuccess ? "status" : "alert");
      statusEl.setAttribute("aria-live", isSuccess ? "polite" : "assertive");
      statusEl.setAttribute("aria-atomic", "true");
      statusEl.classList.remove("status-success", "status-error");
      statusEl.classList.add(isSuccess ? "status-success" : "status-error");
    }

    function clearStatus() {
      statusEl.textContent = "";
      statusEl.setAttribute("role", "status");
      statusEl.setAttribute("aria-live", "polite");
      statusEl.setAttribute("aria-atomic", "true");
      statusEl.classList.remove("status-success", "status-error");
    }
  }

  function loadServices() {
    return dataStore.getServices();
  }

  function saveServices(services) {
    dataStore.saveServices(services);
  }

  function resolveCurrentShopId() {
    const user = dataStore.getUsers().find((item) => String(item?.username ?? "") === currentUsername);
    const direct = String(user?.shopId ?? "").trim();
    if (direct) return direct;
    const fallback = dataStore.getShopForUser(currentUsername);
    return String(fallback?.id ?? "");
  }

  function makeServiceId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `s_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }
})();
