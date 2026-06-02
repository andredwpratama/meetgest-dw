# Processing Overlay Design

**Date:** 2026-05-31
**Scope:** `frontend/` only — no backend changes

---

## Goal

Replace the static "Analyzing…" spinner on the Generate Digest button with an in-card overlay that simulates progress through recognizable analysis steps, ending with a brief "Digest ready!" flash before results appear.

---

## Approach

**In-card overlay inside `TranscriptInput`.**
The card dims (white/85 + backdrop-blur) and a centered overlay renders on top of it. The form stays faintly visible underneath for context. No new component files are needed — the overlay lives inside `TranscriptInput.tsx`. `ProcessorPage` manages the 800 ms completion delay before revealing results.

---

## Props & State

### `ProcessorPage`

Replace:
```ts
const [processing, setProcessing] = useState(false);
```
With:
```ts
const [processingPhase, setProcessingPhase] = useState<'idle' | 'loading' | 'done'>('idle');
```

`handleProcess` flow:
1. Start → `setProcessingPhase('loading')`
2. API resolves (success) → `setProcessingPhase('done')`, wait 800 ms, then `setMeeting(m)` + `setProcessingPhase('idle')`
3. API resolves (error) → `setProcessingPhase('idle')` directly, set error string as today

Pass `processingPhase` to `TranscriptInput` in place of `processing`.

### `TranscriptInput`

Replace `processing: boolean` prop with `processingPhase: 'idle' | 'loading' | 'done'`.

- `canProcess` → `processingPhase === 'idle' && !isTitleEmpty && !isTooShort && !isTooLong`
- Button disabled when `processingPhase !== 'idle'`
- Button label: `processingPhase !== 'idle'` → spinner + "Analyzing…" (unchanged); `'idle'` → Sparkles + "Generate Digest"

---

## Overlay

Renders when `processingPhase === 'loading' || processingPhase === 'done'`.

```
┌─────────────────────────────────────────┐  ← progress bar (h-1, pinned to top)
│                                         │
│           [icon]                        │
│    "Extracting action items…"           │  ← cycling message
│    "This usually takes 5–15 seconds"    │  ← subtext (hidden on 'done')
│                                         │
└─────────────────────────────────────────┘
```

**Container:** `absolute inset-0 z-10 rounded-2xl bg-white/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3`

### Progress bar

- Element: `absolute top-0 left-0 h-1 rounded-t-2xl transition-all duration-300`
- Color: `bg-[#8CC0EB]` while loading; `bg-emerald-500` on `'done'`
- Width driven by a `progress` state (0–100)
- Simulation: `useEffect` with `setInterval(150 ms)`. Each tick advances progress using ease-out: `delta = (85 - progress) * 0.03`, minimum delta `0.2`. Clamps at 85 while loading.
- On `'done'`: `setProgress(100)` immediately (CSS transition animates it)
- Reset to 0 when `processingPhase` returns to `'idle'`

### Icon

- Loading: `<Sparkles className="size-8 text-[#8CC0EB] animate-pulse" />`
- Done: `<CheckCircle2 className="size-8 text-emerald-500" />`

### Cycling message

- Array of 6 strings, index stored in `msgIndex` state
- `useEffect` with `setInterval(2000 ms)` while `processingPhase === 'loading'`; increments `msgIndex % messages.length`
- Text transitions: `key={msgIndex}` on the `<p>` triggers `animate-in fade-in duration-500`
- On `'done'`: renders `"Digest ready!"` in `text-emerald-600 font-bold` (ignores msgIndex)
- Reset `msgIndex` to 0 when overlay closes

Messages (in order):
1. "Reading your transcript…"
2. "Identifying participants…"
3. "Extracting action items…"
4. "Recognizing key decisions…"
5. "Writing executive summary…"
6. "Finalizing your digest…"

### Subtext

- `"This usually takes 5–15 seconds"` in `text-xs text-slate-400`
- Hidden (`null`) when `processingPhase === 'done'`

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/pages/ProcessorPage.tsx` | `processing` → `processingPhase` state + 800 ms completion delay |
| `frontend/src/components/TranscriptInput.tsx` | Replace `processing: boolean` prop; add overlay JSX + progress/message effects |

No new files. No backend changes.

---

## Out of Scope

- Actual streaming from the LLM (backend unchanged)
- Any animation library beyond what Tailwind + tailwindcss-animate already provide
- Error state changes (error handling flow is unchanged)
