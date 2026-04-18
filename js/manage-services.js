import * as dataStore from "./dataStore.js";

(function () {
  const serviceNameInput = document.getElementById("serviceName");
  const servicePriceInput = document.getElementById("servicePrice");
  const serviceDurationInput = document.getElementById("serviceDuration");
  const addServiceBtn = document.getElementById("addServiceBtn");
  const serviceList = document.getElementById("serviceList");
  const showToast = window.showToast;

  const sessionUser = dataStore.getSessionUser();
  const currentUsername = String(sessionUser?.username ?? "").trim();
  const currentRole = String(sessionUser?.role ?? "").toLowerCase();
  const isStaffUser = currentRole === "owner" || currentRole === "barber";
  const currentShopId = resolveCurrentShopId();

  let editingServiceId = "";
  let editDraft = null;
  let editErrors = [];

  init();

  function init() {
    if (!isStaffUser || !currentUsername) {
      renderStaffOnlyState();
      return;
    }

    ensureAddErrorContainer();
    renderOwnerServices();
    addServiceBtn?.addEventListener("click", handleAddService);
    serviceList?.addEventListener("click", handleServiceListClick);
    serviceList?.addEventListener("input", handleServiceListInput);
  }

  function resolveCurrentShopId() {
    const users = dataStore.getUsers();
    const fromUsers = users.find((user) => String(user?.username ?? "") === currentUsername);
    const direct = String(fromUsers?.shopId ?? "").trim();
    if (direct) return direct;
    const fallback = dataStore.getShopForUser(currentUsername);
    return String(fallback?.id ?? "");
  }

  function renderStaffOnlyState() {
    const main = document.querySelector("main.owner-layout") || document.querySelector("main");
    if (!main) return;
    main.innerHTML = `
      <section class="card owner-panel center-card section-stack">
        <div class="card-head">
          <h1>Staff only.</h1>
          <p class="small">Please log in as an owner or barber to manage services.</p>
        </div>
        <div class="cta-row">
          <a href="../index.html" class="btn btn-primary">Go to Home</a>
        </div>
      </section>
    `;
  }

  function getAllServices() {
    return dataStore.getServices().map(normalizeService);
  }

  function saveAllServices(services) {
    dataStore.saveServices(services.map(normalizeService));
  }

  function isScopedService(service) {
    const barberUsername = String(service?.barberUsername ?? service?.ownerUsername ?? "").trim();
    const shopId = String(service?.shopId ?? "").trim();
    if (barberUsername !== currentUsername) return false;
    if (!currentShopId) return true;
    return !shopId || shopId === currentShopId;
  }

  function loadServices() {
    return getAllServices().filter(isScopedService);
  }

  function handleAddService() {
    const payload = {
      name: String(serviceNameInput?.value ?? "").trim(),
      price: Number(servicePriceInput?.value ?? ""),
      durationMinutes: Number(serviceDurationInput?.value ?? ""),
    };

    const errors = validateServicePayload(payload);
    const duplicateName = loadServices().some(
      (service) => service.name.toLowerCase() === payload.name.toLowerCase()
    );
    if (duplicateName) errors.push("A service with that name already exists.");

    showAddFormErrors(errors);
    if (errors.length > 0) return;

    const services = getAllServices();
    services.push({
      id: makeId(),
      name: payload.name,
      title: payload.name,
      price: toPrice(payload.price),
      durationMinutes: toDuration(payload.durationMinutes),
      duration: toDuration(payload.durationMinutes),
      active: true,
      createdAtISO: new Date().toISOString(),
      shopId: currentShopId,
      barberUsername: currentUsername,
      ownerUsername: currentUsername,
    });

    saveAllServices(services);
    clearForm();
    renderOwnerServices();
    showToast?.(`Service added: ${payload.name}`, "success");
  }

  function handleDeleteService(serviceId) {
    if (!serviceId) return;
    const allServices = getAllServices();
    const service = allServices.find((item) => item.id === serviceId && isScopedService(item));
    if (!service) return;

    const confirmed = window.confirm(`Delete "${service.name}"?`);
    if (!confirmed) return;

    const remaining = allServices.filter((item) => item.id !== serviceId);
    saveAllServices(remaining);
    if (editingServiceId === serviceId) clearEditState();
    renderOwnerServices();
    showToast?.(`Service removed: ${service.name}`, "success");
  }

  function startEditing(serviceId) {
    const service = loadServices().find((item) => item.id === serviceId);
    if (!service) return;
    editingServiceId = serviceId;
    editDraft = {
      name: service.name,
      price: String(service.price),
      durationMinutes: String(service.durationMinutes),
    };
    editErrors = [];
    renderOwnerServices();
  }

  function saveEditing(serviceId) {
    if (!editDraft || !serviceId) return;
    const payload = {
      name: String(editDraft.name ?? "").trim(),
      price: Number(editDraft.price ?? ""),
      durationMinutes: Number(editDraft.durationMinutes ?? ""),
    };
    const errors = validateServicePayload(payload);
    const duplicateName = loadServices().some(
      (service) => service.id !== serviceId && service.name.toLowerCase() === payload.name.toLowerCase()
    );
    if (duplicateName) errors.push("A service with that name already exists.");

    if (errors.length > 0) {
      editErrors = errors;
      renderOwnerServices();
      return;
    }

    const services = getAllServices().map((service) => {
      if (service.id !== serviceId) return service;
      if (!isScopedService(service)) return service;
      return {
        ...service,
        name: payload.name,
        title: payload.name,
        price: toPrice(payload.price),
        durationMinutes: toDuration(payload.durationMinutes),
        duration: toDuration(payload.durationMinutes),
      };
    });

    saveAllServices(services);
    clearEditState();
    renderOwnerServices();
    showToast?.(`Service updated: ${payload.name}`, "success");
  }

  function clearEditState() {
    editingServiceId = "";
    editDraft = null;
    editErrors = [];
  }

  function handleServiceListClick(e) {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const action = String(target.getAttribute("data-action") ?? "");
    const serviceId = String(target.getAttribute("data-id") ?? "");
    if (!action) return;

    if (action === "edit") startEditing(serviceId);
    if (action === "delete") handleDeleteService(serviceId);
    if (action === "cancel-edit") {
      clearEditState();
      renderOwnerServices();
    }
    if (action === "save-edit") saveEditing(serviceId);
    if (action === "empty-add") serviceNameInput?.focus();
  }

  function handleServiceListInput(e) {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!editingServiceId || !editDraft) return;
    const field = String(target.getAttribute("data-field") ?? "");
    if (!field) return;
    editDraft[field] = target.value;
  }

  function renderOwnerServices() {
    if (!serviceList) return;

    const services = loadServices().sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );

    if (services.length === 0) {
      serviceList.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3 class="empty-state-title">No services yet</h3>
          <p class="empty-state-subtitle">Add your first service so customers can start booking.</p>
          <div class="empty-state-actions">
            <button class="btn btn-ghost empty-state-cta" data-action="empty-add" type="button">Add Service</button>
          </div>
        </section>
      `;
      return;
    }

    serviceList.innerHTML = services
      .map((service) => (service.id === editingServiceId ? renderEditCard(service) : renderServiceCard(service)))
      .join("");
  }

  function renderServiceCard(service) {
    return `
      <article class="card owner-service-card">
        <div class="card-head">
          <h3>${escapeHtml(service.name)}</h3>
          <p>$${formatPrice(service.price)} | ${escapeHtml(service.durationMinutes)} minutes</p>
        </div>
        <div class="owner-service-actions cta-row">
          <button class="btn btn-ghost" type="button" data-action="edit" data-id="${escapeHtml(service.id)}">Edit</button>
          <button class="btn btn-danger" type="button" data-action="delete" data-id="${escapeHtml(service.id)}">Delete</button>
        </div>
      </article>
    `;
  }

  function renderEditCard(service) {
    const editIdBase = `edit-${String(service.id ?? "").replace(/[^a-zA-Z0-9_-]/g, "") || "service"}`;
    return `
      <article class="card owner-service-card">
        <div class="card-head">
          <h3>Edit Service</h3>
          <p>Update the service name, price, or appointment length.</p>
        </div>

        <div class="form-stack">
          <div class="field">
            <label for="${editIdBase}-name">Name</label>
            <input id="${editIdBase}-name" type="text" data-field="name" value="${escapeHtml(editDraft?.name ?? service.name)}" />
          </div>

          <div class="field">
            <label for="${editIdBase}-price">Price</label>
            <input id="${editIdBase}-price" type="number" min="0.01" step="0.01" data-field="price" value="${escapeHtml(editDraft?.price ?? service.price)}" />
          </div>

          <div class="field">
            <label for="${editIdBase}-duration">Duration (minutes)</label>
            <input id="${editIdBase}-duration" type="number" min="10" max="240" step="1" data-field="durationMinutes" value="${escapeHtml(editDraft?.durationMinutes ?? service.durationMinutes)}" />
          </div>
        </div>

        <div class="service-form-error ${editErrors.length ? "" : "hidden"}" role="alert" aria-live="assertive" aria-atomic="true">${editErrors.map(escapeHtml).join("<br />")}</div>

        <div class="owner-service-actions cta-row">
          <button class="btn btn-primary" type="button" data-action="save-edit" data-id="${escapeHtml(service.id)}">Save</button>
          <button class="btn btn-ghost" type="button" data-action="cancel-edit">Cancel</button>
        </div>
      </article>
    `;
  }

  function ensureAddErrorContainer() {
    if (!addServiceBtn) return;
    if (document.getElementById("add-service-errors")) return;
    const el = document.createElement("div");
    el.id = "add-service-errors";
    el.className = "service-form-error hidden";
    el.setAttribute("role", "alert");
    el.setAttribute("aria-live", "assertive");
    el.setAttribute("aria-atomic", "true");
    addServiceBtn.insertAdjacentElement("beforebegin", el);
  }

  function showAddFormErrors(errors) {
    const el = document.getElementById("add-service-errors");
    if (!el) return;
    if (!errors.length) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    el.innerHTML = errors.map(escapeHtml).join("<br />");
    el.classList.remove("hidden");
  }

  function clearForm() {
    if (serviceNameInput) serviceNameInput.value = "";
    if (servicePriceInput) servicePriceInput.value = "";
    if (serviceDurationInput) serviceDurationInput.value = "";
    showAddFormErrors([]);
  }

  function validateServicePayload(payload) {
    const errors = [];
    const name = String(payload?.name ?? "").trim();
    const price = Number(payload?.price);
    const duration = Number(payload?.durationMinutes);

    if (name.length < 2) errors.push("Name is required and must be at least 2 characters.");
    if (!Number.isFinite(price) || price <= 0) errors.push("Price is required and must be greater than 0.");
    if (!Number.isInteger(duration) || duration < 10 || duration > 240) {
      errors.push("Duration is required and must be between 10 and 240 minutes.");
    }
    return errors;
  }

  function normalizeService(service) {
    const name = String(service?.name ?? service?.title ?? "").trim() || "Service";
    const id = String(service?.id ?? makeId());
    const durationMinutes = toDuration(service?.durationMinutes ?? service?.duration);
    return {
      ...service,
      id,
      name,
      title: name,
      price: toPrice(service?.price),
      durationMinutes,
      duration: durationMinutes,
      active: service?.active !== false,
      shopId: String(service?.shopId ?? currentShopId),
      barberUsername: String(service?.barberUsername ?? service?.ownerUsername ?? currentUsername),
      ownerUsername: String(service?.ownerUsername ?? service?.barberUsername ?? currentUsername),
    };
  }

  function formatPrice(value) {
    return Number(value || 0).toFixed(2);
  }

  function toPrice(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Number(number.toFixed(2));
  }

  function toDuration(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.round(number);
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
