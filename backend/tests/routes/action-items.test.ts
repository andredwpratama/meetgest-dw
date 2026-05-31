import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import app from "../../src/index";
import { newId, insertMeetingWithChildren } from "../../src/lib/db";
import { VALID_LLM_OUTPUT } from "../fixtures/llm-responses";
import { SAMPLE_TRANSCRIPT } from "../fixtures/transcript";

async function seedMeeting() {
  return insertMeetingWithChildren(env, {
    id: newId(),
    title: "Test",
    raw_transcript: SAMPLE_TRANSCRIPT,
    llm: VALID_LLM_OUTPUT,
  });
}

describe("POST /api/meetings/:meetingId/action-items", () => {
  it("adds an action item to an existing meeting", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}/action-items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "New task", owner: "Alice", deadline: "Friday" }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { task: string; owner: string };
    expect(body.task).toBe("New task");
    expect(body.owner).toBe("Alice");
  });

  it("returns 404 when meeting does not exist", async () => {
    const res = await app.request(
      "/api/meetings/no-such-meeting/action-items",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "Task" }),
      },
      env,
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when task is missing", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}/action-items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: "Bob" }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/action-items/:id", () => {
  it("updates task field", async () => {
    const meeting = await seedMeeting();
    const item = meeting.action_items[0];
    const res = await app.request(
      `/api/action-items/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "Updated task" }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { task: string };
    expect(body.task).toBe("Updated task");
  });

  it("sets owner to null", async () => {
    const meeting = await seedMeeting();
    const item = meeting.action_items[0];
    const res = await app.request(
      `/api/action-items/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: null }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { owner: null };
    expect(body.owner).toBeNull();
  });

  it("updates position", async () => {
    const meeting = await seedMeeting();
    const item = meeting.action_items[0];
    const res = await app.request(
      `/api/action-items/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: 99 }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { position: number };
    expect(body.position).toBe(99);
  });

  it("returns 404 for unknown id", async () => {
    const res = await app.request(
      "/api/action-items/no-such-id",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "x" }),
      },
      env,
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/action-items/:id", () => {
  it("deletes an action item and returns 204", async () => {
    const meeting = await seedMeeting();
    const item = meeting.action_items[0];
    const res = await app.request(
      `/api/action-items/${item.id}`,
      { method: "DELETE" },
      env,
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 when deleting non-existent item", async () => {
    const res = await app.request(
      "/api/action-items/no-such-id",
      { method: "DELETE" },
      env,
    );
    expect(res.status).toBe(404);
  });
});
