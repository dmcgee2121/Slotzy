import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPostgresIntegrationPreflight, createPostgresIntegrationResources } from "./postgres-integration-safety.js";

const disposableRef = "abcdefghijklmnopqrst";
const runtimeRef = "zyxwvutsrqponmlkjihg";
const baseEnvironment = () => ({
  NODE_ENV: "test",
  SLOTZY_ALLOW_DISPOSABLE_TEST_RESET: "true",
  SLOTZY_EXPECTED_DISPOSABLE_PROJECT_REF: disposableRef,
  SUPABASE_TEST_URL: `https://${disposableRef}.supabase.co`,
  SUPABASE_TEST_SERVICE_ROLE_KEY: "test-service-role-key",
});

test("Postgres integration preflight requires NODE_ENV to equal exactly test", () => {
  for (const environment of [undefined, "development", "staging", "production", "TEST", " test "]) {
    const env = baseEnvironment();
    if (environment === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = environment;
    assert.throws(() => assertPostgresIntegrationPreflight(env), /NODE_ENV to equal exactly/i);
  }
});

test("Postgres integration preflight requires a matching independent disposable project identity", () => {
  const missing = baseEnvironment();
  delete missing.SLOTZY_EXPECTED_DISPOSABLE_PROJECT_REF;
  assert.throws(() => assertPostgresIntegrationPreflight(missing), /EXPECTED_DISPOSABLE_PROJECT_REF/i);

  const mismatch = baseEnvironment();
  mismatch.SLOTZY_EXPECTED_DISPOSABLE_PROJECT_REF = runtimeRef;
  assert.throws(() => assertPostgresIntegrationPreflight(mismatch), /does not match/i);

  assert.deepEqual(assertPostgresIntegrationPreflight(baseEnvironment()), { projectRef: disposableRef });
});

test("Postgres integration preflight rejects ambiguous and invalid Supabase test URLs", () => {
  for (const url of [
    "https://not-a-project.supabase.co",
    `https://${disposableRef}.supabase.co/rest/v1`,
    `https://${disposableRef}.supabase.co/?target=other`,
    `https://${disposableRef}.supabase.co.evil.test`,
  ]) {
    const env = baseEnvironment();
    env.SUPABASE_TEST_URL = url;
    assert.throws(() => assertPostgresIntegrationPreflight(env), /Supabase project URL|https:\/\/<project-ref>/i);
  }
});

test("Postgres integration preflight compares normalized runtime project identities and rejects reused credentials", () => {
  const sameProject = baseEnvironment();
  sameProject.SUPABASE_URL = `HTTPS://${disposableRef.toUpperCase()}.SUPABASE.CO/`;
  assert.throws(() => assertPostgresIntegrationPreflight(sameProject), /runtime Supabase project/i);

  const reusedCredential = baseEnvironment();
  reusedCredential.SUPABASE_URL = `https://${runtimeRef}.supabase.co`;
  reusedCredential.SUPABASE_SERVICE_ROLE_KEY = reusedCredential.SUPABASE_TEST_SERVICE_ROLE_KEY;
  assert.throws(() => assertPostgresIntegrationPreflight(reusedCredential), /must not reuse/i);
});

test("Postgres integration preflight refuses a missing reset confirmation before resource construction", () => {
  const env = baseEnvironment();
  delete env.SLOTZY_ALLOW_DISPOSABLE_TEST_RESET;
  let constructed = false;
  assert.throws(() => createPostgresIntegrationResources({
    env,
    createClient: () => { constructed = true; },
    createStore: () => { constructed = true; },
  }), /ALLOW_DISPOSABLE_TEST_RESET/i);
  assert.equal(constructed, false);
});

test("Postgres integration resources are constructed only after a safe matching preflight", () => {
  const result = createPostgresIntegrationResources({
    env: baseEnvironment(),
    createClient: (url, key) => ({ url, key }),
    createStore: (env) => ({ env }),
  });
  assert.equal(result.projectRef, disposableRef);
  assert.equal(result.client.url, `https://${disposableRef}.supabase.co`);
  assert.equal(result.store.env.SUPABASE_URL, `https://${disposableRef}.supabase.co`);
});
