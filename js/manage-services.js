import * as dataStore from "./dataStore.js";

(function () {
  const serviceNameInput = document.getElementById("serviceName");
  const servicePriceInput = document.getElementById("servicePrice");
  const serviceDurationInput = document.getElementById("serviceDuration");
  const addServiceBtn = document.getElementById("addServiceBtn");
  const serviceList = document.getElementById("serviceList");
  const showToast = window.showToast;

  init();

  function init() {
    renderServices();
    addServiceBtn?.addEventListener("click", handleAddService);
  }

  function loadServices() {
    return dataStore.getServices();
  }

  function saveServices(services) {
    dataStore.saveServices(services);
  }

  function handleAddService() {
    const name = String(serviceNameInput?.value ?? "").trim();
    const price = Number(servicePriceInput?.value ?? "");
    const duration = Number(serviceDurationInput?.value ?? "");

    if (!name || !Number.isFinite(price) || price < 0 || !Number.isFinite(duration) || duration <= 0) {
      return;
    }

    const services = loadServices();
    const exists = services.some((service) => {
      const serviceName = String(service.name ?? service.title ?? "").trim().toLowerCase();
      return serviceName === name.toLowerCase();
    });
    if (exists) return;

    services.push({
      id: makeId(),
      name,
      price,
      duration,
      active: true,
    });
    saveServices(services);
    clearForm();
    renderServices();
    showToast?.(`Service added: ${name}`, "success");
  }

  function handleRemoveService(serviceId) {
    const allServices = loadServices();
    const removed = allServices.find((service) => String(service.id ?? "") === String(serviceId));
    const services = allServices.filter((service) => String(service.id ?? "") !== String(serviceId));
    saveServices(services);
    renderServices();
    const removedName = String(removed?.name ?? removed?.title ?? "Service");
    showToast?.(`Service removed: ${removedName}`, "success");
  }

  function renderServices() {
    if (!serviceList) return;
    const services = loadServices();

    if (services.length === 0) {
      serviceList.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">✂️</span>
          <h3>No services yet</h3>
          <p>Add your first service so customers can start booking.</p>
          <a href="#serviceName" class="btn btn-ghost empty-state-cta">Add a service</a>
        </section>
      `;
      return;
    }

    serviceList.innerHTML = services.map((service) => {
      const id = String(service.id ?? "");
      const name = String(service.name ?? service.title ?? "Service");
      const price = Number(service.price ?? 0);
      const duration = Number(service.duration ?? 0);
      const active = service.active !== false;
      return `
        <article class="card">
          <h3>${escapeHtml(name)}</h3>
          <p><strong>Price:</strong> $${escapeHtml(price)}</p>
          <p><strong>Duration:</strong> ${escapeHtml(duration)} minutes</p>
          <p><strong>Status:</strong> ${active ? "Active" : "Inactive"}</p>
          <button class="btn btn-danger" type="button" data-action="remove" data-id="${escapeHtml(id)}">Remove</button>
        </article>
      `;
    }).join("");

    serviceList.querySelectorAll('button[data-action="remove"]').forEach((button) => {
      button.addEventListener("click", () => {
        const serviceId = String(button.getAttribute("data-id") ?? "");
        if (!serviceId) return;
        handleRemoveService(serviceId);
      });
    });
  }

  function clearForm() {
    if (serviceNameInput) serviceNameInput.value = "";
    if (servicePriceInput) servicePriceInput.value = "";
    if (serviceDurationInput) serviceDurationInput.value = "";
  }

  function makeId() {
    return `s_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
