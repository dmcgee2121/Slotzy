import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const apiUrl = new URL("../src/index.js", import.meta.url);
const storeUrl = new URL("../../js/dataStore.js", import.meta.url);
const manageServicesUrl = new URL("../../js/manage-services.js", import.meta.url);

test("service removal deactivates only the selected service through the narrow writer", async () => {
  const [api, store, manageServices] = await Promise.all([
    readFile(apiUrl, "utf8"),
    readFile(storeUrl, "utf8"),
    readFile(manageServicesUrl, "utf8"),
  ]);

  assert.match(api, /const deactivated = \{[\s\S]*?active: false,[\s\S]*?\};[\s\S]*?await writeService\(deactivated, db\);/);
  assert.doesNotMatch(api, /app\.delete\("\/api\/services\/:serviceId"[\s\S]*?db\.services\.splice/);
  assert.match(store, /async function apiDeactivateService\(serviceId\)[\s\S]*?method: "DELETE"/);
  assert.match(store, /service\.active !== false/);
  assert.match(manageServices, /deactivateServiceAsync\(serviceId, \{ fallbackOnError: false \}\)/);
  assert.match(manageServices, /Historical appointments are preserved\./);
  assert.doesNotMatch(manageServices, /saveAllServices\(remaining\)/);
});
