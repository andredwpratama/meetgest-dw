# MeetGest — AI Meeting Transcript Processor

> Turn raw meeting transcripts into structured summaries, action items, and key decisions — instantly.

Built for KPI Media as a take-home assessment for the Junior AI Engineer role.

---

## What It Does

Paste a meeting transcript (or upload a `.txt` file), click **Generate Digest**, and get:

- **Summary** — 3–5 sentences capturing what was decided and why
- **Action Items** — tasks with owner and deadline, never invented if not mentioned
- **Key Decisions** — settled choices, separated from tasks

Every field is editable inline. Changes are auto-saved. Export to Markdown, PDF, or copy to Google Docs.

---

## Demo

![Processor page](frontend\public\page.png)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TailwindCSS + shadcn/ui |
| Backend | Hono on Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| LLM Provider | OpenRouter (`openai/gpt-oss-120b:free`) |
| Observability | Langfuse (prompt tracing, token counts, latency) |
| Validation | Zod (request bodies + LLM output) |
| Unit Tests | Vitest + `@cloudflare/vitest-pool-workers` |
| E2E Tests | Playwright (dev mocked + prod real) |

---

## Project Structure

```
meetgest-dw/
├── backend/                  Hono Worker
│   ├── src/
│   │   ├── index.ts          App entry + route registration
│   │   ├── routes/
│   │   │   ├── process.ts    POST /api/process — LLM call + persist
│   │   │   ├── meetings.ts   GET list, GET :id, PATCH :id
│   │   │   ├── action-items.ts
│   │   │   └── key-decisions.ts
│   │   └── lib/
│   │       ├── llm.ts        OpenRouter call + retry + Langfuse tracing
│   │       ├── prompt.ts     System prompt (single source of truth)
│   │       ├── db.ts         D1 helpers (raw SQL, no ORM)
│   │       └── validation.ts Zod schemas
│   ├── tests/
│   │   ├── setup.ts          D1 schema setup + test isolation
│   │   ├── fixtures/         Sample transcript + mock LLM responses
│   │   └── routes/           Unit tests for all 4 route modules
│   └── schema.sql            D1 schema
│
├── frontend/                 Vite + React SPA
│   ├── src/
│   │   ├── pages/
│   │   │   └── ProcessorPage.tsx   Main processing page
│   │   ├── components/
│   │   │   ├── TranscriptInput.tsx  Title + textarea + file upload
│   │   │   ├── ResultsPanel.tsx     Editable digest + export
│   │   │   ├── HistoryDialog.tsx    Past meetings browser
│   │   │   ├── ActionItemEditor.tsx Inline row editor
│   │   │   ├── KeyDecisionEditor.tsx
│   │   │   └── ExportDialog.tsx    MD / PDF / Google Docs
│   │   └── lib/
│   │       ├── api.ts        Fetch wrapper (base = VITE_API_URL)
│   │       ├── export.ts     toMarkdown + downloadPdf (jsPDF)
│   │       └── types.ts      Shared TypeScript types
│   └── e2e/
│       ├── playwright.config.ts   Dev + prod projects
│       ├── fixtures/sample.txt
│       └── tests/                 5 E2E spec files
│
├── .github/workflows/
│   ├── test-unit.yml         Runs on every push
│   └── test-e2e.yml          Runs on push to main (uses PROD_URL secret)
│
├── docs/
│   └── submission/
│       └── technical-decisions.md  Full reasoning behind every choice
└── package.json              Root scripts: test:unit, test:e2e:dev, test:all
```

---

## Local Development

### Prerequisites

- Node.js 20+
- Wrangler CLI: `npm install -g wrangler`
- Cloudflare account (free tier is fine)

### 1. Clone and install

```bash
git clone https://github.com/andredwpratama/meetgest-dw.git
cd meetgest-dw
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 2. Set up the database

```bash
cd backend

# Create the D1 database on Cloudflare
npx wrangler d1 create meetgest-db

# Apply schema locally
npx wrangler d1 execute meetgest-db --local --file=schema.sql

# Apply schema to production
npx wrangler d1 execute meetgest-db --remote --file=schema.sql
```

### 3. Set secrets

```bash
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put LANGFUSE_PUBLIC_KEY
npx wrangler secret put LANGFUSE_SECRET_KEY
```

### 4. Configure frontend

```bash
cd frontend
echo "VITE_API_URL=http://localhost:8787" > .env
```

### 5. Start both servers

```bash
# Terminal 1 — backend
cd backend && npx wrangler dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open `http://localhost:5173`

---

## Environment Variables

