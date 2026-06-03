
## Scope

Seven independent features. I'll ship them in one pass.

### 1. i18n (EN/RU)
- New `src/lib/i18n.tsx` — React context + `useT()` hook + translations dict for every UI string.
- Persist choice in `localStorage('knowgap:lang')`, default = `navigator.language.startsWith('ru') ? 'ru' : 'en'`.
- `<LanguageToggle/>` (EN / RU pills) added to a shared header on landing, dashboard, pretest, course, final-test, analysis pages.
- Pass `language` into every Groq server fn; prompts get `Respond entirely in [Russian|English]. All questions, options, explanations, lesson text, and analysis must be in that language.`

### 2. Dashboard (replaces /history)
- New route `/dashboard`. Old `/history` and `/history/$id` redirect to dashboard / final-analysis.
- Sections: welcome header (profile display_name), stats row (sessions completed, lessons done = sum of completedLessons, avg improvement), My Courses grid (cards with topic + date + pre→final + progress bar + "View Full Analysis" + "Retake Course"), Recent Activity timeline (derived from session timestamps + completedLessons), Knowledge Gaps tracker (aggregated `knowledge_gaps` across sessions, sorted by frequency), Suggested Topics (last 3-4 from saved `suggested_topics`).
- "Retake Course" sets the topic in sessionStorage, clears learning state, navigates to `/pretest`.
- Update `UserMenu` link "History" → "Dashboard".

### 3. Google OAuth
- Call `supabase--configure_social_auth({providers:["google"]})`.
- Add "Continue with Google" button at top of `/auth` page using `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`.
- Existing trigger `handle_new_user` already inserts profile row from `raw_user_meta_data.display_name || email`, so Google users get a profile automatically.

### 4. Loading screens
- New `<FullScreenLoader title subtitle/>` component with animated logo pulse.
- Wire into pretest generation, course generation, final-test generation. Replace existing minimal spinners.
- Route transitions: add fade-in via `animate-fade-in` on each route's root div (TanStack doesn't expose easy global transitions; per-page fade is sufficient).

### 5. Detailed lesson content
- Update `generateCourse` prompt: longer explanations (5-7 paragraphs), per-formula variable definitions + worked example, per-problem numbered step-by-step solution with final answer box.
- Extend `CoursePracticeProblem` to support structured `steps: string[]` + `final_answer: string` (keep `solution_steps` fallback for backward compat).
- Course UI "Show Answer" renders numbered steps + highlighted final-answer box.

### 6. Multiple-choice only
- Strip `short_answer` from `QUIZ_SYSTEM` prompt + `sanitizeQuestions` (reject non-MC).
- Remove short-answer input branch from `QuizPlayer`.
- Note: existing sessions in DB with short-answer questions still render fine (MC code path handles them).

### 7. Hints + navigation lock
- `QuizPlayer` rewrite:
  - Per-question state: `selected`, `hintUsed`, `hiddenOptions` (2 random wrongs).
  - "Use Hint" button (visible until used) → strike-through + disable 2 wrong options; show "Hint used — correct answer worth 0.5 points".
  - "Next Question" disabled until `selected` is set.
  - Scoring: change return type from `string[]` to `{ answer: string; hintUsed: boolean }[]`.
- Update `scoreTest` in `learning-state.ts` to return a number that may be `.5` increments (correct=1, correct+hint=0.5, else 0).
- Update `LearningState.preTestAnswers` / `finalTestAnswers` to the richer shape; migrate readers (`pretest-results`, `final-analysis`).
- Score displays: show `score.toFixed(1)` when non-integer, else integer.
- DB columns `pre_test_score` / `final_test_score` are `integer` — I'll round half-points UP for storage (`Math.ceil(score*2)/2` won't fit integer; use `Math.round`). Acceptable given the UI shows the precise score during the session; saved analysis re-derives from saved answers. I'll keep `pre_test_score` as `Math.round(score)` and additionally save the raw decimal in a new JSON field? Simpler: change columns to numeric.
  - **Migration**: alter `pre_test_score`, `final_test_score` to `numeric(4,1)`.

## Out of scope / assumptions
- Translations cover the UI strings I see in the current routes; AI-generated content is translated by the model itself.
- "Retake Course" creates a fresh session row (no link back to original).
- Recent Activity is derived from saved session metadata — no separate activity log table.

## Files touched (rough)
- new: `src/lib/i18n.tsx`, `src/components/LanguageToggle.tsx`, `src/components/FullScreenLoader.tsx`, `src/routes/dashboard.tsx`, migration for numeric scores
- edited: `QuizPlayer.tsx`, `learning-state.ts`, `learning.functions.ts`, `routes/auth.tsx`, `routes/index.tsx`, `routes/pretest.tsx`, `routes/pretest-results.tsx`, `routes/course.tsx`, `routes/final-test.tsx`, `routes/final-analysis.tsx`, `routes/final-analysis.$id.tsx`, `routes/history.tsx` → redirect, `components/UserMenu.tsx`

Approve and I'll build it.
