# Technical Decisions — Why I Built It This Way

This document explains every major technical choice I made in this project.
Written honestly, as if answering interview questions.

---

## 1. Why Cloudflare Workers + Hono instead of a regular Node.js server?

**Short answer:** It deploys with one command, costs nothing at this scale, and starts instantly.

The assignment said "internal tool for KPI Media." That means I don't need a full backend server running 24/7. Cloudflare Workers is serverless — it only runs when a request comes in, and it deploys globally in seconds.

Hono is a tiny web framework built specifically for edge runtimes like Workers. It works exactly like Express (routes, middleware, JSON responses), but it's designed for the environment I'm deploying to. Using Express on Workers would require workarounds because Express depends on Node.js APIs that don't exist on the edge.

**Why not a plain Node server on Railway or Render?**
I would need to think about containers, ports, restart policies, health checks, and cold start delays. With Workers, none of that exists. The tradeoff is that Workers has no Node.js filesystem APIs — but this app doesn't need them.

---

## 2. Why Cloudflare D1 instead of PostgreSQL or Supabase?

**Short answer:** D1 is a SQLite database that's built into Cloudflare — no separate connection, no credentials, no network hop.

In a normal backend you'd have a database URL, a connection pool, and a network trip to a separate server every query. In Cloudflare Workers, D1 is accessed as a "binding" — it's just `env.DB.prepare(...)`. There's no connection setup. No risk of "max connections exceeded." No extra service to manage.

**Why not Supabase or PlanetScale?**
They're great products, but they'd add an external service, extra credentials to manage, and latency. For an internal tool with a small team, D1 is simpler. The only tradeoff is D1 uses SQLite under the hood, which means no `jsonb` columns, limited `RETURNING` support, and no native full-text search. None of those things matter for this project.

**Why not store everything as a JSON blob in one column?**
I chose a normalized schema — three tables (`meetings`, `action_items`, `key_decisions`). The reason is inline editing. When a user edits one action item, I want to send one PATCH request to update that single row. If everything was in a JSON blob, I'd need to read the whole meeting, modify the blob in memory, then write it all back. That's inefficient and risks losing concurrent edits. Normalized tables make individual edits clean and cheap.

---

## 3. Why OpenRouter instead of calling OpenAI directly?

**Short answer:** One API key, any model, no vendor lock-in.

OpenRouter is a proxy that gives access to hundreds of LLMs through a single API with the same request format as OpenAI. That means if the current model (`openai/gpt-oss-120b:free`) doesn't perform well, I can change one environment variable to switch to GPT-4o, Claude, or Mistral — without changing any code.

It also means the API key never touches the frontend. The flow is:

```
User → Frontend → Cloudflare Worker (has the key) → OpenRouter → LLM
```

The frontend never knows which model is being used or what the API key is.

**Why not call Anthropic or OpenAI directly?**
I would get locked into their specific SDK and response format. With OpenRouter, my `llm.ts` file talks to one endpoint regardless of what model is behind it. That's better for an internal tool where you might want to experiment with models over time.

---

## 4. Why `openai/gpt-oss-120b:free` as the model?

**Short answer:** Zero cost, no billing setup, and good enough for structured extraction.

This is a free model on OpenRouter. For a take-home assessment where the app needs to be publicly deployed and demonstrated, using a free model means:
- Anyone can test it without me paying per-call
- No billing alert risks during a demo
- No API quota issues

The tradeoff is real: free models are less reliable than GPT-4o or Claude. They occasionally produce malformed JSON. They sometimes miss speaker attribution.

**How I handle that:**
- Strict JSON-mode prompt that tells the model exactly what shape to return
- Zod validation on the response — if it doesn't match the schema, it fails
- Retry once automatically — one retry fixes ~90% of malformed JSON cases
- Human-in-the-loop editing — the user reviews everything before using it

So the answer to "what if the model is bad?" is: the system is designed to not trust the model. It validates, retries, and then lets a human fix anything else.

---

## 5. Why Langfuse for LLM observability instead of just logging to a database?

**Short answer:** Langfuse is built for exactly this. It shows prompt, output, tokens, and latency in a clean dashboard without me building anything.

If I logged LLM calls to my own D1 database, I'd need to:
1. Design the table schema
2. Write the insert code
3. Build a UI to view it
4. Handle token counting
5. Handle cost estimation

