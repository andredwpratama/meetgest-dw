import { describe, it, expect } from "vitest";
import { ProcessRequest, LlmOutput } from "../src/lib/validation";

describe("ProcessRequest", () => {
  it("rejects short transcript", () => {
    const r = ProcessRequest.safeParse({ title: "t", transcript: "x".repeat(199) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("transcript_too_short");
  });

  it("rejects long transcript", () => {
    const r = ProcessRequest.safeParse({ title: "t", transcript: "x".repeat(100_001) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("transcript_too_long");
  });

  it("accepts valid input", () => {
    const r = ProcessRequest.safeParse({ title: "t", transcript: "x".repeat(500) });
    expect(r.success).toBe(true);
  });
});

describe("LlmOutput", () => {
  it("accepts null owner and deadline", () => {
    const r = LlmOutput.safeParse({
      summary: "s",
      action_items: [{ task: "t", owner: null, deadline: null }],
      key_decisions: ["d"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects missing summary", () => {
    const r = LlmOutput.safeParse({ action_items: [], key_decisions: [] });
    expect(r.success).toBe(false);
  });
});
