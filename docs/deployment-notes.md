# Deployment Notes

Status: NOT DEPLOYED YET

---

## Prerequisites

All secrets must be set before deploying.

### 1. Set Worker secrets

```bash
cd backend
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put LANGFUSE_PUBLIC_KEY
npx wrangler secret put LANGFUSE_SECRET_KEY
npx wrangler secret put ANTHROPIC_API_KEY
```

Values are in `backend/.dev.vars` (except ANTHROPIC_API_KEY — get from https://console.anthropic.com).

### 2. Verify secrets are set

```bash
npx wrangler secret list
```

Expected: OPENROUTER_API_KEY, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, ANTHROPIC_API_KEY

---

## Deploy Backend

```bash
cd backend
npx wrangler deploy
```

Note the Worker URL printed after deploy:
`https://meeting-processor-api.<subdomain>.workers.dev`

---

## Apply Database Schema to Remote D1

Run once (or after any schema change):

```bash
cd backend
npx wrangler d1 execute meeting-processor-db --remote --file=schema.sql
```

---

## Deploy Frontend

Frontend `.env` already points to the production Worker URL:
```
VITE_API_URL=https://meeting-processor-api.andre.workers.dev
```

Build and deploy:

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name meeting-processor-ui
```

Live URL: https://meeting-processor-ui.pages.dev

---

## Smoke Test After Deploy

1. Open https://meeting-processor-ui.pages.dev
2. Paste a transcript and process it
3. Verify result appears with summary, action items, key decisions
4. Check Langfuse trace arrived:

```cmd
langfuse --env backend\.dev.vars api traces list --limit 1
```

---

## Deploy Order

1. Set secrets → 2. Deploy backend → 3. Apply D1 schema → 4. Deploy frontend → 5. Smoke test

---

## Environment Summary

| What | Dev | Production |
|---|---|---|
| LLM Provider | OpenRouter (free) | Anthropic direct |
| Model | `meta-llama/llama-3.3-70b-instruct:free` | `claude-haiku-4-5-20251001` |
| API Key used | `OPENROUTER_API_KEY` | `ANTHROPIC_API_KEY` |
| Database | Local D1 (in-memory) | Cloudflare D1 remote |
| Frontend URL | http://localhost:5173 | https://meeting-processor-ui.pages.dev |
| Worker URL | http://localhost:8787 | https://meeting-processor-api.andre.workers.dev |
| Langfuse Host | https://jp.cloud.langfuse.com | https://jp.cloud.langfuse.com |
