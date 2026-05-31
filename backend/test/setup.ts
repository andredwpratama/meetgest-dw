import { env } from "cloudflare:test";
import { beforeAll } from "vitest";

beforeAll(async () => {
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS meetings (id TEXT PRIMARY KEY, title TEXT NOT NULL, raw_transcript TEXT NOT NULL, summary TEXT NOT NULL, created_at INTEGER NOT NULL)",
  );
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS action_items (id TEXT PRIMARY KEY, meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE, task TEXT NOT NULL, owner TEXT, deadline TEXT, position INTEGER NOT NULL)",
  );
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS key_decisions (id TEXT PRIMARY KEY, meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE, text TEXT NOT NULL, position INTEGER NOT NULL)",
  );
});
