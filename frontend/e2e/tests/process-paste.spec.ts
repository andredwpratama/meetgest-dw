import { test, expect } from "@playwright/test";

const MOCK_MEETING = {
  id: "test-meeting-id",
  title: "Q3 Review",
  raw_transcript: "sample",
  summary: "The team reviewed Q3 performance and made decisions about Meta and Google Ads.",
  created_at: Date.now(),
  action_items: [
    { id: "ai-1", meeting_id: "test-meeting-id", task: "Update Meta creatives", owner: "Sarah", deadline: "Friday", position: 0 },
  ],
  key_decisions: [
    { id: "kd-1", meeting_id: "test-meeting-id", text: "Pause Google Ads until creatives approved.", position: 0 },
  ],
};

const SAMPLE_TRANSCRIPT = `John: Good morning everyone. Let us review Q3.
Sarah: Meta ads are performing well. CTR up 18 percent.
John: Great. We need to update creatives before Friday. Sarah owns this.
Sarah: I will have new creatives by Thursday EOD.
John: We decided to pause Google Ads until new creatives are approved.
Mike: I will coordinate with design on Google assets next week.
John: Monthly report due to client by Monday. Sarah handles it.
Sarah: Understood. Will deliver by Monday morning.`;

test.describe("Process transcript by pasting", () => {
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

  test("shows empty form on load", async ({ page }) => {
    await expect(page.locator("#title")).toBeEmpty();
    await expect(page.locator("#transcript-content")).toBeEmpty();
  });

  test("processes transcript and shows digest report", async ({ page }) => {
    await page.locator("#title").fill("Q3 Review");
    await page.locator("#transcript-content").fill(SAMPLE_TRANSCRIPT);
    await page.getByRole("button", { name: /generate digest/i }).click();

    await expect(page.getByText("Meeting Digest Report")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/action items/i)).toBeVisible();
    await expect(page.getByText(/key decisions/i)).toBeVisible();
  });

  test("URL updates to include meeting id after processing", async ({ page }) => {
    await page.locator("#title").fill("Q3 Review");
    await page.locator("#transcript-content").fill(SAMPLE_TRANSCRIPT);
    await page.getByRole("button", { name: /generate digest/i }).click();
    await page.waitForURL(/\?id=/, { timeout: 30_000 });
    expect(page.url()).toContain("?id=");
  });
});
