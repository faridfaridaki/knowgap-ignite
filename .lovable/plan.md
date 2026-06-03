## What's wrong

1. **Infinite render loop** in `src/routes/course.tsx` → "Maximum update depth exceeded" in console. `loadLesson` depends on `course`/`state`; `loadCourse` depends on `loadLesson`; `useEffect` depends on `loadCourse` → every state update recreates the callback → effect re-fires → re-renders forever. This is the main reason the screen feels frozen.
2. **`setCourse(null)` is called on every loadCourse run**, including when the cached course exists, causing a brief flash.
3. **No prefetch** of the next lesson — user always waits when clicking "Next".
4. Subtitle text claims "15–30 seconds" but we now only generate the outline (~5–10s).

## Fix (frontend only — DeepSeek stays primary in `groq.ts`)

### `src/routes/course.tsx`
- Replace dependencies on `course` / `state` / `wrongQuestions` / `lang` inside `loadLesson` with **refs** (`courseRef`, `stateRef`, `langRef`, `wrongQuestionsRef`) so the callback identity stays stable.
- `loadLesson` deps shrink to `[generateOneLesson]`.
- Remove the unconditional `setCourse(null)` at the top of `loadCourse`; only reset before kicking off a fresh outline generation.
- Drop the 30 s manual timeout race (timeout already handled inside `callGroqJson`).
- Change `useEffect(() => loadCourse(), [loadCourse])` → `useEffect(() => { if (hydrated) loadCourse(); }, [hydrated])` so it runs **once** after hydration, not on every callback re-creation.
- After outline arrives, **prefetch lesson 2 in parallel** with lesson 1 so "Next" is instant.
- Same prefetch when loading a cached course on mount.

### `src/lib/i18n.tsx`
- Update `buildingCourseSub`:
  - en: `"This usually takes 5–10 seconds."`
  - ru: `"Обычно занимает 5–10 секунд."`

## Out of scope
- No changes to `src/lib/groq.ts` — DeepSeek remains first provider, Lovable AI + Groq stay as fallbacks.
- No changes to `src/lib/learning.functions.ts` — outline-only generation kept as-is.

## Expected result
- No more render-loop errors in the console.
- Initial course screen renders the outline in ~5–10 s (DeepSeek single call).
- Lesson 1 streams in shortly after; lesson 2 is already cached when user clicks Next.
