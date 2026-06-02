# Meeting Transcript Processor — Submission

**Live URL:** https://meeting-processor-ui.pages.dev
**API URL:** http://localhost:8787 (Local Dev Worker) / Deployed Worker URL Placeholder
**Repo:** KPI Media Meeting Notes Processor Repository

## System Prompt

```
You are an assistant that turns raw meeting transcripts into structured operational notes for a performance marketing team.

You will be given the full transcript of one internal meeting. Return ONLY valid JSON matching this schema:

{
  "summary": string,                  // 3-5 sentences, focuses on outcomes and decisions, not a play-by-play
  "action_items": [
    {
      "task": string,                 // restated close to how it was said in the meeting
      "owner": string | null,         // null if no owner was explicitly mentioned
      "deadline": string | null       // null if no deadline was explicitly mentioned, otherwise the literal phrase used (e.g. "Friday", "next week", "EOD Tuesday")
    }
  ],
  "key_decisions": [string]           // each item is one decision, separate from action items
}

Hard rules:
- NEVER invent an owner. If a task has no clearly named owner, "owner" MUST be null.
- NEVER invent a deadline. If no deadline is mentioned, "deadline" MUST be null.
- "key_decisions" are settled outcomes ("decided to pause Google Ads"), not tasks. Do not duplicate an action item as a decision.
- Output MUST be a single JSON object with exactly the keys above and nothing else. No prose. No markdown fences.
```

## Stack & Why

- **Frontend:** Vite + React + TypeScript + Tailwind CSS (v3) + shadcn/ui.
  - *Vite*: Rapid Hot Module Replacement (HMR) and fast build packaging.
  - *React*: Component-driven structure ideal for complex, state-heavy interfaces (inline row editors, loaders).
  - *Tailwind CSS v3*: Provides rapid utility-first styling with responsive breakpoint overrides.
  - *shadcn/ui*: Highly accessible primitive interfaces (Button, Input, Textarea, Card, Label) offering complete aesthetic control and zero bloated node packaging.
- **Backend (Reference):** Hono on Cloudflare Workers + D1 Database + Langfuse observability.
- **Testing:** Vitest + JSDOM + Testing Library.
  - Enables high-speed, lightweight isolated testing of browser DOM functions, Markdown generation libraries, and API contracts.

## Beyond Core

- **Highly Premium Visual Layout:** Frosted glass sidebar containers (`backdrop-blur-xl`), radiant color gradients, smooth hover scales, animated auto-save indicators (`Loader2` spinner and emerald transitions), and high-contrast dark-mode colors.
- **Complete Fluid Responsiveness:** Re-engineered sidebar wraps dynamically using modern media query breakpoints (`hidden md:flex flex-col` sidebar + a custom responsive Header navigation bar on mobile interfaces), ensuring usability on screens of any size.
- **Client-Side Export Suitability:** Rich Markdown formatting download (`.md` named via slugged title) + raw Markdown copy button inside the menu. Plus, custom `jsPDF` wrapper downloads that gracefully handle margins (54pt), draw bullet graphics, and dynamically compute page overflows to insert page breaks perfectly.
- **Strict WCAG Accessibility Compliance:** Associated inputs with semantic labels (using mapped `htmlFor` and `id` references in the main transcript input form), equipped all table rows with clear visual descriptors (`aria-label`), and enhanced history listings to support click events via the `Enter` and `Spacebar` keys.

## What I Cut and Why

- **Streaming JSON output** — doesn't fit naturally with zod-validated structured JSON payloads; introduces high complexity for negligible UX utility.
- **Automatic speaker diarization** — out of scope for the core requirements; increases prompt token consumption and model latency.
- **Persistent local storage cache** — the database (Cloudflare D1) serves as the singular source of truth. Offline cache introduces synchronization hazards.

## What I'd Improve

- **Reordering Action Items** — implement drag-and-drop handles on the rows using a library like `@hello-pangea/dnd`.
- **Global Dark Mode Toggle** — replace system-based themes with an explicit dark/light mode toggle in the header.
- **Undo/Redo Command Pattern** — implement keyboard shortcuts (`Ctrl+Z`) to undo accidental deletions of action items.
