import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";

describe("health", () => {
  it("returns ok", async () => {
    const res = await SELF.fetch("http://localhost/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
