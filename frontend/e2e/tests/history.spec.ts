import { test, expect } from "@playwright/test";

const MOCK_MEETINGS_LIST = [
  { id: "hist-1", title: "Sprint Planning", summary: "Team planned sprint goals.", created_at: Date.now() - 86400000 },
  { id: "hist-2", title: "Client Brief", summary: "Reviewed client requirements.", created_at: Date.now() - 172800000 },
];

const MOCK_MEETING_DETAIL = {
  id: "hist-1",
  title: "Sprint Planning",
  raw_transcript: "sample transcript",
  summary: "Team planned sprint goals.",
  created_at: Date.now() - 86400000,
  action_items: [
    { id: "ai-1", meeting_id: "hist-1", task: "Set sprint goals", owner: "Team", deadline: null, position: 0 },
  ],
  key_decisions: [
    { id: "kd-1", meeting_id: "hist-1", text: "Use 2-week sprints.", position: 0 },
  ],
};

test.describe("History flow", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    if (baseURL?.includes("localhost")) {
      await page.route("**/api/meetings/hist-1", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_MEETING_DETAIL),
        });
      });
      await page.route("**/api/meetings", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_MEETINGS_LIST),
        });
      });
    }
    await page.goto("/");
  });

  test("opens history dialog and shows meeting list", async ({ page }) => {
    await page.getByRole("button", { name: /view history/i }).click();
    await expect(page.getByText("Meeting History")).toBeVisible();
    await expect(page.getByText("Sprint Planning")).toBeVisible();
    await expect(page.getByText("Client Brief")).toBeVisible();
  });

  test("loads meeting when clicking Open", async ({ page }) => {
    await page.getByRole("button", { name: /view history/i }).click();

    // Find the row for Sprint Planning and click its Open button
    const sprintRow = page.locator("li, tr, div").filter({ hasText: "Sprint Planning" }).first();
    await sprintRow.getByRole("button", { name: /open/i }).click();

    await expect(page.getByText("Meeting Digest Report")).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain("?id=hist-1");
  });
});
