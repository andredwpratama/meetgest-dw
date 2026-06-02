import type { ActionItem, KeyDecision, Meeting, MeetingPreview, ApiError } from "./types";

const BASE = import.meta.env.VITE_API_URL as string;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let body: ApiError = { error: "network_error", message: res.statusText };
    try { body = (await res.json()) as ApiError; } catch { /* ignore */ }
    throw Object.assign(new Error(body.error), { apiError: body, status: res.status });
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  process: (title: string, transcript: string) =>
    request<Meeting>("/api/process", { method: "POST", body: JSON.stringify({ title, transcript }) }),
  listMeetings: () => request<MeetingPreview[]>("/api/meetings"),
  getMeeting: (id: string) => request<Meeting>(`/api/meetings/${id}`),
  patchMeeting: (id: string, patch: { title?: string; summary?: string; participants?: string[] }) =>
    request<Meeting>(`/api/meetings/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  addActionItem: (meetingId: string, body: { task: string; owner?: string | null; deadline?: string | null }) =>
    request<ActionItem>(`/api/meetings/${meetingId}/action-items`, { method: "POST", body: JSON.stringify(body) }),
  patchActionItem: (id: string, patch: Partial<{ task: string; owner: string | null; deadline: string | null; position: number }>) =>
    request<ActionItem>(`/api/action-items/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteActionItem: (id: string) => request<void>(`/api/action-items/${id}`, { method: "DELETE" }),

  addKeyDecision: (meetingId: string, text: string) =>
    request<KeyDecision>(`/api/meetings/${meetingId}/key-decisions`, { method: "POST", body: JSON.stringify({ text }) }),
  patchKeyDecision: (id: string, patch: Partial<{ text: string; position: number }>) =>
    request<KeyDecision>(`/api/key-decisions/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteKeyDecision: (id: string) => request<void>(`/api/key-decisions/${id}`, { method: "DELETE" }),
};
