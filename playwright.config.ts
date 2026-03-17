import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:1420",
    headless: true,
  },
  webServer: {
    command: "bun run dev",
    port: 1420,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
