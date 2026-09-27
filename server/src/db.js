// Compatibility shim for any legacy local tool that still imports db.js.
// New backend code imports the canonical storage entry point instead.
export { readStore as readDb, writeStore as writeDb } from "./storage/index.js";
