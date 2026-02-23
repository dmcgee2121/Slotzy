import * as dataStore from "./dataStore.js";

(function () {
  const barberNameInput = document.getElementById("barberName");
  const addBarberBtn = document.getElementById("addBarberBtn");
  const barberStatus = document.getElementById("barberStatus");
  const barberList = document.getElementById("barberList");
  const mainContainer = document.querySelector("main");

  init();

  function init() {
    if (!isOwnerUser()) {
      renderOwnersOnlyState();
      return;
    }

    renderBarbers();
    addBarberBtn?.addEventListener("click", handleAddBarber);
    barberNameInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAddBarber();
      }
    });
  }

  function isOwnerUser() {
    const parsedUser = dataStore.getSessionUser();
    console.log("[manage-barbers] parsed user:", parsedUser);
    return Boolean(parsedUser && parsedUser.role === "owner");
  }

  function renderOwnersOnlyState() {
    if (!mainContainer) return;
    mainContainer.innerHTML = `
      <section class="card owner-panel" style="max-width: 560px; margin: 2rem auto; text-align: center;">
        <h1>Owners only. Please log in as a business owner.</h1>
        <p class="small">This page is restricted to business owner accounts.</p>
        <a href="../index.html" class="btn btn-primary">Go to Home</a>
      </section>
    `;
  }

  function loadStaff() {
    const parsed = dataStore.getStaff();
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: String(item.id ?? ""),
        name: String(item.name ?? "").trim(),
        active: item.active !== false,
        createdAt: String(item.createdAt ?? ""),
      }))
      .filter((item) => item.id && item.name);
  }

  function saveStaff(list) {
    dataStore.saveStaff(list);
  }

  function makeId() {
    return `b_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }

  function handleAddBarber() {
    const name = String(barberNameInput?.value ?? "").trim();
    if (!name) {
      setStatus("Please enter a barber name.", false);
      return;
    }

    const staff = loadStaff();
    const exists = staff.some((barber) => String(barber.name ?? "").toLowerCase() === name.toLowerCase());
    if (exists) {
      setStatus("That barber name already exists.", false);
      return;
    }

    staff.push({
      id: makeId(),
      name,
      active: true,
      createdAt: new Date().toISOString(),
    });
    saveStaff(staff);

    if (barberNameInput) barberNameInput.value = "";
    setStatus("Barber added successfully.", true);
    renderBarbers();
  }

  function handleDeactivateBarber(barberId) {
    const staff = loadStaff().map((barber) => {
      if (String(barber.id) !== String(barberId)) return barber;
      return { ...barber, active: false };
    });
    saveStaff(staff);
    setStatus("Barber deactivated.", true);
    renderBarbers();
  }

  function handleActivateBarber(barberId) {
    const staff = loadStaff().map((barber) => {
      if (String(barber.id) !== String(barberId)) return barber;
      return { ...barber, active: true };
    });
    saveStaff(staff);
    setStatus("Barber activated.", true);
    renderBarbers();
  }

  function handleDeleteBarber(barberId) {
    const staff = loadStaff().filter((barber) => String(barber.id) !== String(barberId));
    saveStaff(staff);
    setStatus("Barber deleted.", true);
    renderBarbers();
  }

  function renderBarbers() {
    if (!barberList) return;
    const staff = loadStaff();

    if (staff.length === 0) {
      barberList.innerHTML = '<p class="small">No barbers added yet.</p>';
      return;
    }

    barberList.innerHTML = staff.map((barber) => {
      const id = String(barber.id ?? "");
      const name = escapeHtml(String(barber.name ?? "Barber"));
      const isActive = barber.active !== false;
      const statusText = isActive ? "Active" : "Inactive";
      const statusActionButton = isActive
        ? `<button type="button" class="btn btn-ghost" data-action="deactivate" data-id="${escapeHtml(id)}">Deactivate</button>`
        : `<button type="button" class="btn btn-primary" data-action="activate" data-id="${escapeHtml(id)}">Activate</button>`;

      return `
        <article class="card">
          <h3>${name}</h3>
          <p class="small"><strong>Status:</strong> ${statusText}</p>
          <div class="actions">
            ${statusActionButton}
            <button type="button" class="btn btn-danger" data-action="delete" data-id="${escapeHtml(id)}">Delete</button>
          </div>
        </article>
      `;
    }).join("");

    barberList.querySelectorAll("button[data-action='deactivate']").forEach((button) => {
      button.addEventListener("click", () => handleDeactivateBarber(button.dataset.id));
    });
    barberList.querySelectorAll("button[data-action='activate']").forEach((button) => {
      button.addEventListener("click", () => handleActivateBarber(button.dataset.id));
    });
    barberList.querySelectorAll("button[data-action='delete']").forEach((button) => {
      button.addEventListener("click", () => handleDeleteBarber(button.dataset.id));
    });
  }

  function setStatus(message, isSuccess) {
    if (!barberStatus) return;
    barberStatus.textContent = message;
    barberStatus.style.color = isSuccess ? "#166534" : "#b91c1c";
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
