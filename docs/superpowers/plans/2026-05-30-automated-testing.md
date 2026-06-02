# Automated Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend unit tests (Vitest + Cloudflare Workers runtime + real D1) and Playwright E2E tests covering paste, upload, history, export, and error flows for both dev and prod environments.

**Architecture:** Backend tests use `@cloudflare/vitest-pool-workers` which runs tests inside a real Miniflare Workers runtime with real D1 local. LLM calls are intercepted per-test using `fetchMock` from `cloudflare:test`. E2E tests use Playwright with two projects — `dev` (API mocked via `page.route()`) and `prod` (real backend, real LLM).

**Tech Stack:** `@cloudflare/vitest-pool-workers`, `vitest 4.1.7`, `@playwright/test`, Hono `app.request()` for route testing, undici `fetchMock` for LLM mocking.

---

## File Map

**Created:**
- `backend/vitest.config.ts` — workers pool config
- `backend/tests/setup.ts` — schema apply + fetch mock lifecycle
- `backend/tests/fixtures/transcript.ts` — sample transcript (>200 chars)
- `backend/tests/fixtures/llm-responses.ts` — typed mock LLM payloads
- `backend/tests/routes/process.test.ts`
- `backend/tests/routes/meetings.test.ts`
- `backend/tests/routes/action-items.test.ts`
- `backend/tests/routes/key-decisions.test.ts`
- `frontend/e2e/playwright.config.ts`
- `frontend/e2e/fixtures/sample.txt`
- `frontend/e2e/tests/process-paste.spec.ts`
- `frontend/e2e/tests/process-upload.spec.ts`
- `frontend/e2e/tests/history.spec.ts`
- `frontend/e2e/tests/export.spec.ts`
- `frontend/e2e/tests/errors.spec.ts`
- `.github/workflows/test-unit.yml`
- `.github/workflows/test-e2e.yml`

**Modified:**
- `backend/package.json` — add test script
- `frontend/package.json` — add Playwright dep + e2e script
- `package.json` (root) — add unified test scripts

---

## Task 1: Backend vitest config

**Files:**
- Create: `backend/vitest.config.ts`
- Create: `backend/tests/setup.ts`

- [ ] **Step 1: Create `backend/vitest.config.ts`**

```typescript
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          d1Databases: ["DB"],
        },
      },
    },
  },
});
```

- [ ] **Step 2: Create `backend/tests/setup.ts`**

```typescript
import { env, fetchMock } from "cloudflare:test";
import { beforeAll, afterEach, afterAll } from "vitest";

beforeAll(async () => {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id             TEXT PRIMARY KEY,
      title          TEXT NOT NULL,
      raw_transcript TEXT NOT NULL,
      summary        TEXT NOT NULL,
      created_at     INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS action_items (
      id         TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      task       TEXT NOT NULL,
      owner      TEXT,
      deadline   TEXT,
      position   INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS key_decisions (
      id         TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      text       TEXT NOT NULL,
      position   INTEGER NOT NULL
    );
  `);

  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(async () => {
  // Clean DB between tests for isolation
  await env.DB.exec(`
    DELETE FROM key_decisions;
    DELETE FROM action_items;
    DELETE FROM meetings;
  `);
});

afterAll(() => {
  fetchMock.assertNoPendingInterceptors();
  fetchMock.deactivate();
});
```

- [ ] **Step 3: Verify config is valid**

```bash
cd backend && npx vitest run --reporter=verbose 2>&1 | head -20
```
Expected: no config errors (tests may fail — that's fine at this stage).

- [ ] **Step 4: Commit**

```bash
git add backend/vitest.config.ts backend/tests/setup.ts
git commit -m "test: add vitest workers config and test setup"
```

---

## Task 2: Test fixtures

**Files:**
- Create: `backend/tests/fixtures/transcript.ts`
- Create: `backend/tests/fixtures/llm-responses.ts`

- [ ] **Step 1: Create `backend/tests/fixtures/transcript.ts`**

```typescript
export const SAMPLE_TRANSCRIPT = `
John: Good morning everyone. Let's get started with the Q3 campaign review.
Sarah: Sure. The Meta ads performed well — CTR is up 18% from last month.
John: Great. We need to update the creatives before Friday. Sarah, can you own that?
Sarah: Yes, I'll have new creatives ready by Thursday EOD.
John: We also decided to pause Google Ads until the new creatives are approved.
Mike: Agreed. I'll coordinate with the design team on the Google assets next week.
John: One more thing — we need to submit the monthly report to the client by Monday.
Sarah: I'll handle the report. Should be straightforward.
John: Perfect. Let's wrap up. Main decisions: pause Google Ads, prioritize Meta creatives.
`.trim();

