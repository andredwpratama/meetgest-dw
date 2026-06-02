# CLAUDE.md

Guidance for Claude Code working in this repository.

Source of truth for requirements: `Case_Study.md`. If anything below contradicts the case study, the case study wins — fix this file.

## Project Overview

Meeting Transcript Processor — an internal web tool for KPI Media (performance marketing agency). The team runs daily client briefs, campaign reviews, and syncs; meeting notes rarely get written up consistently. This tool turns a raw transcript into a structured **Summary**, **Action Items**, and **Key Decisions** an operator can edit and share.

Optimized for: reliable AI extraction · clean editing UX · first-class observability · deployment simplicity.

---

# Core Product Features

## 1. Transcript Processing (the main workflow)

A single processing page where the user can:

- paste a raw transcript into a textarea, **or** upload a `.txt` file
- enter a meeting title
- click **Process Transcript**

The frontend sends the transcript to the backend, which:

1. validates the request (zod)
2. calls the LLM
3. validates the AI response (zod)
4. persists the structured result to D1
5. returns the processed meeting

**Why this shape:** the assignment focuses on turning raw transcripts into structured operational output. Optimized for speed and simplicity, not complex ingestion pipelines.

**Intentionally excluded:** audio uploads, transcription services, Zoom/Meet/Slack integrations, DOCX/PDF parsing. They grow scope without improving rubric outcomes.

---

# AI Output Structure

The LLM returns JSON with three fields.

## Summary

- 3–5 sentences
- focuses on outcomes and decisions, not a chronological play-by-play
- written so someone who missed the meeting can catch up in 30 seconds

## Action Items

Each item:

```json
{ "task": "Update Meta ad creatives", "owner": "Sarah", "deadline": "Friday" }
```

Prompt-enforced rules:

- never invent owners — return `null` if not mentioned
- never invent deadlines — return `null` if not mentioned
- task text stays close to how it was phrased in the meeting

**Why:** weak instructions make LLMs hallucinate assignments and dates. Strict null-on-missing is the right default for an operational tool.

## Key Decisions

A short list of strings, separate from action items.

> "Decided to pause Google Ads until new creatives are approved."

**Why split decisions from actions:** decisions are already settled; actions still need execution. Mixing them is the #1 readability problem in auto-generated notes.

---

# Human Review & Editing

After processing, **every field is editable inline**: title, summary, each action item (task / owner / deadline), each key decision. New rows can be added; existing rows can be deleted or reordered.

- inline editing (no modal)
- debounced auto-save (500 ms)
- PATCH/POST/DELETE persisted to D1
- optimistic UI; on error, toast + re-fetch

**Why:** AI extraction is probabilistic — names, deadlines, and responsibilities get misidentified. This is designed as an **AI-assisted** workflow, not an autonomous one.

---

# Export Functionality

Builds from the **current edited state**, not the raw LLM output.

## Markdown (primary)

- deterministic, readable, fast, satisfies the rubric
- sections: Title · Date · Summary · Action Items · Key Decisions
- downloads as `<slug>.md`

## PDF (secondary)

- generated client-side with `jspdf`
- **Tradeoff:** typography is plainer than an HTML-to-PDF pipeline. Acceptable for an internal tool; avoids hauling in headless-browser infrastructure.

**Priority call:** a reliable AI workflow matters more than perfect PDF rendering for this assessment.

---

# Meeting History

Every processed transcript persists to D1. `/history` shows:

- title
- processed date
- click to re-open in the processor (editable + re-exportable)

**Why:** meeting transcripts become operational records, not one-shot AI outputs.

---

# LLM Observability — Langfuse

Every LLM call is traced via **Langfuse**. Captured per call:

- full prompt / messages
- model output (raw)
- model name
- input tokens · output tokens
- latency
- retry events (e.g. JSON-validation retry)
- validation failures

**Why Langfuse instead of a custom DB table:**

- purpose-built for LLM systems — input/output diff, token cost rollups, prompt versioning out of the box
- cleaner debugging workflow during the interview demo
- no in-app `/logs` page to design, build, and style

**Tradeoff:** one extra service in the stack (env vars + SDK). Worth it.

**Submission artifact:** screenshot of a recent trace from the Langfuse dashboard (input, output, model, tokens, latency).

---

# AI & Security Decisions

## Provider: OpenRouter

- easy model switching (single env change)
- centralized provider abstraction
- no vendor lock-in to a specific LLM API

