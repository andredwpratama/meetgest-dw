import type { Env } from "../index";
import type { LlmOutputT } from "./validation";

export type ActionItemRow = {
  id: string;
  meeting_id: string;
  task: string;
  owner: string | null;
  deadline: string | null;
  position: number;
};

export type KeyDecisionRow = {
  id: string;
  meeting_id: string;
  text: string;
  position: number;
};

export type MeetingRow = {
  id: string;
  title: string;
  raw_transcript: string;
  summary: string;
  participants: string | null;        // JSON array string in DB; null = derive from transcript
  created_at: number;
};

export type MeetingFull = Omit<MeetingRow, "participants"> & {
  participants: string[] | null;       // parsed for the API response
  action_items: ActionItemRow[];
  key_decisions: KeyDecisionRow[];
};

export function newId() {
  return crypto.randomUUID();
}

function parseParticipants(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
}

export async function insertMeetingWithChildren(
  env: Env,
  args: { id: string; title: string; raw_transcript: string; llm: LlmOutputT },
): Promise<MeetingFull> {
  const created_at = Date.now();
  const stmts: D1PreparedStatement[] = [];
  stmts.push(
    env.DB.prepare("INSERT INTO meetings (id, title, raw_transcript, summary, created_at) VALUES (?, ?, ?, ?, ?)").bind(
      args.id,
      args.title,
      args.raw_transcript,
      args.llm.summary,
      created_at,
    ),
  );
  const actionRows: ActionItemRow[] = args.llm.action_items.map((a, i) => ({
    id: newId(),
    meeting_id: args.id,
    task: a.task,
    owner: a.owner,
    deadline: a.deadline,
    position: i,
  }));
  for (const a of actionRows) {
    stmts.push(
      env.DB.prepare(
        "INSERT INTO action_items (id, meeting_id, task, owner, deadline, position) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(a.id, a.meeting_id, a.task, a.owner, a.deadline, a.position),
    );
  }
  const decisionRows: KeyDecisionRow[] = args.llm.key_decisions.map((text, i) => ({
    id: newId(),
    meeting_id: args.id,
    text,
    position: i,
  }));
  for (const d of decisionRows) {
    stmts.push(
      env.DB.prepare("INSERT INTO key_decisions (id, meeting_id, text, position) VALUES (?, ?, ?, ?)").bind(
        d.id,
        d.meeting_id,
        d.text,
        d.position,
      ),
    );
  }
  await env.DB.batch(stmts);
  return {
    id: args.id,
    title: args.title,
    raw_transcript: args.raw_transcript,
    summary: args.llm.summary,
    participants: null,
    created_at,
    action_items: actionRows,
    key_decisions: decisionRows,
  };
}

export async function getMeeting(env: Env, id: string): Promise<MeetingFull | null> {
  const meeting = await env.DB.prepare("SELECT * FROM meetings WHERE id = ?").bind(id).first<MeetingRow>();
  if (!meeting) return null;
  const [actions, decisions] = await Promise.all([
    env.DB.prepare("SELECT * FROM action_items WHERE meeting_id = ? ORDER BY position ASC").bind(id).all<ActionItemRow>(),
    env.DB.prepare("SELECT * FROM key_decisions WHERE meeting_id = ? ORDER BY position ASC").bind(id).all<KeyDecisionRow>(),
  ]);
  return {
    ...meeting,
    participants: parseParticipants(meeting.participants),
    action_items: actions.results ?? [],
    key_decisions: decisions.results ?? [],
  };
}

export async function listMeetings(env: Env) {
  const r = await env.DB
    .prepare("SELECT id, title, summary, created_at FROM meetings ORDER BY created_at DESC")
    .all<Pick<MeetingRow, "id" | "title" | "summary" | "created_at">>();
  return r.results ?? [];
}
