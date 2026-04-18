import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "db.json");

const EMPTY_DB = {
  users: [],
  shops: [],
  services: [],
  availability: {},
  bookings: [],
  emails: [],
};

function createEmptyDb() {
  return {
    users: [],
    shops: [],
    services: [],
    availability: {},
    bookings: [],
    emails: [],
  };
}

function normalizeDbShape(db) {
  const next = db && typeof db === "object" && !Array.isArray(db)
    ? db
    : createEmptyDb();

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

export async function readDb() {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return normalizeDbShape(parsed);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      await writeDb(EMPTY_DB);
      return createEmptyDb();
    }
    throw error;
  }
}

export async function writeDb(db) {
  const normalized = normalizeDbShape(db);
  await fs.writeFile(DB_PATH, JSON.stringify(normalized, null, 2), "utf-8");
}
