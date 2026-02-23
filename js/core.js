import { doLogout } from "./logout.js";

// js/core.js
export function $(sel, root = document) {
  return root.querySelector(sel);
}
export function $all(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

export const storage = {
  get(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

export function handleLogout() {
  doLogout("/index.html");
}

export function attachLogoutHandler(root = document) {
  const buttons = root.querySelectorAll(".logout-btn, #logoutBtn, #btn-logout");
  buttons.forEach((button) => {
    if (button.dataset.logoutBound === "true") return;
    button.addEventListener("click", handleLogout);
    button.dataset.logoutBound = "true";
  });
}
