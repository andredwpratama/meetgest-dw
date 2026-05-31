export type ActionItem = {
  id: string;
  meeting_id: string;
  task: string;
  owner: string | null;
  deadline: string | null;
  position: number;
};

export type KeyDecision = {
  id: string;
  meeting_id: string;
  text: string;
  position: number;
};

export type Meeting = {
  id: string;
  title: string;
  raw_transcript: string;
  summary: string;
  created_at: number;
  action_items: ActionItem[];
  key_decisions: KeyDecision[];
};

export type MeetingPreview = Pick<Meeting, "id" | "title" | "summary" | "created_at">;

export type ApiError = { error: string; message: string };
