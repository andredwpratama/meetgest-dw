import { Hono } from "hono";
import { PatchMeeting } from "../lib/validation";
import { getMeeting, listMeetings } from "../lib/db";
import type { Env } from "../index";

const app = new Hono<{ Bindings: Env }>();

app.get("/meetings", async (c) => c.json(await listMeetings(c.env)));

app.get("/meetings/:id", async (c) => {
  const m = await getMeeting(c.env, c.req.param("id"));
  if (!m) return c.json({ error: "not_found", message: "meeting not found" }, 404);
  return c.json(m);
});

app.patch("/meetings/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = PatchMeeting.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid_body", message: parsed.error.message }, 400);
  const sets: string[] = [];
  const binds: (string | number)[] = [];
  if (parsed.data.title !== undefined) { sets.push("title = ?"); binds.push(parsed.data.title); }
  if (parsed.data.summary !== undefined) { sets.push("summary = ?"); binds.push(parsed.data.summary); }
  if (sets.length === 0) return c.json({ error: "no_changes", message: "no fields to update" }, 400);
  binds.push(id);
  const r = await c.env.DB.prepare(`UPDATE meetings SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
  if (r.meta.changes === 0) return c.json({ error: "not_found", message: "meeting not found" }, 404);
  const updated = await getMeeting(c.env, id);
  return c.json(updated);
});

export default app;