## Model: `openai/gpt-oss-120b:free`

**Gain:** zero API cost, no billing friction for public deployment, capable enough for structured extraction.

**Tradeoff:** weaker than premium models on ambiguous speaker attribution, occasional malformed JSON, less reliable on long transcripts.

**Mitigations stack:** strict JSON-mode prompt → zod validation → retry once on invalid output → human review.

**Why this fits the rubric:** the assessment grades engineering decisions and AI integration quality, not raw model intelligence. Reliability is handled at the system level.

## API Key Security

`OPENROUTER_API_KEY` lives only as a Cloudflare Worker secret. The frontend never talks to OpenRouter directly.

```
Frontend → Hono API → OpenRouter → response → validation → persistence → frontend
```

---

# Technical Stack & Architecture Decisions

## Backend: Hono on Cloudflare Workers

**Gain:** lightweight, TS-native, fast cold starts, deploys with one command, native D1 binding.

**Tradeoff:** edge runtime (no Node APIs like `fs`/`Buffer`), debugging is harder than a local Node server.

**Fit:** the backend's job is request validation, LLM orchestration, persistence, exports, and observability — all serverless-friendly.

## Database: Cloudflare D1 (SQLite)

**Gain:** integrated Worker binding (no connection pool), free-tier friendly, schema is one file.

**Tradeoff:** SQLite feature set (no `jsonb`, no FTS by default). Fine for this scope.

## Frontend: Vite + React + TailwindCSS + shadcn/ui

| Piece | Why |
|---|---|
| React | Component-driven UI; explicitly requested |
| Vite | Fast dev server and build; SPA-friendly |
| Tailwind | Rapid iteration, consistent styling, no CSS bikeshedding |
| shadcn/ui | Accessible, customizable primitives (Button, Input, Textarea, Dialog) without a heavyweight component-library lock-in |

**Tradeoffs:** Vite has no SSR (not needed for an internal tool); Tailwind markup is verbose; shadcn/ui is copy-into-repo, not a package (slightly more setup, full styling control).

## Validation: Zod

Validates:

- API request bodies
- the **LLM's JSON output** (the critical one)
- frontend form state

Flow on bad LLM output: `parse → fail → retry once → fail → 502 llm_invalid_output`.

**Why:** LLMs lie. zod is the safety net that turns "model returned garbage" into a predictable error path.

---

# Data Model (D1 / SQLite)

Normalized — three tables. Inline editing PATCHes individual rows instead of replacing JSON blobs.

```sql
CREATE TABLE meetings (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  raw_transcript TEXT NOT NULL,
  summary        TEXT NOT NULL,
  created_at     INTEGER NOT NULL              -- unix ms
);

CREATE TABLE action_items (
  id         TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  task       TEXT NOT NULL,
  owner      TEXT,                              -- null if not mentioned
  deadline   TEXT,                              -- null if not mentioned
  position   INTEGER NOT NULL                   -- preserves order
);

CREATE TABLE key_decisions (
  id         TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  position   INTEGER NOT NULL
);

CREATE INDEX idx_meetings_created      ON meetings(created_at DESC);
CREATE INDEX idx_action_items_meeting  ON action_items(meeting_id, position);
CREATE INDEX idx_key_decisions_meeting ON key_decisions(meeting_id, position);
```

**Why normalized over JSON blobs:** every UI edit is a single-row update, reordering is a single `position` change, and adding/deleting rows doesn't require read-modify-write of the whole list. The cost is more API surface — accepted.

---

# API Design

| Method | Path | Purpose |
|---|---|---|
| POST   | `/api/process`                          | validate → LLM → persist meeting + child rows → return full result |
| GET    | `/api/meetings`                         | history list (id, title, created_at, summary) |
| GET    | `/api/meetings/:id`                     | full meeting with action items + decisions |
| PATCH  | `/api/meetings/:id`                     | edit `title` and/or `summary` |
| POST   | `/api/meetings/:id/action-items`        | add an action item |
| PATCH  | `/api/action-items/:id`                 | edit `task` / `owner` / `deadline` / `position` |
| DELETE | `/api/action-items/:id`                 | remove an action item |
| POST   | `/api/meetings/:id/key-decisions`       | add a decision |
| PATCH  | `/api/key-decisions/:id`                | edit `text` / `position` |
| DELETE | `/api/key-decisions/:id`                | remove a decision |

