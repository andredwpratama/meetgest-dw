CREATE TABLE IF NOT EXISTS meetings (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  raw_transcript TEXT NOT NULL,
  summary        TEXT NOT NULL,
  participants   TEXT,                          -- JSON array of names; null = derive from transcript
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS action_items (
  id         TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  task       TEXT NOT NULL,
  owner      TEXT,
  deadline   TEXT,
  position   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS key_decisions (
  id         TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  position   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meetings_created      ON meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_items_meeting  ON action_items(meeting_id, position);
CREATE INDEX IF NOT EXISTS idx_key_decisions_meeting ON key_decisions(meeting_id, position);
