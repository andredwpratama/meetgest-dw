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

describe("POST /api/meetings/:meetingId/key-decisions", () => {
  it("adds a key decision to an existing meeting", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}/key-decisions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Decided to launch in Q4." }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { text: string };
    expect(body.text).toBe("Decided to launch in Q4.");
  });

  it("returns 404 when meeting does not exist", async () => {
    const res = await app.request(
      "/api/meetings/no-such-meeting/key-decisions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Decision" }),
      },
      env,
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when text is missing", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}/key-decisions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      env,
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/key-decisions/:id", () => {
  it("updates text field", async () => {
    const meeting = await seedMeeting();
    const decision = meeting.key_decisions[0];
    const res = await app.request(
      `/api/key-decisions/${decision.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Updated decision text." }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { text: string };
    expect(body.text).toBe("Updated decision text.");
  });

  it("updates position", async () => {
    const meeting = await seedMeeting();
    const decision = meeting.key_decisions[0];
    const res = await app.request(
      `/api/key-decisions/${decision.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: 5 }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { position: number };
    expect(body.position).toBe(5);
  });

  it("returns 404 for unknown id", async () => {
    const res = await app.request(
      "/api/key-decisions/no-such-id",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "x" }),
      },
      env,
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/key-decisions/:id", () => {
  it("deletes a key decision and returns 204", async () => {
    const meeting = await seedMeeting();
    const decision = meeting.key_decisions[0];
    const res = await app.request(
      `/api/key-decisions/${decision.id}`,
      { method: "DELETE" },
      env,
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 when deleting non-existent decision", async () => {
    const res = await app.request(
      "/api/key-decisions/no-such-id",
      { method: "DELETE" },
      env,
    );
    expect(res.status).toBe(404);
  });
});
