import { defineConfig, devices } from "@playwright/test";

const live = process.env.LIVE_SITE_URL;
export default defineConfig({
  testDir: live ? "./tests/live" : "./tests/e2e",
  timeout: live ? 90000 : 30000,
  fullyParallel: !live,
  workers: process.env.CI ? 2 : 2,
  retries: 0,
  reporter: "list",
  use: { baseURL: live || "http://127.0.0.1:18731", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: live?.startsWith("https://") ? undefined : {
    command: "npm run dev -- --port 18731 --strictPort",
    url: "http://127.0.0.1:18731",
    reuseExistingServer: false,
    env: { VITE_JEV_API_ENDPOINT: process.env.LIVE_API_ENDPOINT || "http://127.0.0.1:8787/api/judge" },
  },
});
