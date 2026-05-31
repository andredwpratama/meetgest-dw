import { test, expect } from "@playwright/test";

test.describe("Error handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows error for transcript_too_short (under 200 chars)", async ({ page }) => {
    await page.locator("#title").fill("Short Test");
    await page.locator("#transcript-content").fill("This is too short.");
    // Button is disabled for short transcripts — verify the validation warning instead
    await expect(page.getByText(/more characters/i)).toBeVisible({ timeout: 3000 });
  });

  test("shows error for transcript_too_long via mocked 422 response", async ({ page, baseURL }) => {
    if (baseURL?.includes("localhost")) {
      await page.route("**/api/process", async (route) => {
        await route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({ error: "transcript_too_long", message: "Transcript is too long." }),
        });
      });
    }
    await page.locator("#title").fill("Long Test");
    await page.locator("#transcript-content").fill("x".repeat(250));
    await page.getByRole("button", { name: /generate digest/i }).click();
    await expect(page.getByText(/too long/i)).toBeVisible({ timeout: 10_000 });
  });

  test("New Meeting button clears form and URL", async ({ page }) => {
    await page.route("**/api/process", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "reset-test",
          title: "Reset Test",
          raw_transcript: "sample",
          summary: "Summary.",
          created_at: Date.now(),
          action_items: [],
          key_decisions: [],
        }),
      });
    });

    await page.locator("#title").fill("Reset Test");
    await page.locator("#transcript-content").fill("x".repeat(250));
    await page.getByRole("button", { name: /generate digest/i }).click();
    await page.getByText("Meeting Digest Report").waitFor({ timeout: 30_000 });

    await page.getByRole("button", { name: /new meeting/i }).click();

    await expect(page.locator("#title")).toBeEmpty();
    await expect(page.getByText("Meeting Digest Report")).not.toBeVisible();
    expect(page.url()).not.toContain("?id=");
  });
});
