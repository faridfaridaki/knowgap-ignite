# Fix: Lovable AI primary, Groq fallback

## What the logs show

Groq has hit its daily token limit (TPD): `Limit 100000, Used 99959`. Every request now returns 429 and the user keeps seeing **"Our AI is a bit busy right now"**.

There are **two bugs** in `src/lib/groq.ts` that prevent the existing fallback from working:

1. **Wrong provider order.** `getProviders()` returns Groq first, Lovable AI second. Even though we have `LOVABLE_API_KEY` available, every request burns ~10s retrying Groq before falling back.
2. **Daily-limit short-circuit throws instead of falling back.** When Groq returns a 429 with "tokens per day", `fetchProvider` does `throw new Error(AI_BUSY_MESSAGE)`. In `fetchGroq`, the fallback loop only catches and continues if `provider.name === "Groq"` — which it does — but the chained 3-retry storm + repeated cooldowns mean most user requests time out before reaching Lovable AI. The visible log line `"Groq is rate-limited or unavailable; retrying with Lovable AI"` only appears once in logs, confirming the fallback is rarely reached.

## Plan

Edit only `src/lib/groq.ts`:

### A. Reorder providers — Lovable AI first
`getProviders()` returns `[LovableAI, Groq]`. Groq is used only when `LOVABLE_API_KEY` is missing or Lovable AI itself fails.

### B. Fail fast on Groq so fallback actually happens
- When Groq returns a daily-limit 429, do NOT retry — immediately throw so `fetchGroq` falls back. (Today it throws but only after the retry loop on other 429s.)
- Set `groqCooldownUntil = Date.now() + 10 * 60 * 1000` on **any** Groq 429 (not just daily-limit), so subsequent calls skip Groq entirely for 10 minutes when Lovable AI is configured.

### C. Simplify fallback loop
Iterate `providers` in order; on any error from a non-final provider, log a warning and try the next. Only throw `AI_BUSY_MESSAGE` if **all** providers fail.

### D. No client-side changes
The existing client retry/error UI already handles `AI_BUSY_MESSAGE` correctly. No edits to routes, i18n, or learning.functions.ts.

## Files touched
- `src/lib/groq.ts`

## Out of scope
- Removing Groq entirely (kept as fallback as requested).
- UI changes, learning flow changes, rate-limit messaging copy.
