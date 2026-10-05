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
  let addServiceInFlight = false;
  let servicesLoadState = "loading";

  init().catch((error) => console.error("[Slotzy:services] Could not initialize services.", error));

  async function init() {
    if (!isStaffUser || !currentUsername) {
      renderStaffOnlyState();
      return;
    }

    ensureAddErrorContainer();
    addServiceBtn?.addEventListener("click", handleAddService);
    serviceList?.addEventListener("click", handleServiceListClick);
    serviceList?.addEventListener("input", handleServiceListInput);

    await loadServicesForPage();
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
    return dataStore.saveServicesAsync(services.map(normalizeService), { fallbackOnError: false });
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

  async function handleAddService() {
    if (addServiceInFlight) return;
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

    setFormStatus("Saving service…", "saving");
    addServiceInFlight = true;
    setAddButtonPending(true);
    try {
      await dataStore.createServiceAsync({
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
      }, { fallbackOnError: false });
      clearForm();
      renderOwnerServices();
      setFormStatus(`Saved. ${payload.name} is now available for booking.`, "success");
      showToast?.(`Service added: ${payload.name}`, "success");
    } catch (error) {
      console.error("[Slotzy:services] Could not save service.", error);
      setFormStatus("We couldn’t save this service. Check the details and try again.", "error");
    } finally {
      addServiceInFlight = false;
      setAddButtonPending(false);
    }
  }

  async function handleDeleteService(serviceId) {
    if (!serviceId) return;
    const allServices = getAllServices();
    const service = allServices.find((item) => item.id === serviceId && isScopedService(item));
    if (!service) return;

    const confirmed = window.confirm(`Delete "${service.name}" from your public booking menu? Clients will no longer be able to select it. This cannot be undone.`);
    if (!confirmed) return;

    const remaining = allServices.filter((item) => item.id !== serviceId);
    try {
      await saveAllServices(remaining);
      if (editingServiceId === serviceId) clearEditState();
      renderOwnerServices();
      setFormStatus(`Saved. ${service.name} was removed from your booking menu.`, "success");
      showToast?.(`Service removed: ${service.name}`, "success");
    } catch (error) {
      console.error("[Slotzy:services] Could not remove service.", error);
      setFormStatus("We couldn’t remove this service. Please try again.", "error");
    }
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

  async function saveEditing(serviceId) {
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

    setFormStatus("Saving changes…", "saving");
    try {
      await saveAllServices(services);
      clearEditState();
      renderOwnerServices();
      setFormStatus(`Saved. ${payload.name} was updated.`, "success");
      showToast?.(`Service updated: ${payload.name}`, "success");
    } catch (error) {
      console.error("[Slotzy:services] Could not update service.", error);
      editErrors = ["We couldn’t save your changes. Please try again."];
      setFormStatus("We couldn’t save your changes. Please try again.", "error");
      renderOwnerServices();
    }
  }

  function clearEditState() {
    editingServiceId = "";
    editDraft = null;
    editErrors = [];
  }

  async function handleServiceListClick(e) {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const action = String(target.getAttribute("data-action") ?? "");
    const serviceId = String(target.getAttribute("data-id") ?? "");
    if (!action) return;

    if (action === "edit") startEditing(serviceId);
    if (action === "delete") await handleDeleteService(serviceId);
    if (action === "cancel-edit") {
      clearEditState();
      renderOwnerServices();
    }
    if (action === "save-edit") await saveEditing(serviceId);
    if (action === "empty-add") serviceNameInput?.focus();
    if (action === "retry-load") await loadServicesForPage();
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

    if (servicesLoadState === "loading") {
      serviceList.innerHTML = `
        <section class="empty-state" role="status" aria-live="polite">
          <span class="empty-state-icon" aria-hidden="true">…</span>
          <h3 class="empty-state-title">Loading services…</h3>
          <p class="empty-state-subtitle">Fetching your current client-facing menu.</p>
        </section>
      `;
      return;
    }

    if (servicesLoadState === "error") {
      serviceList.innerHTML = `
        <section class="empty-state" role="alert" aria-live="assertive">
          <span class="empty-state-icon" aria-hidden="true">!</span>
          <h3 class="empty-state-title">Could not load services</h3>
          <p class="empty-state-subtitle">Your menu was not changed. Check your connection and try again.</p>
          <div class="empty-state-actions"><button class="btn btn-ghost empty-state-cta" data-action="retry-load" type="button">Retry loading services</button></div>
        </section>
      `;
      return;
    }

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
    const statusLabel = service.active === false ? "Inactive" : "Active";
    const statusClass = service.active === false ? "badge-danger" : "badge-success";
    return `
      <article class="card owner-service-card">
        <div class="card-head">
          <h3>${escapeHtml(service.name)}</h3>
          <p class="owner-service-summary"><span><strong>Price</strong> $${formatPrice(service.price)}</span><span><strong>Length</strong> ${escapeHtml(service.durationMinutes)} minutes</span></p>
        </div>
        <span class="badge ${statusClass}" aria-label="Service status: ${statusLabel}">${statusLabel}</span>
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
            <label for="${editIdBase}-name">Service name</label>
            <input id="${editIdBase}-name" type="text" data-field="name" value="${escapeHtml(editDraft?.name ?? service.name)}" />
          </div>

          <div class="field">
            <label for="${editIdBase}-price">Price (USD)</label>
            <input id="${editIdBase}-price" type="number" min="0.01" step="0.01" inputmode="decimal" data-field="price" value="${escapeHtml(editDraft?.price ?? service.price)}" />
          </div>

          <div class="field">
            <label for="${editIdBase}-duration">Appointment length (minutes)</label>
            <input id="${editIdBase}-duration" type="number" min="10" max="240" step="1" inputmode="numeric" data-field="durationMinutes" value="${escapeHtml(editDraft?.durationMinutes ?? service.durationMinutes)}" />
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

  async function loadServicesForPage() {
    servicesLoadState = "loading";
    renderOwnerServices();
    try {
      // In server mode the persisted list is authoritative. Do not render an
      // empty state while this request is still pending.
      await dataStore.getServicesAsync({ fallbackOnError: false });
      servicesLoadState = "ready";
    } catch (error) {
      console.error("[Slotzy:services] Could not load services.", error);
      servicesLoadState = "error";
    }
    renderOwnerServices();
  }

  function setFormStatus(message, type) {
    const el = document.getElementById("serviceFormStatus");
    if (!el) return;
    el.textContent = message;
    el.className = `service-form-status service-form-status-${type}`;
  }

  function setAddButtonPending(pending) {
    if (!addServiceBtn) return;
    if (pending) {
      addServiceBtn.dataset.idleText = addServiceBtn.textContent || "Add Service";
      addServiceBtn.disabled = true;
      addServiceBtn.textContent = "Adding service…";
      return;
    }
    addServiceBtn.disabled = false;
    addServiceBtn.textContent = addServiceBtn.dataset.idleText || "Add Service";
    delete addServiceBtn.dataset.idleText;
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
