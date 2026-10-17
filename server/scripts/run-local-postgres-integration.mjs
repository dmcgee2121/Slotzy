import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const expected = {
  apiUrl: "http://127.0.0.1:54321",
  databaseHost: "127.0.0.1",
  databasePort: "54322",
  databaseName: "postgres",
};

const status = spawnSync("npx", ["--yes", "supabase", "status", "--output", "env"], {
  cwd: new URL("../..", import.meta.url), encoding: "utf8", shell: process.platform === "win32",
});
if (status.status !== 0) throw new Error(`Could not inspect local Supabase status; tests were not started.\n${status.stderr}`);

const values = Object.fromEntries(status.stdout.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) return [];
  const raw = match[2].trim();
  const value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
  return [[match[1], value]];
}));
const apiUrl = String(values.API_URL ?? "").replace(/\/$/, "");
const databaseUrl = new URL(String(values.DB_URL ?? ""));
assert.equal(apiUrl, expected.apiUrl, "Local API identity changed; tests were not started.");
assert.equal(databaseUrl.hostname, expected.databaseHost, "Local database host changed; tests were not started.");
assert.equal(databaseUrl.port, expected.databasePort, "Local database port changed; tests were not started.");
assert.equal(databaseUrl.pathname, `/${expected.databaseName}`, "Local database name changed; tests were not started.");
assert.ok(values.SERVICE_ROLE_KEY, "Local service-role key is unavailable; tests were not started.");

const test = spawnSync(process.execPath, ["--test", "test/postgres-integration-safety.test.js", "test/postgres-store.integration.test.js"], {
  cwd: new URL("..", import.meta.url), encoding: "utf8",
  env: {
    ...process.env,
    NODE_ENV: "test",
    SLOTZY_ALLOW_DISPOSABLE_TEST_RESET: "true",
    SLOTZY_LOCAL_DISPOSABLE_POSTGRES: "true",
    SLOTZY_EXPECTED_LOCAL_DATABASE: expected.databaseName,
    SLOTZY_EXPECTED_LOCAL_POSTGRES_PORT: expected.databasePort,
    SUPABASE_TEST_URL: `${apiUrl}/`,
    SUPABASE_TEST_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
    // Ensure running this local command cannot inherit hosted runtime credentials.
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
  },
});
process.stdout.write(test.stdout);
process.stderr.write(test.stderr);
process.exit(test.status ?? 1);
