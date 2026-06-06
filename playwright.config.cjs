const { defineConfig } = require("@playwright/test");

const PORT = Number(process.env.SMOKE_PORT || 5173);

module.exports = defineConfig({
  testDir: "./tests/smoke",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: 0,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    trace: "on-first-retry",
  },
  webServer: {
    command: `node ./scripts/serve.cjs ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
