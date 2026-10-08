import { defineConfig } from "@playwright/test";

const port = Number(process.env.PWA_TEST_PORT || 8752);
const baseURL = `http://127.0.0.1:${port}/substance-recovery/`;

export default defineConfig({
  testDir: "./artifacts/anchor/browser-tests",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    viewport: { width: 390, height: 844 },
    locale: "nl-NL",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command: "node scripts/serve-pwa.mjs",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
