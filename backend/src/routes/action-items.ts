import { Hono } from "hono";
import { ActionItemBody, PatchActionItem } from "../lib/validation";
import { newId, type ActionItemRow } from "../lib/db";
import type { Env } from "../index";

const app = new Hono<{ Bindings: Env }>();

app.post("/meetings/:meetingId/action-items", async (c) => {
  const meetingId = c.req.param("meetingId");
  const body = await c.req.json().catch(() => null);
  const parsed = ActionItemBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid_body", message: parsed.error.message }, 400);
  const meeting = await c.env.DB.prepare("SELECT id FROM meetings WHERE id = ?").bind(meetingId).first();
  if (!meeting) return c.json({ error: "not_found", message: "meeting not found" }, 404);
  const maxRow = await c.env.DB
    .prepare("SELECT COALESCE(MAX(position), -1) AS max FROM action_items WHERE meeting_id = ?")
    .bind(meetingId).first<{ max: number }>();
  const position = (maxRow?.max ?? -1) + 1;
  const id = newId();
  await c.env.DB
    .prepare("INSERT INTO action_items (id, meeting_id, task, owner, deadline, position) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, meetingId, parsed.data.task, parsed.data.owner ?? null, parsed.data.deadline ?? null, position).run();
  return c.json({ id, meeting_id: meetingId, task: parsed.data.task, owner: parsed.data.owner ?? null, deadline: parsed.data.deadline ?? null, position }, 201);
});

app.patch("/action-items/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = PatchActionItem.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid_body", message: parsed.error.message }, 400);
  const sets: string[] = [];
  const binds: (string | number | null)[] = [];
  const d = parsed.data;
  if (d.task !== undefined) { sets.push("task = ?"); binds.push(d.task); }
  if (d.owner !== undefined) { sets.push("owner = ?"); binds.push(d.owner); }
  if (d.deadline !== undefined) { sets.push("deadline = ?"); binds.push(d.deadline); }
  if (d.position !== undefined) { sets.push("position = ?"); binds.push(d.position); }
  if (sets.length === 0) return c.json({ error: "no_changes", message: "no fields to update" }, 400);
  binds.push(id);
  const r = await c.env.DB.prepare(`UPDATE action_items SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
  if (r.meta.changes === 0) return c.json({ error: "not_found", message: "action item not found" }, 404);
  const row = await c.env.DB.prepare("SELECT * FROM action_items WHERE id = ?").bind(id).first<ActionItemRow>();
  return c.json(row);
});

app.delete("/action-items/:id", async (c) => {
  const id = c.req.param("id");
  const r = await c.env.DB.prepare("DELETE FROM action_items WHERE id = ?").bind(id).run();
  if (r.meta.changes === 0) return c.json({ error: "not_found", message: "action item not found" }, 404);
  return c.body(null, 204);
});

export default app;