Langfuse already does all of that. I just initialize the SDK, create a trace, and it captures everything — input messages, model output, token counts, latency, and retry events. During a demo, I can open the Langfuse dashboard and show exactly what the model received and returned. That's a much stronger demo than showing a database table I built myself.

**Tradeoff:** One extra service in the stack (three environment variables). Worth it because the debugging and demo value is high.

---

## 6. Why Zod for input validation and LLM output validation?

**Short answer:** Zod turns "did this thing have the right shape?" from a manual if-statement chain into a one-liner with good error messages.

There are two places where untrusted data enters the system:
1. The user's HTTP request body (title, transcript)
2. The LLM's JSON response

Both of these can be wrong, malformed, or missing fields. Zod lets me define a schema once and then `.parse()` it. If it fails, I get a structured error. If it passes, TypeScript knows the types.

For LLM output specifically: this is the most important validation in the whole app. LLMs lie. They sometimes return extra fields, wrong types, or missing required fields. Without Zod, I'd have to write fragile `if (body.summary && typeof body.summary === 'string' && body.action_items && Array.isArray(...))` checks everywhere. With Zod, it's one `LlmOutput.parse(json)` call that handles all of that.

**Why not just use TypeScript types?**
TypeScript types are erased at runtime. They don't protect you from a bad API response. Zod is runtime validation — it runs in production and actually catches bad data.

---

## 7. Why React + Vite + TailwindCSS + shadcn/ui?

Each choice has a specific reason:

**React:** The assignment specifically asked for it. Also it's component-based, which fits a form → results UI well.

**Vite:** Faster than Create React App. Hot module replacement is nearly instant. Build output is optimized. No reason to use anything else for a SPA in 2025.

**TailwindCSS:** I can write and iterate on styles without switching between files. The utility class approach means I spend zero time naming CSS classes. The tradeoff is verbose HTML markup — I accepted that because the speed gain is real.

**shadcn/ui:** This is a collection of accessible UI components (Button, Input, Textarea, Dialog, etc.) that get copied into your codebase rather than installed as a package. That means I can customize them completely. They're built on Radix UI under the hood, which handles accessibility (keyboard navigation, ARIA roles) automatically. For an internal tool, accessibility matters less, but it's still good practice.

**Why not Next.js?**
Server-side rendering adds complexity without benefit for an internal tool. This is a SPA — one page, one URL, client-side routing. Vite is the right tool.

---

## 8. Why generate the PDF on the client side (jsPDF) instead of on the server?

**Short answer:** No server infrastructure needed, no file storage needed, no download endpoint needed.

If I generated PDFs on the server, I'd need a headless browser (Puppeteer/Playwright), a way to serve the generated file, and either temporary file storage or a stream back to the client. On Cloudflare Workers, I can't run a headless browser at all.

jsPDF runs entirely in the browser and triggers a download directly. The tradeoff is limited typography — you can't use system fonts or complex CSS. For an internal meeting notes tool, that's acceptable.

**Why not use an HTML-to-PDF service?**
That would be an external API call, more latency, more cost, and more things that can break. jsPDF is offline, instant, and free.

---

## 9. Why is the AI output split into "Summary," "Action Items," and "Key Decisions" instead of just one big summary?

**Short answer:** Action items and decisions serve different purposes, and mixing them is the most common failure mode of auto-generated meeting notes.

- **Summary** = context for people who missed the meeting (read once, then set aside)
- **Action Items** = tasks someone needs to do (need owner + deadline + tracking)
- **Key Decisions** = settled choices (no owner needed, just a record)

If I put everything in one summary blob, an action item ("Sarah will update the creatives by Friday") and a decision ("We're pausing Google Ads") look the same. In reality:
- The action item needs to be assigned to Sarah
- The decision doesn't need to be assigned to anyone — it just needs to be remembered

Keeping them separate also makes inline editing cleaner. You can edit, delete, and reorder action items independently without touching the summary.

---

## 10. Why does the backend retry the LLM call once instead of never or always?

**Short answer:** One retry fixes the majority of random JSON failures without adding meaningful cost or complexity.

