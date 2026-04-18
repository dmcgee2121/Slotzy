let toastTimer = null;

function getToastNode() {
  let toast = document.getElementById("toast");
  if (toast) return toast;

  toast = document.createElement("div");
  toast.id = "toast";
  toast.className = "toast hidden";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.setAttribute("aria-atomic", "true");
  document.body.appendChild(toast);
  return toast;
}

export function showToast(message, options = {}) {
  const safeMessage = String(message ?? "").trim();
  if (!safeMessage) return;

  const {
    type = "success",
    duration = 2500,
  } = options && typeof options === "object" ? options : {};

  const toast = getToastNode();
  const timeoutMs = Number.isFinite(duration) ? Math.max(0, duration) : 2500;

  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  toast.textContent = safeMessage;
  toast.classList.remove("hidden", "toast-success", "toast-error", "toast-info");

  if (type === "error") {
    toast.classList.add("toast-error");
  } else if (type === "info") {
    toast.classList.add("toast-info");
  } else {
    toast.classList.add("toast-success");
  }

  toastTimer = window.setTimeout(() => {
    toast.classList.add("hidden");
    toast.classList.remove("toast-success", "toast-error", "toast-info");
    toastTimer = null;
  }, timeoutMs);
}

