const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const LOCAL_API_HOST = "127.0.0.1";
const LOCAL_API_PORT = "54321";

function value(env, name) {
  return String(env?.[name] ?? "");
}

export function parseSupabaseProjectReference(rawUrl, variableName) {
  let url;
  try {
    url = new URL(String(rawUrl ?? ""));
  } catch {
    throw new Error(`${variableName} must be an unambiguous Supabase project URL.`);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${variableName} must be an unambiguous Supabase project URL.`);
  }
  const match = url.hostname.toLowerCase().match(/^([a-z0-9]{20})\.supabase\.co$/);
  if (!match) throw new Error(`${variableName} must use https://<project-ref>.supabase.co.`);
  return match[1];
}

export function assertPostgresIntegrationPreflight(env = process.env) {
  if (value(env, "NODE_ENV") !== "test") {
    throw new Error('Postgres integration tests require NODE_ENV to equal exactly "test".');
  }
  if (value(env, "SLOTZY_ALLOW_DISPOSABLE_TEST_RESET") !== "true") {
    throw new Error('SLOTZY_ALLOW_DISPOSABLE_TEST_RESET must equal "true"; no reset was attempted.');
  }
  const testUrl = value(env, "SUPABASE_TEST_URL").trim();
  if (value(env, "SLOTZY_LOCAL_DISPOSABLE_POSTGRES") === "true") {
    let url;
    try {
      url = new URL(testUrl);
    } catch {
      throw new Error("SUPABASE_TEST_URL must be the pinned local Supabase API URL.");
    }
    if (url.protocol !== "http:" || url.hostname !== LOCAL_API_HOST || url.port !== LOCAL_API_PORT || url.pathname !== "/" || url.username || url.password || url.search || url.hash) {
      throw new Error(`Local Postgres integration tests require exactly http://${LOCAL_API_HOST}:${LOCAL_API_PORT}/.`);
    }
    if (value(env, "SLOTZY_EXPECTED_LOCAL_DATABASE").trim() !== "postgres") {
      throw new Error('SLOTZY_EXPECTED_LOCAL_DATABASE must equal exactly "postgres"; no reset was attempted.');
    }
    if (value(env, "SLOTZY_EXPECTED_LOCAL_POSTGRES_PORT").trim() !== "54322") {
      throw new Error('SLOTZY_EXPECTED_LOCAL_POSTGRES_PORT must equal exactly "54322"; no reset was attempted.');
    }
    const runtimeUrl = value(env, "SUPABASE_URL").trim();
    if (runtimeUrl && runtimeUrl === testUrl) {
      throw new Error("SUPABASE_TEST_URL must not reuse SUPABASE_URL, even for local testing.");
    }
    const runtimeServiceRoleKey = value(env, "SUPABASE_SERVICE_ROLE_KEY");
    const testServiceRoleKey = value(env, "SUPABASE_TEST_SERVICE_ROLE_KEY");
    if (runtimeServiceRoleKey && testServiceRoleKey && runtimeServiceRoleKey === testServiceRoleKey) {
      throw new Error("SUPABASE_TEST_SERVICE_ROLE_KEY must not reuse SUPABASE_SERVICE_ROLE_KEY.");
    }
    return { projectRef: "local-slotzy", local: true };
  }
  const expectedProjectRef = value(env, "SLOTZY_EXPECTED_DISPOSABLE_PROJECT_REF").trim().toLowerCase();
  if (!PROJECT_REF_PATTERN.test(expectedProjectRef)) {
    throw new Error("SLOTZY_EXPECTED_DISPOSABLE_PROJECT_REF must be a 20-character disposable Supabase project reference.");
  }
  const testProjectRef = parseSupabaseProjectReference(testUrl, "SUPABASE_TEST_URL");
  if (testProjectRef !== expectedProjectRef) {
    throw new Error("SUPABASE_TEST_URL does not match SLOTZY_EXPECTED_DISPOSABLE_PROJECT_REF.");
  }
  const runtimeUrl = value(env, "SUPABASE_URL").trim();
  if (runtimeUrl && parseSupabaseProjectReference(runtimeUrl, "SUPABASE_URL") === testProjectRef) {
    throw new Error("SUPABASE_TEST_URL targets the configured runtime Supabase project.");
  }
  const runtimeServiceRoleKey = value(env, "SUPABASE_SERVICE_ROLE_KEY");
  const testServiceRoleKey = value(env, "SUPABASE_TEST_SERVICE_ROLE_KEY");
  if (runtimeServiceRoleKey && testServiceRoleKey && runtimeServiceRoleKey === testServiceRoleKey) {
    throw new Error("SUPABASE_TEST_SERVICE_ROLE_KEY must not reuse SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { projectRef: testProjectRef };
}

export function createPostgresIntegrationResources({ env = process.env, createClient, createStore }) {
  const preflight = assertPostgresIntegrationPreflight(env);
  const testUrl = value(env, "SUPABASE_TEST_URL").trim();
  const testServiceRoleKey = value(env, "SUPABASE_TEST_SERVICE_ROLE_KEY").trim();
  return {
    ...preflight,
    client: createClient(testUrl, testServiceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }),
    store: createStore({ SUPABASE_URL: testUrl, SUPABASE_SERVICE_ROLE_KEY: testServiceRoleKey }),
  };
}
