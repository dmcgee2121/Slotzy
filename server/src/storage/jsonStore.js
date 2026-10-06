import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, "..", "db.json");

const EMPTY_STORE = {
  users: [],
  shops: [],
  services: [],
  availability: {},
  bookings: [],
  emails: [],
};

export function createEmptyStore() {
  return {
    users: [],
    shops: [],
    services: [],
    availability: {},
    bookings: [],
    emails: [],
  };
}

export function normalizeStoreShape(store) {
  const next = store && typeof store === "object" && !Array.isArray(store)
    ? store
    : createEmptyStore();

  if (!Array.isArray(next.users)) next.users = [];
  if (!Array.isArray(next.shops)) next.shops = [];
  if (!Array.isArray(next.services)) next.services = [];
  if (!Array.isArray(next.bookings)) next.bookings = [];
  if (!Array.isArray(next.emails)) next.emails = [];
  if (!next.availability || typeof next.availability !== "object" || Array.isArray(next.availability)) {
    next.availability = {};
  }

  return next;
}

export function createJsonStore({ filePath = DB_PATH } = {}) {
  async function writeStore(store) {
    const normalized = normalizeStoreShape(store);
    await fs.writeFile(filePath, JSON.stringify(normalized, null, 2), "utf-8");
  }

  async function readStore() {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return normalizeStoreShape(JSON.parse(raw));
    } catch (error) {
      if (error && error.code === "ENOENT") {
        await writeStore(EMPTY_STORE);
        return createEmptyStore();
      }
      throw error;
    }
  }

  async function appendOutboxEmail(email) {
    const store = await readStore();
    store.emails.push(email);
    await writeStore(store);
    return email;
  }

  async function listOutboxEmails(limit = 50) {
    const store = await readStore();
    const safeLimit = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 50;
    return [...store.emails]
      .sort((left, right) => String(right?.createdAtISO ?? "").localeCompare(String(left?.createdAtISO ?? "")))
      .slice(0, safeLimit);
  }

  async function clearOutboxEmails() {
    const store = await readStore();
    const cleared = Array.isArray(store.emails) ? store.emails.length : 0;
    store.emails = [];
    await writeStore(store);
    return { cleared };
  }

  async function writeShop(_shop, store) {
    await writeStore(store);
  }

  async function writeService(_service, store) {
    await writeStore(store);
  }

  return {
    readStore,
    writeStore,
    writeShop,
    writeService,
    appendOutboxEmail,
    listOutboxEmails,
    clearOutboxEmails,
    async storeManageToken() {},
  };
}

const defaultJsonStore = createJsonStore();

export const readStore = defaultJsonStore.readStore;
export const writeStore = defaultJsonStore.writeStore;
export const writeShop = defaultJsonStore.writeShop;
export const writeService = defaultJsonStore.writeService;
export const appendOutboxEmail = defaultJsonStore.appendOutboxEmail;
export const listOutboxEmails = defaultJsonStore.listOutboxEmails;
export const clearOutboxEmails = defaultJsonStore.clearOutboxEmails;
export const storeManageToken = defaultJsonStore.storeManageToken;
