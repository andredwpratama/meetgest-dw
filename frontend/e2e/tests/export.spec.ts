import { test, expect } from "@playwright/test";

const MOCK_MEETING = {
  id: "export-test-id",
  title: "Export Test Meeting",
  raw_transcript: "sample",
  summary: "Summary for export testing purposes.",
  created_at: Date.now(),
  action_items: [
    { id: "ai-1", meeting_id: "export-test-id", task: "Follow up with client", owner: "Alice", deadline: "Monday", position: 0 },
  ],
  key_decisions: [
    { id: "kd-1", meeting_id: "export-test-id", text: "Approved Q4 budget.", position: 0 },
  ],
};

const FILLER = "x".repeat(250);

test.describe("Export flows", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    if (baseURL?.includes("localhost")) {
      await page.route("**/api/process", async (route) => {
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(MOCK_MEETING) });
      });
    }
    await page.goto("/");
    await page.locator("#title").fill("Export Test Meeting");
    await page.locator("#transcript-content").fill(FILLER);
    await page.getByRole("button", { name: /generate digest/i }).click();
    await page.getByText("Meeting Digest Report").waitFor({ timeout: 30_000 });
  });

  test("downloads Markdown file", async ({ page }) => {
    await page.getByRole("button", { name: /export digest/i }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByText("Markdown File").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.md$/);
  });

  test("downloads PDF file", async ({ page }) => {
    await page.getByRole("button", { name: /export digest/i }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByText("PDF Document").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test("copies markdown when clicking Google Docs", async ({ page }) => {
    await page.getByRole("button", { name: /export digest/i }).click();
    await page.getByText("Google Docs").click();
    await expect(page.getByText("Copied!")).toBeVisible({ timeout: 3000 });
  });
});
