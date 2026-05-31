import { test, expect } from "@playwright/test";
import * as path from "path";

const MOCK_MEETING = {
  id: "upload-meeting-id",
  title: "Uploaded Meeting",
  raw_transcript: "sample",
  summary: "Meeting processed from uploaded file.",
  created_at: Date.now(),
  action_items: [],
  key_decisions: [],
};

test.describe("Process transcript by file upload", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    if (baseURL?.includes("localhost")) {
      await page.route("**/api/process", async (route) => {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(MOCK_MEETING),
        });
      });
    }
    await page.goto("/");
  });

  test("uploads a .txt file and populates transcript textarea", async ({ page }) => {
    const filePath = path.join(__dirname, "../fixtures/sample.txt");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    await expect(page.locator("#transcript-content")).not.toBeEmpty({ timeout: 3000 });
  });

  test("processes uploaded transcript and shows digest report", async ({ page }) => {
    const filePath = path.join(__dirname, "../fixtures/sample.txt");
    await page.locator('input[type="file"]').setInputFiles(filePath);

    // File name auto-fills title; override to ensure it's set
    await page.locator("#title").fill("Uploaded Meeting");
    await page.getByRole("button", { name: /generate digest/i }).click();

    await expect(page.getByText("Meeting Digest Report")).toBeVisible({ timeout: 30_000 });
  });
});
