# Root Cause (from logs)

Two distinct problems are causing the "Our AI is a bit busy" error:

1. **Groq daily token limit exhausted** — sandbox dev-server log shows:
   `Rate limit reached ... tokens per day (TPD): Limit 100000, Used 99959`.
   Groq is dead for the next ~9 minutes / day.

2. **Lovable AI JSON output is being truncated** — the real current failure:
   `generateCourse failed: SyntaxError: Unterminated string in JSON at position 1245 (line 7 column 1046)`.
   `google/gemini-3-flash-preview` is cutting off the 10-lesson course JSON because no `max_tokens` is set on the request, so the response stops mid-string and `JSON.parse` throws → caught → returns the generic "AI busy" message to the UI.

`LOVABLE_API_KEY` is confirmed present, so the provider fallback is working; the response itself is just incomplete.

# Plan (edit `src/lib/groq.ts` and `src/lib/learning.functions.ts` only)

### 1. Allow callers to pass `max_tokens`
- Add optional `maxTokens?: number` to `GroqRequest` and to the public `callGroqJson` / `callGroqText` signatures.
- When set, include `max_tokens` in the request body sent to both providers.

### 2. Use a bigger model + bigger output budget for `generateCourse`
- In `generateCourse`, call `callGroqJson({ ..., maxTokens: 16000, model: "google/gemini-2.5-pro" })` so the full 10-lesson JSON fits.
- Also add an optional `model` override to `callGroqJson` that, when provided, overrides only the Lovable AI provider's model (Groq stays on its current model). This keeps the course generation on a model with a much larger output window while leaving the cheaper Flash model for quizzes/lessons/flashcards.

### 3. Defensive JSON parse
- In `cleanContent`/`callGroqJson`, if `JSON.parse` fails, attempt to repair an obviously-truncated JSON object by trimming to the last balanced `}` / `]` and retrying once. If still invalid, throw the original error so the handler reports `AI_BUSY_MESSAGE` (unchanged UX).

### 4. Keep the existing Lovable-first / Groq-fallback order
No change to provider order — Lovable AI is already primary and the logs confirm it is being reached; only the response size needs fixing.

# Files Touched
- `src/lib/groq.ts` — add `maxTokens` + optional `model` override, propagate into request body, add safe-JSON repair.
- `src/lib/learning.functions.ts` — pass `maxTokens: 16000` and `model: "google/gemini-2.5-pro"` from `generateCourse` only.

No UI, route, schema, or auth changes. No new dependencies.
