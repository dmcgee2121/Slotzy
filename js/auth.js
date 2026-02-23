export function createAuthUi({
  modalPanel,
  showModal,
  hideModal,
  setUser,
  goToDashboard,
}) {
  const API_BASE = "http://localhost:3001";

  async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  }

  function openAuthModal() {
    modalPanel.innerHTML = `
      <h2 id="modal-title">Login</h2>
      <div class="modal-toggle">
        <button type="button" id="show-login" class="btn btn-ghost active">Login</button>
        <button type="button" id="show-register" class="btn btn-ghost">Register</button>
      </div>

      <form id="auth-form">
        <label>Username</label>
        <input type="text" id="auth-username" required />

        <label>Password</label>
        <input type="password" id="auth-password" required />

        <div id="role-wrap" style="display:none;">
          <label>Role</label>
          <select id="auth-role">
            <option value="customer">Customer</option>
            <option value="owner">Business Owner</option>
          </select>
          <p id="auth-role-debug" class="small" style="display:none;"></p>
        </div>

        <button type="submit" class="btn btn-primary" id="submit-btn">Continue</button>
        <button type="button" class="btn btn-ghost" id="close-modal">Close</button>
        <div id="authError" class="small" style="margin-top:8px;"></div>
      </form>
    `;

    showModal();

    const showLoginBtn = document.getElementById("show-login");
    const showRegisterBtn = document.getElementById("show-register");
    const roleWrap = document.getElementById("role-wrap");
    const roleSelect = document.getElementById("auth-role");
    const roleDebug = document.getElementById("auth-role-debug");
    const modalTitle = document.getElementById("modal-title");
    const authError = document.getElementById("authError");
    const submitBtn = document.getElementById("submit-btn");

    function setAuthError(message) {
      if (!authError) return;
      authError.textContent = String(message ?? "").trim();
    }

    function updateRoleDebug(isRegister) {
      if (!roleDebug) return;
      const selectedRole = String(roleSelect?.value ?? "customer");
      roleDebug.textContent = `Selected role: ${selectedRole}`;
      roleDebug.style.display = isRegister ? "block" : "none";
    }

    function setMode(mode) {
      const isRegister = mode === "register";
      modalTitle.textContent = isRegister ? "Register" : "Login";
      roleWrap.style.display = isRegister ? "block" : "none";
      showLoginBtn.classList.toggle("active", !isRegister);
      showRegisterBtn.classList.toggle("active", isRegister);
      setAuthError("");
      updateRoleDebug(isRegister);
    }

    showLoginBtn.addEventListener("click", () => setMode("login"));
    showRegisterBtn.addEventListener("click", () => setMode("register"));
    roleSelect?.addEventListener("change", () => {
      updateRoleDebug(showRegisterBtn.classList.contains("active"));
    });

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
        const data = isRegister
          ? await apiPost("/api/auth/register", { username, password, role })
          : await apiPost("/api/auth/login", { username, password });
        sessionStorage.setItem("Slotzy_token", data.token);
        setUser(data.user);
        hideModal();
        goToDashboard();
      } catch (error) {
        setAuthError(error?.message || "Unable to sign in right now.");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  return { openAuthModal };
}
