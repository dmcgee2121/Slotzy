const { defineConfig } = require("@playwright/test");

// This config deliberately has no webServer: it targets only the explicit,
// guarded hosted URLs supplied to the staging test process.
module.exports = defineConfig({
  testDir: "./tests/staging",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  retries: 0,
  workers: 1,
  use: { headless: true, trace: "on-first-retry" },
});
