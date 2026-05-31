import { describe, it, expect, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";

async function seed() {
  await env.DB.exec("DELETE FROM key_decisions");
  await env.DB.exec("DELETE FROM action_items");
  await env.DB.exec("DELETE FROM meetings");
  await env.DB.prepare("INSERT INTO meetings (id, title, raw_transcript, summary, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind("m1", "Old Title", "transcript", "old summary", 1700000000000).run();
}

beforeEach(seed);

describe("meetings routes", () => {
  it("GET /api/meetings returns the list", async () => {
    const res = await SELF.fetch("http://localhost/api/meetings");
    expect(res.status).toBe(200);
    const list = (await res.json()) as unknown[];
    expect(list).toHaveLength(1);
  });

  it("GET /api/meetings/:id returns full meeting", async () => {
    const res = await SELF.fetch("http://localhost/api/meetings/m1");
    expect(res.status).toBe(200);
    const m = (await res.json()) as { id: string; action_items: unknown[] };
    expect(m.id).toBe("m1");
    expect(m.action_items).toEqual([]);
  });

  it("GET /api/meetings/:id 404 when missing", async () => {
    const res = await SELF.fetch("http://localhost/api/meetings/zzz");
    expect(res.status).toBe(404);
  });

  it("PATCH updates title and summary", async () => {
    const res = await SELF.fetch("http://localhost/api/meetings/m1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New", summary: "new summary" }),
    });
    expect(res.status).toBe(200);
    const m = (await res.json()) as { title: string; summary: string };
    expect(m.title).toBe("New");
    expect(m.summary).toBe("new summary");
  });
});
