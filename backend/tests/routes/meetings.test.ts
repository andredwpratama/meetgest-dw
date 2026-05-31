import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import app from "../../src/index";
import { newId, insertMeetingWithChildren } from "../../src/lib/db";
import { VALID_LLM_OUTPUT } from "../fixtures/llm-responses";
import { SAMPLE_TRANSCRIPT } from "../fixtures/transcript";

async function seedMeeting(title = "Test Meeting") {
  return insertMeetingWithChildren(env, {
    id: newId(),
    title,
    raw_transcript: SAMPLE_TRANSCRIPT,
    llm: VALID_LLM_OUTPUT,
  });
}

describe("GET /api/meetings", () => {
  it("returns empty array when no meetings exist", async () => {
    const res = await app.request("/api/meetings", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns list after inserting a meeting", async () => {
    await seedMeeting("My Meeting");
    const res = await app.request("/api/meetings", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { title: string }[];
    expect(body.length).toBe(1);
    expect(body[0].title).toBe("My Meeting");
  });
});

describe("GET /api/meetings/:id", () => {
  it("returns full meeting with action items and decisions", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(`/api/meetings/${meeting.id}`, {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBe(meeting.id);
    expect(Array.isArray(body.action_items)).toBe(true);
    expect(Array.isArray(body.key_decisions)).toBe(true);
  });

  it("returns 404 for unknown id", async () => {
    const res = await app.request("/api/meetings/does-not-exist", {}, env);
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("not_found");
  });
});

describe("PATCH /api/meetings/:id", () => {
  it("updates title only", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated Title" }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { title: string };
    expect(body.title).toBe("Updated Title");
  });

  it("updates summary only", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: "New summary text." }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { summary: string };
    expect(body.summary).toBe("New summary text.");
  });

  it("updates both title and summary", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "T2", summary: "S2" }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { title: string; summary: string };
    expect(body.title).toBe("T2");
    expect(body.summary).toBe("S2");
  });

  it("returns 400 with empty body", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("no_changes");
  });

  it("returns 404 for unknown id", async () => {
    const res = await app.request(
      "/api/meetings/does-not-exist",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "x" }),
      },
      env,
    );
    expect(res.status).toBe(404);
  });
});