export const SHORT_TRANSCRIPT = "Too short.";

export const LONG_TRANSCRIPT = "x".repeat(100_001);
```

- [ ] **Step 2: Create `backend/tests/fixtures/llm-responses.ts`**

```typescript
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

// OpenRouter HTTP response body shape
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

// Langfuse always returns 200 OK
export const LANGFUSE_OK = JSON.stringify({ ok: true });
```

- [ ] **Step 3: Commit**

```bash
git add backend/tests/fixtures/
git commit -m "test: add test fixtures for transcript and LLM responses"
```

---

## Task 3: process route tests

**Files:**
- Create: `backend/tests/routes/process.test.ts`

- [ ] **Step 1: Create `backend/tests/routes/process.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { env, fetchMock } from "cloudflare:test";
import app from "../../src/index";
import {
  SAMPLE_TRANSCRIPT,
  SHORT_TRANSCRIPT,
  LONG_TRANSCRIPT,
} from "../fixtures/transcript";
import {
  makeOpenRouterResponse,
  VALID_LLM_OUTPUT,
  MALFORMED_OPENROUTER_RESPONSE,
  LANGFUSE_OK,
} from "../fixtures/llm-responses";

function mockLLMSuccess() {
  fetchMock
    .get("https://openrouter.ai")
    .intercept({ path: "/api/v1/chat/completions", method: "POST" })
    .reply(200, makeOpenRouterResponse(VALID_LLM_OUTPUT));
  // Langfuse SDK makes multiple calls; mock them all
  fetchMock
    .get("https://cloud.langfuse.com")
    .intercept({ path: /.*/ })
    .reply(200, LANGFUSE_OK)
    .times(10);
}

