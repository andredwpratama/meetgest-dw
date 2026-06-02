# Automated Testing Design
**Date:** 2026-05-30
**Project:** Meeting Transcript Processor (KPI Media)

---

## Overview

Add a complete automated test suite covering backend API unit tests and frontend E2E tests with Playwright. Tests must run against both local dev and production environments.

---

## Architecture: Option B — Split Workspaces

```
backend/
  tests/
    fixtures/
      llm-responses.ts     # per-test mock LLM payloads
      transcript.ts        # sample transcript string (>200 chars)
    routes/
      process.test.ts
      meetings.test.ts
      action-items.test.ts
      key-decisions.test.ts
    vitest.config.ts

frontend/
  e2e/
    fixtures/
      sample.txt           # sample transcript file for upload test
    tests/
      process-paste.spec.ts
      process-upload.spec.ts
      history.spec.ts
      export.spec.ts
      errors.spec.ts
    playwright.config.ts

.github/
  workflows/
    test-unit.yml
    test-e2e.yml
```

---

## Section 1 — Backend Unit Tests

### Stack
- **Vitest** + `@cloudflare/vitest-pool-workers`
- Runs inside actual Cloudflare Workers runtime (Miniflare)
- Real D1 local database — no mocking the DB layer
- LLM mocked via `vi.stubGlobal("fetch", ...)` per-test

### LLM Mock Strategy
Each test stubs `fetch` globally to intercept calls to `openrouter.ai` and `langfuse`. This allows each test to control:
- Valid structured JSON response
- Malformed JSON (first attempt) then valid (second attempt) — tests retry logic
- Malformed JSON both attempts — tests 502 error path
- HTTP 500 from OpenRouter — tests error propagation

### Test Coverage

#### `process.test.ts`
| Case | Expected |
|---|---|
| Valid title + transcript (≥200 chars) | 201, returns meeting with summary/actions/decisions |
| Transcript < 200 chars | 422 `transcript_too_short` |
| Transcript > 100,000 chars | 422 `transcript_too_long` |
| Missing title | 400 `invalid_request` |
| LLM returns invalid JSON once, valid on retry | 201 (retry succeeds) |
| LLM returns invalid JSON both attempts | 502 `llm_invalid_output` |

#### `meetings.test.ts`
| Case | Expected |
|---|---|
| GET /meetings empty | 200, empty array |
| GET /meetings after insert | 200, array with item |
| GET /meetings/:id found | 200, full meeting object |
| GET /meetings/:id not found | 404 `not_found` |
| PATCH /meetings/:id title only | 200, updated title |
| PATCH /meetings/:id summary only | 200, updated summary |
| PATCH /meetings/:id both fields | 200, both updated |
| PATCH /meetings/:id not found | 404 `not_found` |
| PATCH /meetings/:id empty body | 400 `no_changes` |

#### `action-items.test.ts`
| Case | Expected |
|---|---|
| POST valid item to existing meeting | 201, item returned |
| POST to non-existent meeting | 404 `not_found` |
| POST invalid body (missing task) | 400 `invalid_body` |
| PATCH task field | 200, updated |
| PATCH owner to null | 200, owner is null |
| PATCH position | 200, position updated |
| PATCH non-existent id | 404 `not_found` |
| DELETE existing item | 204 |
| DELETE non-existent item | 404 `not_found` |

#### `key-decisions.test.ts`
| Case | Expected |
|---|---|
| POST valid decision to existing meeting | 201, decision returned |
| POST to non-existent meeting | 404 `not_found` |
| POST invalid body (missing text) | 400 `invalid_body` |
| PATCH text field | 200, updated |
| PATCH position | 200, position updated |
| PATCH non-existent id | 404 `not_found` |
| DELETE existing decision | 204 |
| DELETE non-existent decision | 404 `not_found` |

---

## Section 2 — Playwright E2E Tests

### Stack
- **Playwright** with TypeScript
- Two projects: `dev` (localhost) and `prod` (deployed URL)
- Dev tests use `page.route()` to mock API responses — no real LLM calls, fast
- Prod tests hit real backend — real LLM calls, validates full stack

