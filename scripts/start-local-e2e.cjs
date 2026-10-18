const { spawn, spawnSync } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const { LOCAL_E2E, parseSupabaseStatusEnv, assertLocalSupabaseStatus, createBackendEnvironment, createFrontendEnvironment } = require("./local-e2e-config.cjs");

const root = path.resolve(__dirname, "..");
const serverRoot = path.join(root, "server");
let stopping = false;
const children = [];

function stopChildren() { if (!stopping) { stopping = true; children.forEach((child) => child.kill()); } }
function request(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 5_000 }, (res) => { let body = ""; res.setEncoding("utf8"); res.on("data", (chunk) => { body += chunk; }); res.on("end", () => resolve({ status: res.statusCode, body })); });
    req.on("timeout", () => req.destroy(new Error("request timed out")));
    req.on("error", reject);
  });
}
async function waitFor(url, verify) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { const response = await request(url); if (verify(response)) return; lastError = new Error(`unexpected response from ${url}`); } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error(`could not reach ${url}`);
}
async function main() {
  // `npx` is a Windows command shim, so use the same Windows invocation form
  // as the existing local Postgres runner. Arguments are constant here.
  const status = spawnSync("npx", ["--yes", "supabase", "status", "--output", "env"], { cwd: root, encoding: "utf8", shell: process.platform === "win32", env: createFrontendEnvironment() });
  if (status.status !== 0) throw new Error("Could not inspect local Supabase CLI status; startup was not attempted.");
  const { apiUrl, serviceRoleKey } = assertLocalSupabaseStatus(parseSupabaseStatusEnv(status.stdout));
  const backend = spawn(process.execPath, ["src/index.js"], { cwd: serverRoot, env: createBackendEnvironment({ apiUrl, serviceRoleKey }), stdio: "inherit" });
  const frontend = spawn(process.execPath, ["scripts/serve.cjs"], { cwd: root, env: createFrontendEnvironment(), stdio: "inherit" });
  children.push(backend, frontend);
  children.forEach((child) => child.on("exit", (code) => { if (!stopping && code !== 0) { console.error(`[Slotzy local E2E] child exited unexpectedly (${code ?? "signal"}).`); stopChildren(); process.exitCode = 1; } }));
  await waitFor(`${LOCAL_E2E.apiBaseUrl}/health`, (response) => { try { const health = JSON.parse(response.body); return response.status === 200 && health.ok === true && health.storage === "postgres" && health.environment === "development"; } catch { return false; } });
  await waitFor(`${LOCAL_E2E.frontendUrl}/js/public-config.js`, (response) => response.status === 200 && response.body.includes(LOCAL_E2E.apiBaseUrl) && !response.body.includes("staging"));
  console.log("[Slotzy local E2E] Ready: frontend and API are loopback-only; Postgres and Dev Outbox isolation are active.");
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { stopChildren(); process.exit(0); });
main().catch((error) => { console.error(`[Slotzy local E2E] ${error.message}`); stopChildren(); process.exitCode = 1; });
