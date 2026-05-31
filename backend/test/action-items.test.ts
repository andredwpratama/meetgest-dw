import { describe, it, expect, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";

beforeEach(async () => {
  await env.DB.exec("DELETE FROM key_decisions");
  await env.DB.exec("DELETE FROM action_items");
  await env.DB.exec("DELETE FROM meetings");
  await env.DB.prepare("INSERT INTO meetings (id, title, raw_transcript, summary, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind("m1", "T", "raw", "summary", 1700000000000).run();
});

describe("action items routes", () => {
  it("POST creates with auto-incremented position", async () => {
    const a = await SELF.fetch("http://localhost/api/meetings/m1/action-items", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "First", owner: "Alice" }),
    });
    expect(a.status).toBe(201);
    expect((await a.json() as { position: number }).position).toBe(0);
    const b = await SELF.fetch("http://localhost/api/meetings/m1/action-items", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "Second" }),
    });
    expect((await b.json() as { position: number }).position).toBe(1);
  });

  it("PATCH updates task", async () => {
    const created = await (await SELF.fetch("http://localhost/api/meetings/m1/action-items", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "Old" }),
    })).json() as { id: string };
    const r = await SELF.fetch(`http://localhost/api/action-items/${created.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "New", owner: "Bob" }),
    });
    expect(r.status).toBe(200);
    const j = await r.json() as { task: string; owner: string };
    expect(j.task).toBe("New");
    expect(j.owner).toBe("Bob");
  });

  it("DELETE removes the row", async () => {
    const created = await (await SELF.fetch("http://localhost/api/meetings/m1/action-items", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "X" }),
    })).json() as { id: string };
    const del = await SELF.fetch(`http://localhost/api/action-items/${created.id}`, { method: "DELETE" });
    expect(del.status).toBe(204);
    const again = await SELF.fetch(`http://localhost/api/action-items/${created.id}`, { method: "DELETE" });
    expect(again.status).toBe(404);
  });
});
