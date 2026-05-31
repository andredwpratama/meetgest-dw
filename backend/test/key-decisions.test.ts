import { describe, it, expect, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";

beforeEach(async () => {
  await env.DB.exec("DELETE FROM key_decisions");
  await env.DB.exec("DELETE FROM action_items");
  await env.DB.exec("DELETE FROM meetings");
  await env.DB.prepare("INSERT INTO meetings (id, title, raw_transcript, summary, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind("m1", "T", "raw", "summary", 1700000000000).run();
});

describe("key decisions routes", () => {
  it("POST creates with position 0 then 1", async () => {
    const a = await SELF.fetch("http://localhost/api/meetings/m1/key-decisions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Pause Google Ads" }),
    });
    expect(a.status).toBe(201);
    expect((await a.json() as { position: number }).position).toBe(0);
    const b = await SELF.fetch("http://localhost/api/meetings/m1/key-decisions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Raise TikTok budget" }),
    });
    expect((await b.json() as { position: number }).position).toBe(1);
  });

  it("PATCH and DELETE work", async () => {
    const created = await (await SELF.fetch("http://localhost/api/meetings/m1/key-decisions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Original" }),
    })).json() as { id: string };
    const p = await SELF.fetch(`http://localhost/api/key-decisions/${created.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Edited" }),
    });
    expect(p.status).toBe(200);
    expect((await p.json() as { text: string }).text).toBe("Edited");
    const d = await SELF.fetch(`http://localhost/api/key-decisions/${created.id}`, { method: "DELETE" });
    expect(d.status).toBe(204);
  });
});
