import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
  projects: [{ name: "mobile-chromium", use: { browserName: "chromium" } }],
});