Free and smaller LLMs occasionally return malformed JSON. Not always — maybe 5-10% of the time. One retry brings the success rate from ~90% to ~99%. The cost is:
- One extra LLM call (free on this model)
- A few extra seconds of latency
- About 10 lines of code

Retrying more than once has diminishing returns. If the model failed twice, it's probably a structural problem with the prompt or the transcript — another retry won't fix it. Better to return a 502 error and let the user try again with different input.

**The exact flow:**
1. Call LLM → try to parse JSON with Zod
2. If Zod passes → return result
3. If Zod fails → call LLM again
4. If Zod passes → return result
5. If Zod fails again → return 502 `llm_invalid_output`

---

## 11. Why does the API have specific error codes like `transcript_too_short` instead of just HTTP status codes?

**Short answer:** The frontend needs to show the user a human-readable explanation, and HTTP status codes alone don't say why.

A 422 status code means "unprocessable entity" — but it doesn't say whether the transcript was too short, too long, or had an encoding issue. By including `{ "error": "transcript_too_short" }` in the response body, the frontend can map machine codes to specific user-facing messages:

```
transcript_too_short → "The transcript is too short — please provide at least 200 characters."
transcript_too_long  → "The transcript is too long — please trim it below 100,000 characters."
llm_invalid_output   → "The AI returned invalid output. Try shortening the transcript and resubmitting."
```

This is standard API design — machine-readable error codes + human-readable messages. It makes the frontend code clean (`human[msg] ?? "An unexpected error occurred."`) and makes debugging easy.

---

## 12. Why use Vitest + `@cloudflare/vitest-pool-workers` for backend tests instead of Jest?

**Short answer:** These tests need to run inside the Cloudflare Workers runtime to be meaningful.

The backend uses Workers-specific APIs: D1 database bindings (`env.DB`), the `cloudflare:test` module, and Miniflare (the local Workers simulator). Jest doesn't understand any of these. It runs in Node.js and would need heavy mocking just to import the backend code.

`@cloudflare/vitest-pool-workers` runs each test file inside a real Miniflare Workers sandbox. That means:
- `env.DB` is a real local D1 database, not a mock
- SQL queries actually run and fail if the schema is wrong
- The tests catch real issues that mocks would hide

**Why not mock the database?**
Mocking the DB means I'm testing "does my mock return the right data" — not "does my SQL query work." We had a real incident in many projects where mocked tests passed but production failed because of a bad SQL query. Using a real DB catches that class of bug.

---

## 13. Why mock the LLM in unit tests but use a real LLM in production E2E tests?

**Short answer:** LLM calls are slow, cost tokens, and non-deterministic. Tests should be fast and predictable. But production E2E tests should verify the real thing works end-to-end.

**In unit tests:**
I intercept the `fetch` call to OpenRouter and return a pre-crafted JSON response. This lets me:
- Run 7 process tests in under 200ms total
- Test specific scenarios (first call fails, retry succeeds)
- Test error paths (both calls fail → 502)
- Run tests with no internet connection

**In production E2E tests (Playwright `--project=prod`):**
No API mocking. The test hits the real deployed backend, which calls the real OpenRouter, which calls the real model. This validates the full stack — network, secrets, model availability, and output quality — all at once.

The separation is deliberate: fast unit tests for logic, real integration tests for confidence before shipping.

---

## 14. Why Playwright for E2E tests instead of Cypress?

**Short answer:** Playwright has better TypeScript support, runs faster, and its API mocking (`page.route()`) is cleaner.

Both Playwright and Cypress are good. I chose Playwright because:
- `page.route()` lets me intercept API calls per-test with minimal setup
- It runs tests in a real Chromium browser with no additional server process
- TypeScript support is first-class with no extra configuration
- It supports multiple browser projects (`dev` and `prod`) in one config file

**The dev vs prod project split:**
- `dev` project: runs against `localhost:5173`, mocks all API calls with `page.route()` so tests don't call the real LLM. Fast, offline-capable.
- `prod` project: runs against the deployed URL with no mocking. Validates the real production stack.

This means I can run `npm run e2e` during development for instant feedback, and the CI pipeline runs `npm run e2e:prod` after every merge to `main` to catch production regressions.

---

## 15. Why is the transcript minimum 200 characters and maximum 100,000 characters?

