import { Langfuse } from "langfuse";
import { buildMessages } from "./prompt";
import { LlmOutput, type LlmOutputT } from "./validation";
import type { Env } from "../index";

export type LlmCallResult = {
  parsed: LlmOutputT;
  raw: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  attempts: number;
};

type ChatResp = {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
};

type AnthropicResp = {
  content: { type: string; text: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
};

async function callOpenRouter(env: Env, messages: { role: "system" | "user"; content: string }[]) {
  const started = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });
  const latency_ms = Date.now() - started;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`openrouter_${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as ChatResp;
  const content = data.choices?.[0]?.message?.content ?? "";
  return {
    content,
    latency_ms,
    input_tokens: data.usage?.prompt_tokens ?? 0,
    output_tokens: data.usage?.completion_tokens ?? 0,
    model: data.model ?? env.OPENROUTER_MODEL,
  };
}

async function callAnthropic(env: Env, messages: { role: "system" | "user"; content: string }[]) {
  const started = Date.now();
  const model = env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
  const system = messages.find(m => m.role === "system")?.content ?? "";
  const userMessages = messages.filter(m => m.role !== "system").map(m => ({ role: m.role as "user", content: m.content }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0.2,
      system,
      messages: userMessages,
    }),
  });
  const latency_ms = Date.now() - started;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`anthropic_${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as AnthropicResp;
  const content = data.content?.[0]?.text ?? "";
  return {
    content,
    latency_ms,
    input_tokens: data.usage?.input_tokens ?? 0,
    output_tokens: data.usage?.output_tokens ?? 0,
    model: data.model ?? model,
  };
}

function parseAndValidate(raw: string): LlmOutputT {
  const obj = JSON.parse(raw);
  return LlmOutput.parse(obj);
}

export async function callLLM(env: Env, transcript: string, title: string, ctx: ExecutionContext): Promise<LlmCallResult> {
  const messages = buildMessages(transcript, title);
  const langfuse = new Langfuse({
    publicKey: env.LANGFUSE_PUBLIC_KEY,
    secretKey: env.LANGFUSE_SECRET_KEY,
    baseUrl: env.LANGFUSE_HOST,
  });
  const trace = langfuse.trace({ name: "process_transcript", input: { title, transcript_length: transcript.length } });

  const usingAnthropic = !!env.ANTHROPIC_API_KEY;
  const modelName = usingAnthropic ? (env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001") : env.OPENROUTER_MODEL;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const gen = trace.generation({
      name: usingAnthropic ? "anthropic_chat" : "openrouter_chat",
      model: modelName,
      input: messages,
      metadata: { attempt },
    });
    try {
      const r = usingAnthropic ? await callAnthropic(env, messages) : await callOpenRouter(env, messages);
      gen.end({
        output: r.content,
        usage: { input: r.input_tokens, output: r.output_tokens },
        metadata: { latency_ms: r.latency_ms, model_returned: r.model },
      });
      const parsed = parseAndValidate(r.content);
      trace.update({ output: { ok: true, attempts: attempt } });
      ctx.waitUntil(langfuse.flushAsync());
      return {
        parsed,
        raw: r.content,
        model: r.model,
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        latency_ms: r.latency_ms,
        attempts: attempt,
      };
    } catch (err) {
      lastErr = err;
      gen.end({ level: "ERROR", statusMessage: String(err).slice(0, 300) });
    }
  }
  trace.update({ output: { ok: false, error: String(lastErr).slice(0, 300) } });
  ctx.waitUntil(langfuse.flushAsync());
  throw new Error("llm_invalid_output");
}
