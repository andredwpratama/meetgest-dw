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

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const gen = trace.generation({
      name: "openrouter_chat",
      model: env.OPENROUTER_MODEL,
      input: messages,
      metadata: { attempt },
    });
    try {
      const r = await callOpenRouter(env, messages);
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
