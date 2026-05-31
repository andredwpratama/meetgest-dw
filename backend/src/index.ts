import { Hono } from "hono";
import { cors } from "hono/cors";
import processRoute from "./routes/process";
import meetings from "./routes/meetings";
import actionItems from "./routes/action-items";
import keyDecisions from "./routes/key-decisions";

export type Env = {
  DB: D1Database;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL: string;
  LANGFUSE_PUBLIC_KEY: string;
  LANGFUSE_SECRET_KEY: string;
  LANGFUSE_HOST: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] }));

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api", processRoute);
app.route("/api", meetings);
app.route("/api", actionItems);
app.route("/api", keyDecisions);

export default app;
