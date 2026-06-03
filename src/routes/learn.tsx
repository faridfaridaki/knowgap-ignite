import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Lightbulb } from "lucide-react";
import { AiErrorState } from "@/components/AiErrorState";
import { AppHeader } from "@/components/AppHeader";
import { generateLesson } from "@/lib/learning.functions";
import {
  loadState,
  patchState,
  isAnswerCorrect,
} from "@/lib/learning-state";
import type { LearningState, LessonConcept } from "@/lib/learning-state";
import { friendlyAiError } from "@/lib/ai-error";

export const Route = createFileRoute("/learn")({
  component: LearnPage,
});

function LearnPage() {
  const navigate = useNavigate();
  const generate = useServerFn(generateLesson);
  const [state, setState] = useState<LearningState | null>(null);
  const [lesson, setLesson] = useState<LessonConcept[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadLesson = useCallback(() => {
    setError(null);
    setLesson(null);
    const s = loadState();
    if (!s || s.preTestQuestions.length === 0) {
      navigate({ to: "/" });
      return;
    }
    setState(s);
    if (s.lesson.length > 0) {
      setLesson(s.lesson);
      return;
    }
    const missed = s.preTestQuestions
      .filter((q, i) => !isAnswerCorrect(q, s.preTestAnswers[i] ?? ""))
      .map((q) => q.question);
    const target = missed.length > 0 ? missed : s.preTestQuestions.map((q) => q.question);
    let cancelled = false;
    generate({ data: { topic: s.topic, missedConcepts: target } })
      .then((res) => {
        if (cancelled) return;
        if (res.error || res.lesson.length === 0) {
          setError(res.error ?? friendlyAiError(new Error("AI response unavailable")));
          return;
        }
        patchState({ lesson: res.lesson });
        setLesson(res.lesson);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(friendlyAiError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => loadLesson(), [loadLesson]);

  if (!state) return null;

  if (error) {
    return <AiErrorState message={error} onRetry={loadLesson} />;
  }

  if (!lesson) {
    return (
      <main className="min-h-screen w-full bg-background flex items-center justify-center px-6 relative">
        <AppHeader />
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#7C6AF7] border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">
            Building your personalized lesson…
          </p>
        </div>
      </main>
    );
  }

  const concept = lesson[idx];
  const total = lesson.length;
  const isLast = idx === total - 1;

  return (
    <main className="min-h-screen w-full bg-background px-6 py-12 relative">
      <AppHeader />
      <div className="mx-auto w-full max-w-[720px]">
        <div className="flex items-center justify-between mb-8">
          <span className="inline-flex items-center rounded-full border border-[#7C6AF7]/40 bg-[#7C6AF7]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#7C6AF7]">
            Stage 3 · Learning
          </span>
          <Link
            to="/flashcards"
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface/70"
          >
            <Sparkles size={13} className="text-[#4FC4CF]" />
            Practice Flashcards
          </Link>
        </div>

        <div className="mb-5 flex items-center justify-between text-sm text-muted-foreground">
          <span>Concept {idx + 1} of {total}</span>
          <span className="tabular-nums">{Math.round(((idx + 1) / total) * 100)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden mb-8">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${((idx + 1) / total) * 100}%`,
              backgroundImage: "linear-gradient(90deg, #7C6AF7, #5B4FD4)",
            }}
          />
        </div>

        <article className="rounded-2xl bg-surface border border-surface-border p-7 sm:p-9 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
            {concept.concept}
          </h2>

          <section className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              In simple words
            </h3>
            <p className="text-base text-foreground leading-relaxed">
              {concept.simple_explanation}
            </p>
          </section>

          <section className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Real-life example
            </h3>
            <div className="rounded-xl border border-[#4FC4CF]/25 bg-[#4FC4CF]/[0.06] p-4 text-base text-foreground leading-relaxed">
              {concept.real_life_example}
            </div>
          </section>

          <section className="mt-6">
            <div
              className="rounded-xl border border-[#7C6AF7]/40 p-4"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, rgba(124,106,247,0.18) 0%, rgba(91,79,212,0.10) 100%)",
              }}
            >
              <div className="flex items-start gap-3">
                <Lightbulb size={18} className="mt-0.5 text-[#7C6AF7] shrink-0" />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#7C6AF7] mb-1">
                    Key Takeaway
                  </div>
                  <p className="text-base text-foreground font-medium leading-relaxed">
                    {concept.key_takeaway}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </article>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="rounded-lg border border-surface-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface/70 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={() => navigate({ to: "/final-test" })}
              className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }}
            >
              Take Final Test →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
              className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }}
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
