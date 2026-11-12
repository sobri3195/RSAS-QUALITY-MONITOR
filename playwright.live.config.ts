import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
// Explicit staging-only opt-in. No local demo or mocked HTTP is used by this suite.
export default defineConfig({
  testDir: "./live-tests",
  outputDir: "live-test-results",
  workers: 1,
  timeout: 90000,
  reporter: "list",
  use: {
    baseURL: process.env.RSAS_LIVE_URL,
    trace: "off",
    video: "off",
    screenshot: "off",
    headless: true,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
  },
});
