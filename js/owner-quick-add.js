(function () {
  const SERVICES_KEY = "Slotzy_services";
  let didBind = false;

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
        return existing === lowerName;
      });
      if (hasDuplicate) {
        setStatus("A service with that name already exists.", false);
        return;
      }

      services.push({
        id: makeServiceId(),
        name,
        price: Math.round(price * 100) / 100,
        duration: Math.round(duration),
        active: true,
        createdAt: new Date().toISOString(),
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
      });
    }

    function closeModal() {
      modal.classList.remove("show");
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      clearStatus();
    }

    function setStatus(message, isSuccess) {
      statusEl.textContent = message;
      statusEl.classList.remove("status-success", "status-error");
      statusEl.classList.add(isSuccess ? "status-success" : "status-error");
    }

    function clearStatus() {
      statusEl.textContent = "";
      statusEl.classList.remove("status-success", "status-error");
    }
  }

  function loadServices() {
    try {
      const raw = localStorage.getItem(SERVICES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveServices(services) {
    localStorage.setItem(SERVICES_KEY, JSON.stringify(services));
  }

  function makeServiceId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `s_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }
})();