| Variable | Location | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | Worker secret | LLM API key — server-side only |
| `LANGFUSE_PUBLIC_KEY` | Worker secret | Langfuse SDK auth |
| `LANGFUSE_SECRET_KEY` | Worker secret | Langfuse SDK auth |
| `LANGFUSE_HOST` | `wrangler.toml` vars | Langfuse base URL |
| `VITE_API_URL` | `frontend/.env` | Backend base URL |

---

## Running Tests

### Backend Unit Tests

Runs inside a real Miniflare Workers sandbox with a local D1 database. No mocks for the DB layer — only the LLM is mocked.

```bash
cd backend
npm test

# or verbose:
npx vitest run --reporter=verbose
```

**33 tests across 4 files:**

| File | Tests |
|---|---|
| `process.test.ts` | Valid input, too short, too long, missing title, retry, double fail (502) |
| `meetings.test.ts` | GET list, GET :id, PATCH title, PATCH summary, PATCH both, 400 empty body, 404s |
| `action-items.test.ts` | POST, POST 404, POST 400, PATCH task, PATCH null owner, PATCH position, DELETE, DELETE 404 |
| `key-decisions.test.ts` | POST, POST 404, POST 400, PATCH text, PATCH position, PATCH 404, DELETE, DELETE 404 |

### E2E Tests (Playwright)

Requires both servers running.

```bash
# Start backend + frontend first (see Local Development above)

# Dev E2E — API mocked, no real LLM calls
cd frontend && npm run e2e

# Prod E2E — real backend, real LLM
cd frontend && PROD_URL=https://your-deployed-url.workers.dev npm run e2e:prod
```

**5 spec files:**

| File | Covers |
|---|---|
| `process-paste.spec.ts` | Empty form on load, paste transcript, URL update |
| `process-upload.spec.ts` | Upload `.txt` file populates textarea, processes |
| `history.spec.ts` | Open history dialog, load a past meeting |
| `export.spec.ts` | Markdown download, PDF download, Google Docs copy |
| `errors.spec.ts` | Too-short warning, too-long 422 error, New Meeting reset |

### All tests from root

```bash
npm run test:unit       # backend only
npm run test:e2e:dev    # E2E dev (needs servers)
npm run test:all        # unit + E2E dev
```

---

## Deployment

```bash
# Deploy backend
cd backend && npx wrangler deploy

# Build and deploy frontend (Cloudflare Pages or any static host)
cd frontend && npm run build
# upload dist/ to Cloudflare Pages / Netlify / Vercel
```

For GitHub Actions CI:
- `test-unit.yml` — runs on every push and PR
- `test-e2e.yml` — runs on push to `main`, add `PROD_URL` in repository secrets

---

## Key Design Decisions

Full reasoning in [`docs/submission/technical-decisions.md`](docs/submission/technical-decisions.md).

Brief version:

- **Real D1 in unit tests** — catches actual SQL errors. Mock DB would miss schema bugs.
- **LLM mocked in unit tests** — fast, free, deterministic. Real calls in prod E2E.
- **Retry once on bad LLM output** — fixes ~90% of malformed JSON with minimal cost.
- **Normalized tables, not JSON blobs** — each inline edit is one PATCH to one row.
- **Langfuse over custom logging** — purpose-built for LLM traces, no UI to build.
- **No auth** — internal tool, easy to add Cloudflare Access later without code changes.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/process` | Validate → LLM → persist → return full meeting |
| `GET` | `/api/meetings` | List meetings (id, title, summary, created_at) |
| `GET` | `/api/meetings/:id` | Full meeting with action items + decisions |
| `PATCH` | `/api/meetings/:id` | Update title and/or summary |
| `POST` | `/api/meetings/:id/action-items` | Add an action item |
| `PATCH` | `/api/action-items/:id` | Edit task / owner / deadline / position |
| `DELETE` | `/api/action-items/:id` | Remove an action item |
| `POST` | `/api/meetings/:id/key-decisions` | Add a key decision |
| `PATCH` | `/api/key-decisions/:id` | Edit text / position |
| `DELETE` | `/api/key-decisions/:id` | Remove a key decision |

**Error shape (all non-2xx):**
```json
{ "error": "machine_code", "message": "human readable description" }
```

**Error codes:**
- `transcript_too_short` — 422
- `transcript_too_long` — 422
- `llm_invalid_output` — 502 (after one retry)
- `not_found` — 404
- `no_changes` — 400

---

## Author

Andre Pratama — [andredwpratama@gmail.com](mailto:andredwpratama@gmail.com)
