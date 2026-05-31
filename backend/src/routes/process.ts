import { Hono } from "hono";
import { ProcessRequest } from "../lib/validation";
import { callLLM } from "../lib/llm";
import { insertMeetingWithChildren, newId } from "../lib/db";
import type { Env } from "../index";

const app = new Hono<{ Bindings: Env }>();

const VALIDATION_MESSAGES: Record<string, string> = {
  transcript_too_short: "Transcript must be at least 200 characters.",
  transcript_too_long: "Transcript exceeds the maximum of 100,000 characters.",
};

app.post("/process", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = ProcessRequest.safeParse(body);
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message ?? "invalid_request";
    const status = code === "transcript_too_short" || code === "transcript_too_long" ? 422 : 400;
    return c.json({ error: code, message: VALIDATION_MESSAGES[code] ?? "invalid request body" }, status);
  }
  const { title, transcript } = parsed.data;
  try {
    const llm = await callLLM(c.env, transcript, title, c.executionCtx);
    const meeting = await insertMeetingWithChildren(c.env, {
      id: newId(),
      title,
      raw_transcript: transcript,
      llm: llm.parsed,
    });
    return c.json(meeting, 201);
  } catch (err) {
    if (err instanceof Error && err.message === "llm_invalid_output") {
      return c.json({ error: "llm_invalid_output", message: "model returned invalid JSON after retry" }, 502);
    }
    return c.json({ error: "internal_error", message: String(err).slice(0, 300) }, 500);
  }
});

export default app;
