import type { LlmCallResult } from "../../src/lib/llm";

export const VALID_LLM_OUTPUT = {
  summary: "The team reviewed Q3 campaign performance. Meta ads showed strong results with 18% CTR increase. Key decisions were made around creative updates and Google Ads pausing.",
  action_items: [
    { task: "Update Meta ad creatives", owner: "Sarah", deadline: "Thursday EOD" },
    { task: "Coordinate with design team on Google assets", owner: "Mike", deadline: "next week" },
    { task: "Submit monthly report to client", owner: "Sarah", deadline: "Monday" },
  ],
  key_decisions: [
    "Decided to pause Google Ads until new creatives are approved.",
    "Prioritize Meta creatives for Q3 campaign.",
  ],
};

export const VALID_LLM_RESULT: LlmCallResult = {
  parsed: VALID_LLM_OUTPUT,
  raw: JSON.stringify(VALID_LLM_OUTPUT),
  model: "openai/gpt-oss-120b:free",
  input_tokens: 120,
  output_tokens: 80,
  latency_ms: 1200,
  attempts: 1,
};

export const VALID_LLM_RESULT_RETRY: LlmCallResult = {
  ...VALID_LLM_RESULT,
  attempts: 2,
};

export function makeOpenRouterResponse(output: typeof VALID_LLM_OUTPUT) {
  return JSON.stringify({
    choices: [{ message: { content: JSON.stringify(output) } }],
    usage: { prompt_tokens: 120, completion_tokens: 80 },
    model: "openai/gpt-oss-120b:free",
  });
}

export const MALFORMED_OPENROUTER_RESPONSE = JSON.stringify({
  choices: [{ message: { content: "not valid json {{{{" } }],
  usage: { prompt_tokens: 120, completion_tokens: 10 },
  model: "openai/gpt-oss-120b:free",
});

export const LANGFUSE_OK = JSON.stringify({ ok: true });