**Error shape (all non-2xx):** `{ "error": "machine_code", "message": "human readable" }`.

**Distinct error codes surfaced to the UI:**
`transcript_too_short` (422) · `transcript_too_long` (422) · `llm_invalid_output` (502, after one retry) · `not_found` (404).

---

# Reliability Decisions

## Retry once on invalid AI output

**Why:** free/open models occasionally produce malformed JSON.
**Tradeoff:** one extra LLM call billed (zero cost on free tier) + a few seconds of latency.
**Why acceptable:** large reliability win for trivial implementation cost.

## Human-in-the-loop editing

**Why:** AI extraction is not perfectly reliable, especially on owner attribution and deadlines. The product assumes operators review, adjust, and confirm before sharing.

## Transcript bounds

- minimum 200 chars → `422 transcript_too_short`
- maximum 100k chars → `422 transcript_too_long` (well inside the model's context, but enforces a sane upper bound)

---

# Features Intentionally Excluded

Not implemented:

- authentication
- audio transcription
- vector DBs / embeddings / RAG
- streaming LLM responses
- real-time collaboration
- transcript chunking
- search on history
- request caching
- external file storage
- re-processing a saved meeting

**Reason:** each adds infra complexity without improving the core evaluation criteria (extraction reliability, editing UX, observability, clean architecture, deploy simplicity).

---

# Repo Layout

```
backend/                        Hono Worker
  src/
    index.ts                    app entry, /api/* routes
    routes/
      process.ts                POST /api/process
      meetings.ts               GET list / GET :id / PATCH :id
      action-items.ts           POST /:meetingId / PATCH :id / DELETE :id
      key-decisions.ts          POST /:meetingId / PATCH :id / DELETE :id
    lib/
      llm.ts                    OpenRouter call + Langfuse instrumentation
      prompt.ts                 system prompt (single source)
      db.ts                     D1 helpers (raw SQL, no ORM)
      validation.ts             zod schemas
  schema.sql                    D1 schema
  wrangler.toml                 D1 binding + vars (no secrets in file)
frontend/
  src/
    pages/
      ProcessorPage.tsx         /
      HistoryPage.tsx           /history
    components/
      Layout.tsx                sidebar nav + content
      TranscriptInput.tsx       textarea + drag-drop .txt upload
      ResultsPanel.tsx          editable summary + lists
      ActionItemEditor.tsx      inline editor: task, owner, deadline
      KeyDecisionEditor.tsx     inline editor
      ExportMenu.tsx            Markdown / PDF
      ui/                       shadcn/ui primitives
    lib/
      api.ts                    fetch wrapper, base = VITE_API_URL
      export.ts                 toMarkdown / toPdf
    App.tsx                     router
Case_Study.md                   source of truth for requirements
```

---

# Development Commands

## Backend (`/backend`)
```bash
npx wrangler d1 create meeting-processor-db
npx wrangler d1 execute meeting-processor-db --local  --file=schema.sql
npx wrangler d1 execute meeting-processor-db --remote --file=schema.sql
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put LANGFUSE_PUBLIC_KEY
npx wrangler secret put LANGFUSE_SECRET_KEY
npx wrangler dev                              # :8787
npx wrangler deploy
```

## Frontend (`/frontend`)
```bash
echo "VITE_API_URL=http://localhost:8787" > .env
npm run dev                                   # :5173
npm run build                                 # → dist/
```

---

# Environment

| Var | Where | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY`  | Worker secret    | LLM key — server-side only, never in the frontend bundle |
| `LANGFUSE_PUBLIC_KEY` | Worker secret    | Langfuse SDK auth |
| `LANGFUSE_SECRET_KEY` | Worker secret    | Langfuse SDK auth |
| `LANGFUSE_HOST`       | Worker `vars`    | e.g. `https://cloud.langfuse.com` (or self-host URL) |
| `VITE_API_URL`        | frontend `.env`  | Worker base URL |

---

# Conventions

- No ORM — raw SQL via `env.DB.prepare(...).bind(...).first() / .all() / .run()`
- No TypeScript `any` — use `unknown` + zod at boundaries
- Error shape `{ error, message }` on every non-2xx
- Tailwind utilities + shadcn/ui only; no custom CSS beyond `index.css` reset
- React state: `useState` + `useEffect`; no Zustand / Redux
- All frontend HTTP through `lib/api.ts`
- Single source of truth for the LLM prompt: `backend/src/lib/prompt.ts`