# Fix infinite loader on Pre-Test

## What's happening

When the user submits a topic, `/pretest` shows "Generating your personalized test…" and never resolves. There are two root causes that compound:

### 1. The serverFn can hang for ~30s+ with no surfaced error
`src/lib/groq.ts` retries Groq on `429` / `5xx` with delays of `3s + 6s + 12s` (≈21s of waits), then up to 3 fetch round-trips on top. All Groq calls also pass through a **server-side serialized queue** (`enqueueGroq`). If the previous request is still mid-retry, the new request waits behind it. Result: the SSR worker exceeds its request budget and the response never reaches the client, so the loader never flips to the error state.

### 2. The pre-test request is fired twice (canceling itself)
`I18nProvider` initializes `lang = "en"` then calls `setLangState(detectLang())` in a mount `useEffect`. On routes where the saved language is `ru` (the user just typed Russian), `lang` flips after first render. In `pretest.tsx`, `loadQuestions` is `useCallback([..., lang])`, so the effect re-runs: the first request is "cancelled" client-side, a second is enqueued behind it on the server. This doubles the wait and almost guarantees a worker timeout.

## Plan

### A. Stop the duplicate request (`src/lib/i18n.tsx`)
Initialize `lang` with `detectLang()` via `useState(() => detectLang())` so the value is correct on first render and `loadQuestions` does not re-create. Keep SSR-safe by guarding `localStorage` access inside the initializer.

### B. Make the AI call fail fast and visibly (`src/lib/groq.ts`)
- Reduce retry budget so we never exceed the worker timeout: `RETRY_DELAYS_MS = [1500, 3500]` (≈5s of waits, 3 attempts total) and `MAX_RETRY_AFTER_MS = 4000`.
- Add a per-fetch `AbortController` with an 8s timeout so a stuck Groq socket cannot hang the request indefinitely.
- On final failure, always throw `AI_BUSY_MESSAGE` (already done) — confirmed it bubbles to the `AiErrorState` retry screen.

### C. Make `generatePreTest` symmetric with `generateFinalTest` (`src/lib/learning.functions.ts`)
Wrap the handler in `try/catch` and return `{ questions: [], error: AI_BUSY_MESSAGE }` instead of throwing. Update `pretest.tsx` to check `res.error || res.questions.length === 0` and set the error state — same pattern already used in `final-test.tsx`. This guarantees the client always gets a response and the loader always resolves.

### D. Client-side safety net (`src/routes/pretest.tsx`)
Add a 25s client-side timeout on the `generate(...)` promise. If it doesn't resolve, set the friendly error state so the user sees the "Try Again" UI instead of an infinite spinner.

## Files touched
- `src/lib/i18n.tsx` — lazy initial state for `lang`
- `src/lib/groq.ts` — shorter retry budget + fetch abort timeout
- `src/lib/learning.functions.ts` — `generatePreTest` returns `{questions, error?}`
- `src/routes/pretest.tsx` — handle `res.error`, add client timeout

## Out of scope
No UI/visual changes. No changes to other AI features (course, lesson, flashcards) beyond what they inherit from the shared `groq.ts` retry settings.
