/* legacy/kept for compatibility
   Deprecated dashboard script replaced by dedicated owner modules.
*/

// ---------- SERVICE DATA HANDLING ----------
function getServices() {
  return JSON.parse(localStorage.getItem("Slotzy_services") || "[]");
}

function saveServices(services) {
  localStorage.setItem("Slotzy_services", JSON.stringify(services));
}

let defaultSubmitHandler;

// ---------- SERVICE EDITOR ----------
function renderServiceEditor() {
  const container = document.getElementById("owner-services");

  container.innerHTML = `
    <h2>Manage Services</h2>

    <label for="category-filter">Filter by Category:</label>
    <select id="category-filter">
      <option value="">All</option>
      <option value="Barber">Barber</option>
      <option value="Tattoo">Tattoo</option>
      <option value="Nails">Nails</option>
    </select>

    <form id="service-form">
      <input type="text" id="service-title" placeholder="Service Title" required />
      <input type="text" id="service-category" placeholder="Category (e.g. Barber, Tattoo)" required />
      <input type="number" id="service-duration" placeholder="Duration (minutes)" required />
      <input type="number" id="service-price" placeholder="Price ($)" required />
      <textarea id="service-desc" placeholder="Description"></textarea>
      <input type="file" id="service-image" accept="image/*" />
      <div id="image-preview" class="preview-box"></div>
      <button type="submit" class="btn btn-primary">Add Service</button>
    </form>

    <div id="service-list" class="grid"></div>
  `;

  const form = document.getElementById("service-form");
  const imageInput = document.getElementById("service-image");
  const previewBox = document.getElementById("image-preview");

  // ✅ Image preview logic
  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) {
      previewBox.innerHTML = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      previewBox.innerHTML = `<img src="${e.target.result}" class="preview-thumb" alt="Preview" />`;
    };
    reader.readAsDataURL(file);
  });


  // ✅ Submit handler with image support
  defaultSubmitHandler = function(e) {
    e.preventDefault();

    const file = imageInput.files[0];
    const reader = new FileReader();

    reader.onload = function(event) {
      const newService = {
        id: "s" + Date.now(),
        title: document.getElementById("service-title").value.trim(),
        category: document.getElementById("service-category").value.trim(),
        duration: parseInt(document.getElementById("service-duration").value),
        price: parseFloat(document.getElementById("service-price").value),
        desc: document.getElementById("service-desc").value.trim(),
        image: event.target.result || ""
      };

      const services = getServices();
      services.push(newService);
      saveServices(services);
      form.reset();
      previewBox.innerHTML = "";
      renderServiceList();
    };

    if (file) {
      reader.readAsDataURL(file);
    } else {
      reader.onload({ target: { result: "" } });
    }
  };

  form.onsubmit = defaultSubmitHandler;

  document.getElementById("category-filter").addEventListener("change", renderServiceList);
  renderServiceList();
}

// ---------- SERVICE LIST ----------
function renderServiceList() {
  const list = document.getElementById("service-list");
  const filter = document.getElementById("category-filter")?.value || "";
  let services = getServices();

  if (filter) {
    services = services.filter(s => s.category === filter);
  }

  list.innerHTML = services.map(s => `
    <div class="card">
      ${s.image ? `<img src="${s.image}" alt="${s.title}" class="service-thumb" />` : ""}
      <h3>${s.title}</h3>
      <p><strong>Category:</strong> ${s.category}</p>
      <p><strong>Duration:</strong> ${s.duration} min</p>
      <p><strong>Price:</strong> $${s.price}</p>
      <p>${s.desc}</p>
      <div class="actions">
        <button onclick="editService('${s.id}')" class="btn btn-ghost">Edit</button>
        <button onclick="deleteService('${s.id}')" class="btn btn-danger">Delete</button>
      </div>
    </div>
  `).join("");
}

// ---------- DELETE ----------
function deleteService(id) {
  const services = getServices().filter(s => s.id !== id);
  saveServices(services);
  renderServiceList();
}

// ---------- EDIT ----------
function editService(id) {
  const service = getServices().find(s => s.id === id);
  if (!service) return;

  const modal = document.getElementById("edit-modal");
  const form = document.getElementById("edit-form");
  const preview = document.getElementById("edit-preview");
  const imageInput = document.getElementById("edit-image");

  // Fill form fields
  document.getElementById("edit-title").value = service.title;
  document.getElementById("edit-category").value = service.category;
  document.getElementById("edit-duration").value = service.duration;
  document.getElementById("edit-price").value = service.price;
  document.getElementById("edit-desc").value = service.desc;
  preview.innerHTML = service.image ? `<img src="${service.image}" class="preview-thumb" />` : "";

  modal.classList.remove("hidden");

  // Preview new image
  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) {
      preview.innerHTML = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      preview.innerHTML = `<img src="${e.target.result}" class="preview-thumb" />`;
    };
    reader.readAsDataURL(file);
  });

  // Save changes
  form.onsubmit = function(e) {
    e.preventDefault();

    const file = imageInput.files[0];
    const reader = new FileReader();

    reader.onload = function(event) {
      service.title = document.getElementById("edit-title").value.trim();
      service.category = document.getElementById("edit-category").value.trim();
      service.duration = parseInt(document.getElementById("edit-duration").value);
      service.price = parseFloat(document.getElementById("edit-price").value);
      service.desc = document.getElementById("edit-desc").value.trim();
      service.image = file ? event.target.result : service.image;

      const services = getServices().map(s => s.id === id ? service : s);
      saveServices(services);
      modal.classList.add("hidden");
      renderServiceList();
    };

    if (file) {
      reader.readAsDataURL(file);
    } else {
      reader.onload({ target: { result: service.image } });
    }
  };

  // Close modal
  document.getElementById("close-modal").onclick = () => {
    modal.classList.add("hidden");
  };
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", () => {
  const manageBtn = document.getElementById("btn-manage-services");
  if (manageBtn) {
    manageBtn.addEventListener("click", () => {
      const container = document.getElementById("owner-services");
      container.classList.remove("hidden");
      renderServiceEditor();
    });
  }
});
