import { describe, it, expect } from "vitest";
import { buildMessages, SYSTEM_PROMPT } from "../src/lib/prompt";

describe("buildMessages", () => {
  it("returns system + user with title and transcript embedded", () => {
    const msgs = buildMessages("hello transcript", "Q3 Review");
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toEqual({ role: "system", content: SYSTEM_PROMPT });
    expect(msgs[1].role).toBe("user");
    expect(msgs[1].content).toContain("Q3 Review");
    expect(msgs[1].content).toContain("hello transcript");
  });

  it("system prompt forbids invented owners and deadlines", () => {
    expect(SYSTEM_PROMPT).toMatch(/NEVER invent an owner/i);
    expect(SYSTEM_PROMPT).toMatch(/NEVER invent a deadline/i);
  });
});
