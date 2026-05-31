import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SELF, env } from "cloudflare:test";

const SAMPLE = {
  summary: "Team agreed to pause Google Ads and update Meta creatives.",
  action_items: [
    { task: "Update Meta creatives", owner: "Sarah", deadline: "Friday" },
    { task: "Draft new TikTok plan", owner: null, deadline: null },
  ],
  key_decisions: ["Pause Google Ads until creatives are ready."],
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).includes("openrouter.ai")) {
      return jsonResp({
        choices: [{ message: { content: JSON.stringify(SAMPLE) } }],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
        model: "openai/gpt-oss-120b:free",
      });
    }
    return jsonResp({ ok: true });
  }));
  await env.DB.exec("DELETE FROM key_decisions");
  await env.DB.exec("DELETE FROM action_items");
  await env.DB.exec("DELETE FROM meetings");
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/process", () => {
  it("422 when transcript too short", async () => {
    const res = await SELF.fetch("http://localhost/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "t", transcript: "x".repeat(50) }),
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "transcript_too_short" });
  });

  it("400 when title missing", async () => {
    const res = await SELF.fetch("http://localhost/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: "x".repeat(500) }),
    });
    expect(res.status).toBe(400);
  });

  it("201 returns meeting with action items and decisions", async () => {
    const res = await SELF.fetch("http://localhost/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Q3 Review", transcript: "x".repeat(500) }),
    });
    expect(res.status).toBe(201);
    const m = (await res.json()) as { title: string; summary: string; action_items: unknown[]; key_decisions: unknown[] };
    expect(m.title).toBe("Q3 Review");
    expect(m.summary).toBe(SAMPLE.summary);
    expect(m.action_items).toHaveLength(2);
    expect(m.key_decisions).toHaveLength(1);
  });
});
