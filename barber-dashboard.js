document.addEventListener("DOMContentLoaded", () => {
  // === Tab Switching ===
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");
  const savedTab = localStorage.getItem("activeTab") || "appointments";
  activateTab(savedTab);

  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-tab");
      localStorage.setItem("activeTab", target);
      activateTab(target);
    });
  });
    serviceList.appendChild(newItem);
  }

  function getSavedServices() {
    return JSON.parse(localStorage.getItem("barberServices")) || [];
  }
  function setSavedServices(services) {
    localStorage.setItem("barberServices", JSON.stringify(services));
  }

  getSavedServices().forEach(service => renderService(service));

  addButton.addEventListener("click", () => {
    const name = document.getElementById("service-name").value.trim();
    const description = document.getElementById("service-description").value.trim();
    const price = document.getElementById("service-price").value.trim();
    const duration = document.getElementById("service-duration").value.trim();

    if (!name || !price || !duration) {
      alert("Please fill in all required fields (name, price, duration).");
      return;
    }

    const savedServices = getSavedServices();
    const service = { name, description, price, duration };
    savedServices.push(service);
    setSavedServices(savedServices);
    renderService(service);

    document.getElementById("service-name").value = "";
    document.getElementById("service-description").value = "";
    document.getElementById("service-price").value = "";
    document.getElementById("service-duration").value = "";
  });

  serviceList.addEventListener("click", (e) => {
    const target = e.target;
    const item = target.closest("li");

    if (target.classList.contains("delete-btn")) {
      if (confirm("Are you sure you want to delete this service?")) {
        const name = item.querySelector("strong").textContent;
        const services = getSavedServices();
        const index = services.findIndex(s => s.name === name);
        if (index !== -1) {
          services.splice(index, 1);
          setSavedServices(services);
        }
        item.remove();
      }
    }

    if (target.classList.contains("edit-btn")) {
      const name = item.querySelector("strong").textContent;
      const description = item.querySelector("em")?.textContent || "";
      // Use a more robust regex to extract price (with decimals) and duration
      const details = item.innerHTML.match(/\$([\d.]+)\s*\/\s*(\d+)\s*mins/);

      document.getElementById("service-name").value = name;
      document.getElementById("service-description").value = description;
      document.getElementById("service-price").value = details?.[1] || "";
      document.getElementById("service-duration").value = details?.[2] || "";

      const services = getSavedServices();
      const index = services.findIndex(s => s.name === name);
      if (index !== -1) {
        services.splice(index, 1);
        setSavedServices(services);
      }

      item.remove();
    }
  });

  // === Availability Editor ===
  serviceList.addEventListener("click", (e) => {
    const target = e.target;
    const item = target.closest("li");

    if (target.classList.contains("delete-btn")) {
      if (confirm("Are you sure you want to delete this service?")) {
        const name = item.querySelector("strong").textContent;
        const services = getSavedServices();
        const index = services.findIndex(s => s.name === name);
        if (index !== -1) {
  // Removed duplicated serviceList event listener to prevent double handling of click events.
  saveAvailabilityBtn.addEventListener("click", () => {
    const slots = document.querySelectorAll(".time-slot.available");
    const availability = {};

    slots.forEach(slot => {
      const day = slot.dataset.day;
      const time = slot.dataset.time;
      if (!availability[day]) availability[day] = [];
      availability[day].push(time);
    });

    localStorage.setItem("barberAvailability", JSON.stringify(availability));
    alert("Availability saved!");
  });
function activateTab(tabName) {
  tabButtons.forEach(btn => {
    btn.classList.remove("active");
    if (btn.getAttribute("data-tab") === tabName) {
      btn.classList.add("active");
    }
  });

  tabContents.forEach(content => {
    content.style.display = "none";
    content.classList.remove("fade-in");
  });

  const activeTab = document.getElementById(tabName);
  if (activeTab) {
    activeTab.style.display = "block";
    activeTab.classList.add("fade-in");

    // Render calendar only when availability tab is activated
    if (tabName === "availability") {
      renderCalendar();
    }
  }
}
});
