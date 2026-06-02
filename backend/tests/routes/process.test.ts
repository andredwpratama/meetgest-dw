import { describe, it, expect, vi, afterEach } from "vitest";
import { env } from "cloudflare:test";
import app from "../../src/index";
import {
  SAMPLE_TRANSCRIPT,
  SHORT_TRANSCRIPT,
  LONG_TRANSCRIPT,
} from "../fixtures/transcript";
import {
  VALID_LLM_OUTPUT,
  VALID_CONTENT,
  FENCED_CONTENT,
  MALFORMED_CONTENT,
  providerBody,
  LANGFUSE_OK,
} from "../fixtures/llm-responses";

afterEach(() => vi.unstubAllGlobals());

// Serve whichever provider the Worker calls (OpenRouter or Anthropic) with the
// same raw model "content", so tests are provider-agnostic.
function jsonResponse(body: string) {
  return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
}

function providerFor(url: string | URL | Request) {
  const u = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
  if (u.includes("openrouter.ai")) return "openrouter" as const;
  if (u.includes("api.anthropic.com")) return "anthropic" as const;
  return null;
}

function makeFetch(content: string) {
  return vi.fn(async (url: string | URL | Request) => {
    const provider = providerFor(url);
    if (provider) return jsonResponse(providerBody(provider, content));
    return jsonResponse(LANGFUSE_OK);
  });
}

async function post(body: unknown) {
  return app.request(
    "/api/process",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
  );
}

describe("POST /api/process", () => {
  it("returns 201 with valid input", async () => {
    vi.stubGlobal("fetch", makeFetch(VALID_CONTENT));
    const res = await post({ title: "Q3 Review", transcript: SAMPLE_TRANSCRIPT });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBeTruthy();
    expect(body.summary).toBe(VALID_LLM_OUTPUT.summary);
    expect(Array.isArray(body.action_items)).toBe(true);
    expect((body.action_items as unknown[]).length).toBe(3);
    expect(Array.isArray(body.key_decisions)).toBe(true);
  });

  it("returns 201 when LLM wraps JSON in markdown fences", async () => {
    vi.stubGlobal("fetch", makeFetch(FENCED_CONTENT));
    const res = await post({ title: "Fenced", transcript: SAMPLE_TRANSCRIPT });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.summary).toBe(VALID_LLM_OUTPUT.summary);
  });

  it("returns 422 transcript_too_short", async () => {
    const res = await post({ title: "Test", transcript: SHORT_TRANSCRIPT });
    expect(res.status).toBe(422);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("transcript_too_short");
  });

  it("returns 422 transcript_too_long", async () => {
    const res = await post({ title: "Test", transcript: LONG_TRANSCRIPT });
    expect(res.status).toBe(422);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("transcript_too_long");
  });

  it("returns 400 when title is missing", async () => {
    const res = await post({ transcript: SAMPLE_TRANSCRIPT });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not JSON", async () => {
    const res = await app.request(
      "/api/process",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "bad" },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("retries and returns 201 when LLM fails once then succeeds", async () => {
    let llmCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      const provider = providerFor(url);
      if (provider) {
        llmCalls++;
        const content = llmCalls === 1 ? MALFORMED_CONTENT : VALID_CONTENT;
        return jsonResponse(providerBody(provider, content));
      }
      return jsonResponse(LANGFUSE_OK);
    }));

    const res = await post({ title: "Retry Test", transcript: SAMPLE_TRANSCRIPT });
    expect(res.status).toBe(201);
  });

  it("returns 502 llm_invalid_output when LLM fails both attempts", async () => {
    vi.stubGlobal("fetch", makeFetch(MALFORMED_CONTENT));
    const res = await post({ title: "Fail Test", transcript: SAMPLE_TRANSCRIPT });
    expect(res.status).toBe(502);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("llm_invalid_output");
  });
});
