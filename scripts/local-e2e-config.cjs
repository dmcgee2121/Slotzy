const LOCAL_E2E = Object.freeze({
  apiUrl: "http://127.0.0.1:54321",
  databaseHost: "127.0.0.1",
  databasePort: "54322",
  databaseName: "postgres",
  frontendUrl: "http://127.0.0.1:5173",
  apiBaseUrl: "http://127.0.0.1:3001/api",
});

function parseSupabaseStatusEnv(output) {
  return Object.fromEntries(String(output ?? "").split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) return [];
    const raw = match[2].trim();
    return [[match[1], raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw]];
  }));
}

function assertLocalSupabaseStatus(values) {
  const apiUrl = String(values?.API_URL ?? "").replace(/\/$/, "");
  if (apiUrl !== LOCAL_E2E.apiUrl) throw new Error(`Local E2E requires Supabase API ${LOCAL_E2E.apiUrl}; startup was not attempted.`);
  let databaseUrl;
  try { databaseUrl = new URL(String(values?.DB_URL ?? "")); } catch { throw new Error("Local E2E requires a valid local Supabase DB_URL; startup was not attempted."); }
  if (databaseUrl.protocol !== "postgresql:" || databaseUrl.hostname !== LOCAL_E2E.databaseHost || databaseUrl.port !== LOCAL_E2E.databasePort || databaseUrl.pathname !== `/${LOCAL_E2E.databaseName}`) {
    throw new Error(`Local E2E requires PostgreSQL ${LOCAL_E2E.databaseHost}:${LOCAL_E2E.databasePort}/${LOCAL_E2E.databaseName}; startup was not attempted.`);
  }
  const serviceRoleKey = String(values?.SERVICE_ROLE_KEY ?? "").trim();
  if (!serviceRoleKey) throw new Error("Local E2E requires the local Supabase CLI service-role key; startup was not attempted.");
  return { apiUrl, serviceRoleKey };
}

function createIsolatedEnvironment(overrides = {}) {
  // Do not copy process.env: inherited staging/production, SMTP, Supabase, and
  // proxy settings must never reach the local E2E children.
  const environment = {};
  for (const key of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "ComSpec", "TEMP", "TMP", "PATHEXT", "WINDIR", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA"]) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  return { ...environment, ...overrides };
}

function createBackendEnvironment({ apiUrl, serviceRoleKey }) {
  return createIsolatedEnvironment({
    NODE_ENV: "development", PORT: "3001", SLOTZY_BIND_HOST: "127.0.0.1", SLOTZY_STORAGE: "postgres",
    SUPABASE_URL: apiUrl, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    SMTP_HOST: "", SMTP_PORT: "", SMTP_USER: "", SMTP_PASS: "", SMTP_FROM: "", SLOTZY_FORCE_DEV_OUTBOX: "true",
    CORS_ALLOWED_ORIGINS: LOCAL_E2E.frontendUrl, SLOTZY_APP_ORIGIN: LOCAL_E2E.frontendUrl,
  });
}

function createFrontendEnvironment() {
  return createIsolatedEnvironment({ PORT: "5173", SLOTZY_LOCAL_E2E: "1" });
}

module.exports = { LOCAL_E2E, parseSupabaseStatusEnv, assertLocalSupabaseStatus, createIsolatedEnvironment, createBackendEnvironment, createFrontendEnvironment };