**Short answer:** 200 characters is the minimum for the LLM to have anything meaningful to extract. 100,000 is roughly 75,000 words, which is safely within most LLM context windows while preventing accidental massive payloads.

A transcript shorter than 200 characters is probably a test input or a mistake — a one-sentence message isn't a meeting. Rather than letting the LLM try to summarize nothing, I reject it early with a clear error.

100,000 characters (~75k words) is generous — a 2-hour meeting at average speaking pace is maybe 20,000 words. The limit prevents someone from accidentally pasting an entire document and overwhelming the API.

These are validated in Zod at the route level, before any LLM call happens — so they fail fast with no wasted API calls.

---

## 16. Why build this as a single-page app at one URL instead of multiple pages?

**Short answer:** The workflow is linear. There's no reason to navigate away.

The flow is: paste transcript → see results → edit → export. Everything happens on one screen. The only "navigation" is opening the history dialog (a modal overlay) to load a past meeting.

Using React Router with `?id=` query params gives deep-linking without actual page navigation:
- `localhost:5173` = fresh empty form
- `localhost:5173?id=abc123` = loads and displays that specific meeting

This means you can bookmark a meeting, share the URL, or refresh and come back to your work — without building a full multi-page routing system.

---

## 17. Why no authentication?

**Short answer:** The assignment said "internal tool." Authentication adds significant complexity (session management, user tables, login flow, protected routes) that doesn't improve the core evaluation criteria.

The rubric grades: AI extraction quality, editing UX, observability, clean architecture, and deployment simplicity. Adding auth would cost 4-6 hours and produce no grading benefit.

If this were a real production tool, I would add Cloudflare Access in front of the Worker — it's a zero-code auth layer that requires a company email to access the page. No code changes needed.

---

## 18. Why is the system prompt published in the README if the repo is public?

**Short answer:** The case study explicitly required it, and the system prompt is not a security risk — the API key is.

Item 3 of the submission checklist says:

> "Your system prompt pasted in full — the actual prompt you used, not a summary of it."

So including it in the README is intentional, not an oversight.

More importantly: exposing a system prompt is not a security problem. The prompt contains no credentials, no business logic that can be exploited, and no proprietary data. It's just instructions telling the model to return JSON in a specific shape. Anyone who reads it learns nothing they couldn't figure out from using the tool for 30 seconds.

The actual secret in this stack is `OPENROUTER_API_KEY`. That lives exclusively as a Cloudflare Worker secret — set via `wrangler secret put`, never written to any file, never in the repo, never in the frontend bundle. The separation is:

```
What's public:   system prompt, schema, validation logic (all in the repo)
What's private:  OPENROUTER_API_KEY (Cloudflare secret, never in source)
```

**The broader principle:** a system that only works if the prompt stays secret is a fragile security model. If the prompt itself is the attack surface, the design is wrong. Real security comes from server-side key management and input/output validation — both of which are in place here. The prompt being visible changes nothing about what an attacker can or can't do.

---

## Summary Table

| Decision | Chosen | Not Chosen | Why |
|---|---|---|---|
| Backend runtime | Cloudflare Workers | Node/Express | One-command deploy, no infra |
| Framework | Hono | Express | Built for edge, same API style |
| Database | Cloudflare D1 | PostgreSQL, Supabase | Zero setup, native binding |
| DB schema | Normalized tables | JSON blob | Clean per-row edits |
| LLM provider | OpenRouter | OpenAI direct | Model-agnostic, one key |
| Model | gpt-oss-120b:free | GPT-4o | Zero cost, retry covers failures |
| Observability | Langfuse | Custom logging | Purpose-built, no UI to build |
| Validation | Zod | Manual checks | Runtime-safe, TypeScript-aware |
| PDF generation | jsPDF (client) | Server PDF | No infra, works offline |
| Unit test runner | Vitest + Workers pool | Jest | Runs in real Workers runtime |
| E2E test runner | Playwright | Cypress | Better TS, cleaner API mocking |
| LLM in unit tests | Mocked (vi.stubGlobal) | Real calls | Fast, free, deterministic |
| LLM in prod E2E | Real calls | Mocked | Validates full stack |
| Auth | None | Cloudflare Access | Not in scope, easy to add later |
| System prompt in README | Public (required) | Hidden | Case study required it; prompt is not a secret — the API key is |
