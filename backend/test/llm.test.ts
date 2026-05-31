import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callLLM } from "../src/lib/llm";

const ENV = {
  OPENROUTER_API_KEY: "k",
  OPENROUTER_MODEL: "openai/gpt-oss-120b:free",
  LANGFUSE_PUBLIC_KEY: "pk",
  LANGFUSE_SECRET_KEY: "sk",
  LANGFUSE_HOST: "https://cloud.langfuse.com",
} as never;

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("callLLM", () => {
  it("returns parsed output on first valid response", async () => {
    const good = { summary: "s", action_items: [], key_decisions: [] };
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockImplementation(async (url: string) => {
      if (String(url).includes("openrouter.ai")) {
        return jsonResp({
          choices: [{ message: { content: JSON.stringify(good) } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
          model: "openai/gpt-oss-120b:free",
        });
      }
      return jsonResp({ ok: true });
    });
    const r = await callLLM(ENV, "x".repeat(500), "Title");
    expect(r.parsed).toEqual(good);
    expect(r.attempts).toBe(1);
  });

  it("retries once on malformed JSON then throws llm_invalid_output", async () => {
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    let calls = 0;
    f.mockImplementation(async (url: string) => {
      if (String(url).includes("openrouter.ai")) {
        calls++;
        return jsonResp({
          choices: [{ message: { content: "not json" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        });
      }
      return jsonResp({ ok: true });
    });
    await expect(callLLM(ENV, "x".repeat(500), "T")).rejects.toThrow(/llm_invalid_output/);
    expect(calls).toBe(2);
  });
});
