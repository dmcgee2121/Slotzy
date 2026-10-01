const { defineConfig } = require("@playwright/test");

const PORT = Number(process.env.MOBILE_SMOKE_PORT || 5173);

module.exports = defineConfig({
  testDir: "./tests/mobile",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  projects: [
    { name: "iPhone-SE", use: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true } },
    { name: "iPhone-15", use: { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true } },
    { name: "Pixel-7", use: { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } },
    { name: "iPad-Mini", use: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
  ],
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