function mockLLMInvalid() {
  fetchMock
    .get("https://openrouter.ai")
    .intercept({ path: "/api/v1/chat/completions", method: "POST" })
    .reply(200, MALFORMED_OPENROUTER_RESPONSE);
  fetchMock
    .get("https://cloud.langfuse.com")
    .intercept({ path: /.*/ })
    .reply(200, LANGFUSE_OK)
    .times(10);
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
    mockLLMSuccess();
    const res = await post({ title: "Q3 Review", transcript: SAMPLE_TRANSCRIPT });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBeTruthy();
    expect(body.summary).toBe(VALID_LLM_OUTPUT.summary);
    expect(Array.isArray(body.action_items)).toBe(true);
    expect((body.action_items as unknown[]).length).toBe(3);
    expect(Array.isArray(body.key_decisions)).toBe(true);
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
    // First call: invalid JSON. Second call: valid.
    fetchMock
      .get("https://openrouter.ai")
      .intercept({ path: "/api/v1/chat/completions", method: "POST" })
      .reply(200, MALFORMED_OPENROUTER_RESPONSE)
      .times(1);
    fetchMock
      .get("https://openrouter.ai")
      .intercept({ path: "/api/v1/chat/completions", method: "POST" })
      .reply(200, makeOpenRouterResponse(VALID_LLM_OUTPUT))
      .times(1);
    fetchMock
      .get("https://cloud.langfuse.com")
      .intercept({ path: /.*/ })
      .reply(200, LANGFUSE_OK)
      .times(10);

    const res = await post({ title: "Retry Test", transcript: SAMPLE_TRANSCRIPT });
    expect(res.status).toBe(201);
  });

  it("returns 502 llm_invalid_output when LLM fails both attempts", async () => {
    mockLLMInvalid();
    fetchMock
      .get("https://openrouter.ai")
      .intercept({ path: "/api/v1/chat/completions", method: "POST" })
      .reply(200, MALFORMED_OPENROUTER_RESPONSE);

    const res = await post({ title: "Fail Test", transcript: SAMPLE_TRANSCRIPT });
    expect(res.status).toBe(502);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("llm_invalid_output");
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
cd backend && npx vitest run tests/routes/process.test.ts --reporter=verbose
```
Expected: all 7 tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/process.test.ts
git commit -m "test: add process route unit tests"
```

---

## Task 4: meetings route tests

**Files:**
- Create: `backend/tests/routes/meetings.test.ts`

- [ ] **Step 1: Create `backend/tests/routes/meetings.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import app from "../../src/index";
import { newId, insertMeetingWithChildren } from "../../src/lib/db";
import { VALID_LLM_OUTPUT } from "../fixtures/llm-responses";
import { SAMPLE_TRANSCRIPT } from "../fixtures/transcript";

async function seedMeeting(title = "Test Meeting") {
  return insertMeetingWithChildren(env, {
    id: newId(),
    title,
    raw_transcript: SAMPLE_TRANSCRIPT,
    llm: VALID_LLM_OUTPUT,
  });
}

describe("GET /api/meetings", () => {
  it("returns empty array when no meetings exist", async () => {
    const res = await app.request("/api/meetings", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns list after inserting a meeting", async () => {
    await seedMeeting("My Meeting");
    const res = await app.request("/api/meetings", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { title: string }[];
    expect(body.length).toBe(1);
    expect(body[0].title).toBe("My Meeting");
  });
});

describe("GET /api/meetings/:id", () => {
  it("returns full meeting with action items and decisions", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(`/api/meetings/${meeting.id}`, {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBe(meeting.id);
    expect(Array.isArray(body.action_items)).toBe(true);
    expect(Array.isArray(body.key_decisions)).toBe(true);
  });

  it("returns 404 for unknown id", async () => {
    const res = await app.request("/api/meetings/does-not-exist", {}, env);
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("not_found");
  });
});

describe("PATCH /api/meetings/:id", () => {
  it("updates title only", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated Title" }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { title: string };
    expect(body.title).toBe("Updated Title");
  });

  it("updates summary only", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: "New summary text." }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { summary: string };
    expect(body.summary).toBe("New summary text.");
  });

  it("updates both title and summary", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "T2", summary: "S2" }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { title: string; summary: string };
    expect(body.title).toBe("T2");
    expect(body.summary).toBe("S2");
  });

  it("returns 400 with empty body", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("no_changes");
  });

  it("returns 404 for unknown id", async () => {
    const res = await app.request(
      "/api/meetings/does-not-exist",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "x" }),
      },
      env,
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
cd backend && npx vitest run tests/routes/meetings.test.ts --reporter=verbose
```
Expected: all 8 tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/meetings.test.ts
git commit -m "test: add meetings route unit tests"
```

---

## Task 5: action-items route tests

**Files:**
- Create: `backend/tests/routes/action-items.test.ts`

- [ ] **Step 1: Create `backend/tests/routes/action-items.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import app from "../../src/index";
import { newId, insertMeetingWithChildren } from "../../src/lib/db";
import { VALID_LLM_OUTPUT } from "../fixtures/llm-responses";
import { SAMPLE_TRANSCRIPT } from "../fixtures/transcript";

async function seedMeeting() {
  return insertMeetingWithChildren(env, {
    id: newId(),
    title: "Test",
    raw_transcript: SAMPLE_TRANSCRIPT,
    llm: VALID_LLM_OUTPUT,
  });
}

describe("POST /api/meetings/:meetingId/action-items", () => {
  it("adds an action item to an existing meeting", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}/action-items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "New task", owner: "Alice", deadline: "Friday" }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { task: string; owner: string };
    expect(body.task).toBe("New task");
    expect(body.owner).toBe("Alice");
  });

  it("returns 404 when meeting does not exist", async () => {
    const res = await app.request(
      "/api/meetings/no-such-meeting/action-items",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "Task" }),
      },
      env,
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when task is missing", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}/action-items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: "Bob" }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/action-items/:id", () => {
  it("updates task field", async () => {
    const meeting = await seedMeeting();
    const item = meeting.action_items[0];
    const res = await app.request(
      `/api/action-items/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "Updated task" }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { task: string };
    expect(body.task).toBe("Updated task");
  });

  it("sets owner to null", async () => {
    const meeting = await seedMeeting();
    const item = meeting.action_items[0];
    const res = await app.request(
      `/api/action-items/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: null }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { owner: null };
    expect(body.owner).toBeNull();
  });

  it("updates position", async () => {
    const meeting = await seedMeeting();
    const item = meeting.action_items[0];
    const res = await app.request(
      `/api/action-items/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: 99 }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { position: number };
    expect(body.position).toBe(99);
  });

  it("returns 404 for unknown id", async () => {
    const res = await app.request(
      "/api/action-items/no-such-id",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "x" }),
      },
      env,
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/action-items/:id", () => {
  it("deletes an action item and returns 204", async () => {
    const meeting = await seedMeeting();
    const item = meeting.action_items[0];
    const res = await app.request(
      `/api/action-items/${item.id}`,
      { method: "DELETE" },
      env,
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 when deleting non-existent item", async () => {
    const res = await app.request(
      "/api/action-items/no-such-id",
      { method: "DELETE" },
      env,
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
cd backend && npx vitest run tests/routes/action-items.test.ts --reporter=verbose
```
Expected: all 8 tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/action-items.test.ts
git commit -m "test: add action-items route unit tests"
```

---

## Task 6: key-decisions route tests

**Files:**
- Create: `backend/tests/routes/key-decisions.test.ts`

- [ ] **Step 1: Create `backend/tests/routes/key-decisions.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import app from "../../src/index";
import { newId, insertMeetingWithChildren } from "../../src/lib/db";
import { VALID_LLM_OUTPUT } from "../fixtures/llm-responses";
import { SAMPLE_TRANSCRIPT } from "../fixtures/transcript";

async function seedMeeting() {
  return insertMeetingWithChildren(env, {
    id: newId(),
    title: "Test",
    raw_transcript: SAMPLE_TRANSCRIPT,
    llm: VALID_LLM_OUTPUT,
  });
}

describe("POST /api/meetings/:meetingId/key-decisions", () => {
  it("adds a key decision to an existing meeting", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}/key-decisions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Decided to launch in Q4." }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { text: string };
    expect(body.text).toBe("Decided to launch in Q4.");
  });

  it("returns 404 when meeting does not exist", async () => {
    const res = await app.request(
      "/api/meetings/no-such-meeting/key-decisions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Decision" }),
      },
      env,
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when text is missing", async () => {
    const meeting = await seedMeeting();
    const res = await app.request(
      `/api/meetings/${meeting.id}/key-decisions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      env,
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/key-decisions/:id", () => {
  it("updates text field", async () => {
    const meeting = await seedMeeting();
    const decision = meeting.key_decisions[0];
    const res = await app.request(
      `/api/key-decisions/${decision.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Updated decision text." }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { text: string };
    expect(body.text).toBe("Updated decision text.");
  });

  it("updates position", async () => {
    const meeting = await seedMeeting();
    const decision = meeting.key_decisions[0];
    const res = await app.request(
      `/api/key-decisions/${decision.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: 5 }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { position: number };
    expect(body.position).toBe(5);
  });

  it("returns 404 for unknown id", async () => {
    const res = await app.request(
      "/api/key-decisions/no-such-id",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "x" }),
      },
      env,
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/key-decisions/:id", () => {
  it("deletes a key decision and returns 204", async () => {
    const meeting = await seedMeeting();
    const decision = meeting.key_decisions[0];
    const res = await app.request(
      `/api/key-decisions/${decision.id}`,
      { method: "DELETE" },
      env,
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 when deleting non-existent decision", async () => {
    const res = await app.request(
      "/api/key-decisions/no-such-id",
      { method: "DELETE" },
      env,
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run all backend tests**

```bash
cd backend && npx vitest run --reporter=verbose
```
Expected: ~31 tests across 4 files, all passing.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/key-decisions.test.ts
git commit -m "test: add key-decisions route unit tests"
```

---

## Task 7: Playwright setup

**Files:**
- Modify: `frontend/package.json` — add `@playwright/test`
- Create: `frontend/e2e/playwright.config.ts`
- Create: `frontend/e2e/fixtures/sample.txt`

- [ ] **Step 1: Install Playwright**

```bash
cd frontend && npm install --save-dev @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create `frontend/e2e/playwright.config.ts`**

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "dev",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.BASE_URL ?? "http://localhost:5173",
      },
    },
    {
      name: "prod",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.PROD_URL ?? "",
      },
    },
  ],
});
```

- [ ] **Step 3: Create `frontend/e2e/fixtures/sample.txt`**

```
Q3 Campaign Review — KPI Media
Date: Monday, 2026-05-25

John: Good morning everyone. Let's get started with the Q3 campaign review.
Sarah: Sure. The Meta ads performed well this month. CTR is up 18% from last month.
John: Great numbers. We need to update the creatives before Friday. Sarah, can you own that?
Sarah: Yes, I will have new creatives ready by Thursday EOD.
John: Perfect. We also decided to pause Google Ads until the new creatives are approved.
Mike: Agreed. I will coordinate with the design team on the Google assets next week.
John: One more thing. We need to submit the monthly report to the client by Monday.
Sarah: I will handle the report. Should be straightforward given the data we have.
John: Perfect. Let us wrap up. Main decisions: pause Google Ads, prioritize Meta creatives.
Mike: Sounds good. I will send a follow-up email to summarise the decisions.
John: Great. Thanks everyone. See you next week.
```

- [ ] **Step 4: Add e2e script to `frontend/package.json`**

```json
"scripts": {
  "e2e": "playwright test --config=e2e/playwright.config.ts --project=dev",
  "e2e:prod": "playwright test --config=e2e/playwright.config.ts --project=prod"
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/e2e/
git commit -m "test: add Playwright setup and fixtures"
```

---

## Task 8: process-paste E2E test

**Files:**
- Create: `frontend/e2e/tests/process-paste.spec.ts`

- [ ] **Step 1: Create `frontend/e2e/tests/process-paste.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

const MOCK_MEETING = {
  id: "test-meeting-id",
  title: "Q3 Review",
  raw_transcript: "sample",
  summary: "The team reviewed Q3 performance and made decisions about Meta and Google Ads.",
  created_at: Date.now(),
  action_items: [
    { id: "ai-1", meeting_id: "test-meeting-id", task: "Update Meta creatives", owner: "Sarah", deadline: "Friday", position: 0 },
  ],
  key_decisions: [
    { id: "kd-1", meeting_id: "test-meeting-id", text: "Pause Google Ads until creatives approved.", position: 0 },
  ],
};

const SAMPLE_TRANSCRIPT = `John: Good morning everyone. Let us review Q3.
Sarah: Meta ads are performing well. CTR up 18 percent.
John: Great. We need to update creatives before Friday. Sarah owns this.
Sarah: I will have new creatives by Thursday EOD.
John: We decided to pause Google Ads until new creatives are approved.
Mike: I will coordinate with design on Google assets next week.
John: Monthly report due to client by Monday. Sarah handles it.`;

test.describe("Process transcript by pasting", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // In dev project, mock the API so tests don't call real LLM
    if (baseURL?.includes("localhost")) {
      await page.route("**/api/process", async (route) => {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(MOCK_MEETING),
        });
      });
    }
    await page.goto("/");
  });

  test("shows empty form on load", async ({ page }) => {
    await expect(page.getByPlaceholder(/meeting title/i)).toBeEmpty();
  });

  test("processes transcript and shows digest report", async ({ page }) => {
    await page.getByPlaceholder(/meeting title/i).fill("Q3 Review");
    await page.getByPlaceholder(/paste your transcript/i).fill(SAMPLE_TRANSCRIPT);
    await page.getByRole("button", { name: /process transcript/i }).click();

    await expect(page.getByText("Meeting Digest Report")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("textarea").filter({ hasText: /Q3|performance|decisions/i })).toBeVisible();
    await expect(page.getByText(/action items/i)).toBeVisible();
    await expect(page.getByText(/key decisions/i)).toBeVisible();
  });

  test("URL updates to include meeting id after processing", async ({ page }) => {
    await page.getByPlaceholder(/meeting title/i).fill("Q3 Review");
    await page.getByPlaceholder(/paste your transcript/i).fill(SAMPLE_TRANSCRIPT);
    await page.getByRole("button", { name: /process transcript/i }).click();
    await page.waitForURL(/\?id=/, { timeout: 30_000 });
    expect(page.url()).toContain("?id=");
  });
});
```

- [ ] **Step 2: Run this test in dev mode (requires frontend + backend running)**

```bash
cd frontend && npm run e2e -- --grep "Process transcript by pasting"
```
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/tests/process-paste.spec.ts
git commit -m "test(e2e): add paste transcript flow"
```

---

## Task 9: process-upload E2E test

**Files:**
- Create: `frontend/e2e/tests/process-upload.spec.ts`

- [ ] **Step 1: Create `frontend/e2e/tests/process-upload.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";
import * as path from "path";

const MOCK_MEETING = {
  id: "upload-meeting-id",
  title: "Uploaded Meeting",
  raw_transcript: "sample",
  summary: "Meeting processed from uploaded file.",
  created_at: Date.now(),
  action_items: [],
  key_decisions: [],
};

test.describe("Process transcript by file upload", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    if (baseURL?.includes("localhost")) {
      await page.route("**/api/process", async (route) => {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(MOCK_MEETING),
        });
      });
    }
    await page.goto("/");
  });

  test("uploads a .txt file and populates transcript textarea", async ({ page }) => {
    const filePath = path.join(__dirname, "../fixtures/sample.txt");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    const textarea = page.getByPlaceholder(/paste your transcript/i);
    await expect(textarea).not.toBeEmpty({ timeout: 3000 });
  });

  test("processes uploaded transcript and shows digest report", async ({ page }) => {
    const filePath = path.join(__dirname, "../fixtures/sample.txt");
    await page.locator('input[type="file"]').setInputFiles(filePath);

    await page.getByPlaceholder(/meeting title/i).fill("Uploaded Meeting");
    await page.getByRole("button", { name: /process transcript/i }).click();

    await expect(page.getByText("Meeting Digest Report")).toBeVisible({ timeout: 30_000 });
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd frontend && npm run e2e -- --grep "Process transcript by file upload"
```
Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/tests/process-upload.spec.ts
git commit -m "test(e2e): add file upload transcript flow"
```

---

## Task 10: history E2E test

**Files:**
- Create: `frontend/e2e/tests/history.spec.ts`

- [ ] **Step 1: Create `frontend/e2e/tests/history.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

const MOCK_MEETINGS_LIST = [
  { id: "hist-1", title: "Sprint Planning", summary: "Team planned sprint goals.", created_at: Date.now() - 86400000 },
  { id: "hist-2", title: "Client Brief", summary: "Reviewed client requirements.", created_at: Date.now() - 172800000 },
];

const MOCK_MEETING_DETAIL = {
  id: "hist-1",
  title: "Sprint Planning",
  raw_transcript: "sample transcript",
  summary: "Team planned sprint goals.",
  created_at: Date.now() - 86400000,
  action_items: [
    { id: "ai-1", meeting_id: "hist-1", task: "Set sprint goals", owner: "Team", deadline: null, position: 0 },
  ],
  key_decisions: [
    { id: "kd-1", meeting_id: "hist-1", text: "Use 2-week sprints.", position: 0 },
  ],
};

test.describe("History flow", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    if (baseURL?.includes("localhost")) {
      await page.route("**/api/meetings", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_MEETINGS_LIST),
        });
      });
      await page.route("**/api/meetings/hist-1", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_MEETING_DETAIL),
        });
      });
    }
    await page.goto("/");
  });

  test("opens history dialog and shows meeting list", async ({ page }) => {
    await page.getByRole("button", { name: /history/i }).click();
    await expect(page.getByText("Meeting History")).toBeVisible();
    await expect(page.getByText("Sprint Planning")).toBeVisible();
    await expect(page.getByText("Client Brief")).toBeVisible();
  });

  test("loads meeting when clicking Open", async ({ page }) => {
    await page.getByRole("button", { name: /history/i }).click();
    await page.getByText("Sprint Planning")
      .locator("..")
      .getByRole("button", { name: /open/i })
      .click();

    await expect(page.getByText("Meeting Digest Report")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByDisplayValue("Sprint Planning")).toBeVisible();
    expect(page.url()).toContain("?id=hist-1");
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd frontend && npm run e2e -- --grep "History flow"
```
Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/tests/history.spec.ts
git commit -m "test(e2e): add history flow"
```

---

## Task 11: export E2E test

**Files:**
- Create: `frontend/e2e/tests/export.spec.ts`

- [ ] **Step 1: Create `frontend/e2e/tests/export.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

const MOCK_MEETING = {
  id: "export-test-id",
  title: "Export Test Meeting",
  raw_transcript: "sample",
  summary: "Summary for export testing purposes.",
  created_at: Date.now(),
  action_items: [
    { id: "ai-1", meeting_id: "export-test-id", task: "Follow up with client", owner: "Alice", deadline: "Monday", position: 0 },
  ],
  key_decisions: [
    { id: "kd-1", meeting_id: "export-test-id", text: "Approved Q4 budget.", position: 0 },
  ],
};

test.describe("Export flows", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    if (baseURL?.includes("localhost")) {
      await page.route("**/api/process", async (route) => {
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(MOCK_MEETING) });
      });
    }
    await page.goto("/");
    // Process a meeting first
    await page.getByPlaceholder(/meeting title/i).fill("Export Test Meeting");
    await page.getByPlaceholder(/paste your transcript/i).fill("x".repeat(250));
    await page.getByRole("button", { name: /process transcript/i }).click();
    await page.getByText("Meeting Digest Report").waitFor({ timeout: 30_000 });
  });

  test("downloads Markdown file", async ({ page }) => {
    await page.getByRole("button", { name: /export digest/i }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByText("Markdown File").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.md$/);
  });

  test("downloads PDF file", async ({ page }) => {
    await page.getByRole("button", { name: /export digest/i }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByText("PDF Document").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test("copies markdown when clicking Google Docs", async ({ page }) => {
    await page.getByRole("button", { name: /export digest/i }).click();
    await page.getByText("Google Docs").click();
    await expect(page.getByText("Copied!")).toBeVisible({ timeout: 3000 });
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd frontend && npm run e2e -- --grep "Export flows"
```
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/tests/export.spec.ts
git commit -m "test(e2e): add export flows"
```

---

## Task 12: error cases E2E test

**Files:**
- Create: `frontend/e2e/tests/errors.spec.ts`

- [ ] **Step 1: Create `frontend/e2e/tests/errors.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Error handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows error for transcript_too_short (under 200 chars)", async ({ page }) => {
    await page.getByPlaceholder(/meeting title/i).fill("Short Test");
    await page.getByPlaceholder(/paste your transcript/i).fill("This is too short.");
    await page.getByRole("button", { name: /process transcript/i }).click();
    await expect(page.getByText(/too short/i)).toBeVisible({ timeout: 5000 });
  });

  test("shows error for transcript_too_long (over 100k chars)", async ({ page, baseURL }) => {
    if (baseURL?.includes("localhost")) {
      // In dev, mock the 422 response
      await page.route("**/api/process", async (route) => {
        await route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({ error: "transcript_too_long", message: "transcript_too_long" }),
        });
      });
    }
    await page.getByPlaceholder(/meeting title/i).fill("Long Test");
    await page.getByPlaceholder(/paste your transcript/i).fill("x".repeat(250));
    await page.getByRole("button", { name: /process transcript/i }).click();
    await expect(page.getByText(/too long/i)).toBeVisible({ timeout: 10_000 });
  });

  test("New Meeting button clears form and URL", async ({ page }) => {
    // Mock process and load a meeting
    await page.route("**/api/process", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "reset-test",
          title: "Reset Test",
          raw_transcript: "sample",
          summary: "Summary.",
          created_at: Date.now(),
          action_items: [],
          key_decisions: [],
        }),
      });
    });

    await page.getByPlaceholder(/meeting title/i).fill("Reset Test");
    await page.getByPlaceholder(/paste your transcript/i).fill("x".repeat(250));
    await page.getByRole("button", { name: /process transcript/i }).click();
    await page.getByText("Meeting Digest Report").waitFor({ timeout: 30_000 });

    await page.getByRole("button", { name: /new meeting/i }).click();

    await expect(page.getByPlaceholder(/meeting title/i)).toBeEmpty();
    await expect(page.getByText("Meeting Digest Report")).not.toBeVisible();
    expect(page.url()).not.toContain("?id=");
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd frontend && npm run e2e -- --grep "Error handling"
```
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/tests/errors.spec.ts
git commit -m "test(e2e): add error handling tests"
```

---

## Task 13: Root scripts

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Check if root `package.json` exists**

```bash
cat package.json
```

- [ ] **Step 2: Add test scripts to root `package.json`**

If root `package.json` already exists, add these scripts. If not, create it:

```json
{
  "scripts": {
    "test:unit": "cd backend && npx vitest run",
    "test:e2e:dev": "cd frontend && npm run e2e",
    "test:e2e:prod": "cd frontend && npm run e2e:prod",
    "test:all": "npm run test:unit && npm run test:e2e:dev"
  }
}
```

- [ ] **Step 3: Verify all unit tests still pass**

```bash
npm run test:unit
```
Expected: ~31 tests, all passing.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: add unified test scripts to root"
```

---

## Task 14: GitHub Actions CI

**Files:**
- Create: `.github/workflows/test-unit.yml`
- Create: `.github/workflows/test-e2e.yml`

- [ ] **Step 1: Create `.github/workflows/test-unit.yml`**

```yaml
name: Unit Tests

on:
  push:
    branches: ["**"]
  pull_request:
    branches: ["**"]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
          cache-dependency-path: backend/package-lock.json
      - name: Install backend deps
        run: cd backend && npm install
      - name: Run unit tests
        run: cd backend && npx vitest run --reporter=verbose
```

- [ ] **Step 2: Create `.github/workflows/test-e2e.yml`**

```yaml
name: E2E Tests (Production)

on:
  push:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json
      - name: Install frontend deps
        run: cd frontend && npm install
      - name: Install Playwright browsers
        run: cd frontend && npx playwright install --with-deps chromium
      - name: Run E2E tests
        run: cd frontend && npm run e2e:prod
        env:
          PROD_URL: ${{ secrets.PROD_URL }}
      - name: Upload screenshots on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-screenshots
          path: frontend/test-results/
```

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add unit and E2E GitHub Actions workflows"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Backend unit: process (7 cases), meetings (8 cases), action-items (8 cases), key-decisions (7 cases)
- ✅ E2E: paste flow, upload flow, history flow, export (MD/PDF/copy), error cases (too short, too long, new meeting)
- ✅ Dev vs prod projects in playwright.config.ts
- ✅ GitHub Actions for unit (every push) and E2E (push to main)
- ✅ `transcript_too_short`, `transcript_too_long`, `llm_invalid_output` all covered
- ✅ LLM retry logic covered in Task 3

**Type consistency:**
- `seedMeeting()` used consistently across tasks 4, 5, 6
- `VALID_LLM_OUTPUT` shape matches `LlmOutputT` from `validation.ts`
- `insertMeetingWithChildren` signature matches `db.ts`

**No placeholders:** confirmed — every step has actual code.
