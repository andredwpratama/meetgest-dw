import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "dev",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.BASE_URL ?? "http://localhost:5173",
      },
    },
    {
      name: "prod",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.PROD_URL ?? "",
      },
    },
  ],
});
