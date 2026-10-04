import * as jsonStore from "./jsonStore.js";
import { createPostgresStore } from "./postgresStore.js";

const requestedAdapter = String(process.env.SLOTZY_STORAGE ?? "json").trim().toLowerCase() || "json";

if (requestedAdapter !== "json" && requestedAdapter !== "postgres") {
  throw new Error(
    `Unsupported SLOTZY_STORAGE value "${requestedAdapter}". Supported values are "json" and "postgres".`
  );
}

// Future adapters must implement this same small persistence surface before they
// are selectable here. Keep route/business behavior independent of storage paths.
const activeStore = requestedAdapter === "postgres"
  ? createPostgresStore()
  : jsonStore;

export const STORAGE_ADAPTER = requestedAdapter;
export const readStore = activeStore.readStore;
export const writeStore = activeStore.writeStore;
export const writeShop = activeStore.writeShop;
export const appendOutboxEmail = activeStore.appendOutboxEmail;
export const listOutboxEmails = activeStore.listOutboxEmails;
export const clearOutboxEmails = activeStore.clearOutboxEmails;
export const storeManageToken = activeStore.storeManageToken;