### Configuration
```ts
// playwright.config.ts
projects: [
  {
    name: "dev",
    use: { baseURL: "http://localhost:5173" },
    testMatch: "**/*.spec.ts",
  },
  {
    name: "prod",
    use: { baseURL: process.env.PROD_URL ?? "" },
    testMatch: "**/*.spec.ts",
  },
]
```

### Test Cases

#### `process-paste.spec.ts` — Paste transcript happy path
1. Open home page → form is empty
2. Fill title input
3. Paste transcript (≥200 chars) into textarea
4. Click "Process Transcript"
5. Assert: loading spinner appears then disappears
6. Assert: "Meeting Digest Report" card is visible
7. Assert: summary textarea has content
8. Assert: at least one action item row exists
9. Assert: at least one key decision exists
10. Assert: URL contains `?id=`

#### `process-upload.spec.ts` — Upload .txt file
1. Open home page
2. Fill title input
3. Upload `fixtures/sample.txt` via file input
4. Assert: transcript textarea is populated from file content
5. Click "Process Transcript"
6. Assert: results panel appears with content

#### `history.spec.ts` — History flow
1. Process a transcript (or intercept API to return mock meeting list)
2. Click "History" button
3. Assert: history dialog opens
4. Assert: at least one meeting row is visible with title and date
5. Click "Open" on a meeting
6. Assert: dialog closes
7. Assert: results panel loads the selected meeting
8. Assert: URL contains `?id=`

#### `export.spec.ts` — Export flows
1. Process a transcript to get results
2. Click "Export Digest"
3. Assert: export dialog opens with 3 options
4. **MD export:** click "Markdown File" → assert file download starts (`*.md`)
5. **PDF export:** click "Export Digest" again → click "PDF Document" → assert file download starts (`*.pdf`)
6. **Copy (Google Docs):** click "Export Digest" again → click "Google Docs" → assert button shows "Copied!" state

#### `errors.spec.ts` — Error cases
1. **Too short:** Enter title + 50-char transcript → click Process → assert error message contains "too short"
2. **Too long:** Enter title + 100,001-char transcript → click Process → assert error message contains "too long"
3. **New Meeting button:** Process transcript → results appear → click "New Meeting" → assert form is empty + URL has no `?id=`
4. **Refresh clears params:** Process transcript → URL has `?id=` → simulate page reload → assert URL is clean `localhost:5173`

---

## Section 3 — Scripts & CI

### Root package.json scripts
```json
{
  "scripts": {
    "test:unit": "cd backend && vitest run",
    "test:e2e:dev": "cd frontend && npx playwright test --project=dev",
    "test:e2e:prod": "cd frontend && npx playwright test --project=prod",
    "test:all": "npm run test:unit && npm run test:e2e:dev"
  }
}
```

### GitHub Actions

#### `.github/workflows/test-unit.yml`
- Trigger: every push and PR to any branch
- Steps: install deps → run `vitest run` in backend
- Blocks PR merge on failure

#### `.github/workflows/test-e2e.yml`
- Trigger: push to `main` branch (post-deploy)
- Steps: install deps → install Playwright browsers → run prod E2E
- Uses `PROD_URL` GitHub Actions secret
- On failure: upload screenshot artifacts, annotate PR

### Environment Variables
| Variable | Used in | Purpose |
|---|---|---|
| `PROD_URL` | GitHub Actions secret | Base URL for prod E2E tests |
| `VITE_API_URL` | frontend `.env` | API base URL for dev E2E |

---

## Decisions & Tradeoffs

| Decision | Rationale |
|---|---|
| Real D1 in unit tests | Catches real SQL errors, constraint violations, migration issues. Mock DB would miss these. |
| Mock LLM per-test | LLM calls are slow, non-deterministic, and cost tokens. Mocking isolates the API logic cleanly. |
| Mock API in dev E2E | Dev E2E tests run fast without LLM latency, enabling quick feedback loop. |
| Real LLM in prod E2E | Prod tests validate the full stack including LLM extraction quality. |
| Playwright over Cypress | Better TypeScript support, faster, and `page.route()` is more ergonomic for API mocking. |
