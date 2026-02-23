import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "db.json");

const EMPTY_DB = { users: [] };

export async function readDb() {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...EMPTY_DB };
    if (!Array.isArray(parsed.users)) parsed.users = [];
    return parsed;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      await writeDb(EMPTY_DB);
      return { ...EMPTY_DB };
    }
    throw error;
  }
}

export async function writeDb(db) {
  const normalized = db && typeof db === "object" ? db : { ...EMPTY_DB };
  if (!Array.isArray(normalized.users)) normalized.users = [];
  await fs.writeFile(DB_PATH, JSON.stringify(normalized, null, 2), "utf-8");
}
