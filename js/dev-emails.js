const API_BASE = "http://localhost:3001/api";

(function () {
  const listEl = document.getElementById("devEmailsList");
  const emptyEl = document.getElementById("devEmailsEmpty");
  const metaEl = document.getElementById("devEmailsMeta");
  const statusEl = document.getElementById("devEmailsStatus");
  const refreshBtn = document.getElementById("devEmailsRefreshBtn");
  const clearBtn = document.getElementById("devEmailsClearBtn");
  const showToast = window.showToast;

  document.addEventListener("DOMContentLoaded", initDevEmailsPage);

  function initDevEmailsPage() {
    refreshBtn?.addEventListener("click", () => {
      loadEmails();
    });
    clearBtn?.addEventListener("click", handleClearEmails);
    loadEmails();
  }

  async function loadEmails() {
    setStatus("");
    setButtonsDisabled(true);
    if (metaEl) metaEl.textContent = "Loading outbox...";

    try {
      const response = await fetch(`${API_BASE}/dev/emails`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error ?? "Could not load the dev outbox."));
      }

      const emails = Array.isArray(payload?.emails) ? payload.emails : [];
      renderEmails(emails);
      if (metaEl) {
        const mode = String(payload?.mode ?? "outbox").trim() || "outbox";
        metaEl.textContent = `${emails.length} email${emails.length === 1 ? "" : "s"} shown. Delivery mode: ${mode}.`;
      }
    } catch (error) {
      renderEmails([]);
      if (metaEl) metaEl.textContent = "API unavailable.";
      setStatus(error?.message || "Could not load the dev outbox.", false);
    } finally {
      setButtonsDisabled(false);
    }
  }

  async function handleClearEmails() {
    setStatus("");
    setButtonsDisabled(true);

    try {
      const response = await fetch(`${API_BASE}/dev/emails`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error ?? "Could not clear the dev outbox."));
      }

      renderEmails([]);
      const mode = String(payload?.mode ?? "outbox").trim() || "outbox";
      if (metaEl) metaEl.textContent = `0 emails shown. Delivery mode: ${mode}.`;
      setStatus("Dev outbox cleared.", true);
      showToast?.("Dev outbox cleared.", "success", 2000);
    } catch (error) {
      setStatus(error?.message || "Could not clear the dev outbox.", false);
    } finally {
      setButtonsDisabled(false);
    }
  }

  function renderEmails(emails) {
    if (!listEl || !emptyEl) return;
    listEl.innerHTML = "";

    const rows = Array.isArray(emails) ? emails : [];
    emptyEl.classList.toggle("hidden", rows.length > 0);
    if (rows.length === 0) return;

    rows.forEach((email) => {
      const article = document.createElement("article");
      article.className = "dev-email-card";

      const tags = Array.isArray(email?.tags) ? email.tags.filter(Boolean) : [];
      const timestamp = formatTimestamp(email?.createdAtISO);
      const htmlBody = String(email?.html ?? "").trim();
      const textBody = String(email?.text ?? "").trim();
      const meta = email?.meta && typeof email.meta === "object" && !Array.isArray(email.meta)
        ? email.meta
        : null;

      article.innerHTML = `
        <div class="dev-email-card-head">
          <div class="dev-email-card-copy">
            <h2>${escapeHtml(String(email?.subject ?? "Untitled email"))}</h2>
            <p class="small muted">${escapeHtml(timestamp)}</p>
          </div>
          <div class="dev-email-tag-list">
            ${tags.map((tag) => `<span class="badge badge-muted">${escapeHtml(String(tag))}</span>`).join("")}
          </div>
        </div>
        <div class="dev-email-meta-grid">
          <div class="dev-email-meta-item">
            <span class="small muted">To</span>
            <strong>${escapeHtml(String(email?.to ?? "Unknown"))}</strong>
          </div>
          <div class="dev-email-meta-item">
            <span class="small muted">Subject</span>
            <strong>${escapeHtml(String(email?.subject ?? "Untitled email"))}</strong>
          </div>
        </div>
        ${meta ? `
          <details class="dev-email-details">
            <summary>Meta</summary>
            <pre>${escapeHtml(JSON.stringify(meta, null, 2))}</pre>
          </details>
        ` : ""}
        ${textBody ? `
          <details class="dev-email-details">
            <summary>Text body</summary>
            <pre>${escapeHtml(textBody)}</pre>
          </details>
        ` : ""}
        ${htmlBody ? `
          <details class="dev-email-details">
            <summary>HTML body</summary>
            <div class="dev-email-html-preview">${htmlBody}</div>
          </details>
        ` : ""}
      `;

      listEl.appendChild(article);
    });
  }

  function setButtonsDisabled(disabled) {
    const nextValue = Boolean(disabled);
    if (refreshBtn) refreshBtn.disabled = nextValue;
    if (clearBtn) clearBtn.disabled = nextValue;
  }

  function setStatus(message, success = false) {
    if (!statusEl) return;
    const text = String(message ?? "").trim();
    statusEl.textContent = text;
    statusEl.classList.remove("status-success", "status-error");
    if (!text) return;
    statusEl.classList.add(success ? "status-success" : "status-error");
  }

  function formatTimestamp(value) {
    const date = new Date(String(value ?? ""));
    if (!Number.isFinite(date.getTime())) return "Unknown time";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
