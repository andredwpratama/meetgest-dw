import { z } from "zod";

export const ProcessRequest = z.object({
  title: z.string().trim().min(1, "title_required").max(200),
  transcript: z.string().min(200, "transcript_too_short").max(100_000, "transcript_too_long"),
});

export const LlmActionItem = z.object({
  task: z.string().trim().min(1),
  owner: z.string().trim().min(1).nullable(),
  deadline: z.string().trim().min(1).nullable(),
});

export const LlmOutput = z.object({
  summary: z.string().trim().min(1),
  action_items: z.array(LlmActionItem),
  key_decisions: z.array(z.string().trim().min(1)),
});

export type LlmOutputT = z.infer<typeof LlmOutput>;

export const PatchMeeting = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().min(1).optional(),
  participants: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
});

export const ActionItemBody = z.object({
  task: z.string().trim().min(1),
  owner: z.string().trim().nullable().optional(),
  deadline: z.string().trim().nullable().optional(),
});

export const PatchActionItem = z.object({
  task: z.string().trim().min(1).optional(),
  owner: z.string().trim().nullable().optional(),
  deadline: z.string().trim().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const KeyDecisionBody = z.object({
  text: z.string().trim().min(1),
});

export const PatchKeyDecision = z.object({
  text: z.string().trim().min(1).optional(),
  position: z.number().int().min(0).optional(),
});
