const test = require("node:test");
const assert = require("node:assert/strict");
const { LOCAL_E2E, parseSupabaseStatusEnv, assertLocalSupabaseStatus, createBackendEnvironment, createFrontendEnvironment } = require("./local-e2e-config.cjs");

const valid = {
  API_URL: "http://127.0.0.1:54321",
  DB_URL: "postgresql://postgres:local@127.0.0.1:54322/postgres",
  SERVICE_ROLE_KEY: "local-only-key",
};

test("parses Supabase CLI env output", () => {
  const result = parseSupabaseStatusEnv('API_URL="http://127.0.0.1:54321"\r\nSERVICE_ROLE_KEY="local-only-key"');
  assert.equal(result.API_URL, valid.API_URL);
  assert.equal(result.SERVICE_ROLE_KEY, valid.SERVICE_ROLE_KEY);
});

test("accepts only the exact local Supabase identity", () => {
  assert.deepEqual(assertLocalSupabaseStatus(valid), { apiUrl: LOCAL_E2E.apiUrl, serviceRoleKey: valid.SERVICE_ROLE_KEY });
  assert.throws(() => assertLocalSupabaseStatus({ ...valid, API_URL: "https://slotzy-staging.example" }), /requires Supabase API/);
  assert.throws(() => assertLocalSupabaseStatus({ ...valid, DB_URL: "postgresql://postgres:local@localhost:54322/postgres" }), /requires PostgreSQL/);
  assert.throws(() => assertLocalSupabaseStatus({ ...valid, SERVICE_ROLE_KEY: "" }), /service-role key/);
});

test("backend environment pins Postgres and disables SMTP", () => {
  const environment = createBackendEnvironment({ apiUrl: LOCAL_E2E.apiUrl, serviceRoleKey: valid.SERVICE_ROLE_KEY });
  assert.equal(environment.SLOTZY_STORAGE, "postgres");
  assert.equal(environment.SUPABASE_URL, LOCAL_E2E.apiUrl);
  assert.equal(environment.SUPABASE_SERVICE_ROLE_KEY, valid.SERVICE_ROLE_KEY);
  assert.equal(environment.SLOTZY_BIND_HOST, "127.0.0.1");
  for (const name of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"]) assert.equal(environment[name], "");
  assert.equal(environment.SLOTZY_FORCE_DEV_OUTBOX, "true");
  assert.equal(environment.SLOTZY_APP_ORIGIN, LOCAL_E2E.frontendUrl);
});

test("frontend environment enables only the isolated served configuration", () => {
  const environment = createFrontendEnvironment();
  assert.equal(environment.SLOTZY_LOCAL_E2E, "1");
  assert.equal(environment.PORT, "5173");
  assert.equal(environment.SUPABASE_URL, undefined);
  assert.equal(environment.SMTP_HOST, undefined);
});
