import { Hono } from "hono";
import { KeyDecisionBody, PatchKeyDecision } from "../lib/validation";
import { newId, type KeyDecisionRow } from "../lib/db";
import type { Env } from "../index";

const app = new Hono<{ Bindings: Env }>();

app.post("/meetings/:meetingId/key-decisions", async (c) => {
  const meetingId = c.req.param("meetingId");
  const body = await c.req.json().catch(() => null);
  const parsed = KeyDecisionBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid_body", message: parsed.error.message }, 400);
  const meeting = await c.env.DB.prepare("SELECT id FROM meetings WHERE id = ?").bind(meetingId).first();
  if (!meeting) return c.json({ error: "not_found", message: "meeting not found" }, 404);
  const maxRow = await c.env.DB
    .prepare("SELECT COALESCE(MAX(position), -1) AS max FROM key_decisions WHERE meeting_id = ?")
    .bind(meetingId).first<{ max: number }>();
  const position = (maxRow?.max ?? -1) + 1;
  const id = newId();
  await c.env.DB.prepare("INSERT INTO key_decisions (id, meeting_id, text, position) VALUES (?, ?, ?, ?)")
    .bind(id, meetingId, parsed.data.text, position).run();
  return c.json({ id, meeting_id: meetingId, text: parsed.data.text, position }, 201);
});

app.patch("/key-decisions/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = PatchKeyDecision.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid_body", message: parsed.error.message }, 400);
  const sets: string[] = [];
  const binds: (string | number)[] = [];
  if (parsed.data.text !== undefined) { sets.push("text = ?"); binds.push(parsed.data.text); }
  if (parsed.data.position !== undefined) { sets.push("position = ?"); binds.push(parsed.data.position); }
  if (sets.length === 0) return c.json({ error: "no_changes", message: "no fields to update" }, 400);
  binds.push(id);
  const r = await c.env.DB.prepare(`UPDATE key_decisions SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
  if (r.meta.changes === 0) return c.json({ error: "not_found", message: "key decision not found" }, 404);
  const row = await c.env.DB.prepare("SELECT * FROM key_decisions WHERE id = ?").bind(id).first<KeyDecisionRow>();
  return c.json(row);
});

app.delete("/key-decisions/:id", async (c) => {
  const id = c.req.param("id");
  const r = await c.env.DB.prepare("DELETE FROM key_decisions WHERE id = ?").bind(id).run();
  if (r.meta.changes === 0) return c.json({ error: "not_found", message: "key decision not found" }, 404);
  return c.body(null, 204);
});

export default app;
