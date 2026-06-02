import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, TrendingUp, AlertTriangle, ArrowRight } from "lucide-react";
import {
  loadState,
  patchState,
  scoreTest,
  isAnswerCorrect,
  clearState,
} from "@/lib/learning-state";
import type { LearningState } from "@/lib/learning-state";
import { suggestRelatedTopics } from "@/lib/analyze.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { saveSession } from "@/lib/history";

export const Route = createFileRoute("/final-analysis")({
  component: FinalAnalysisPage,
});

function FinalAnalysisPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const suggest = useServerFn(suggestRelatedTopics);

  const [state, setState] = useState<LearningState | null>(null);
  const [related, setRelated] = useState<string[]>([]);
  const [relatedReady, setRelatedReady] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved-cloud" | "saved-local">(
    "idle",
  );

  useEffect(() => {
    const s = loadState();
    if (
      !s ||
      s.preTestQuestions.length === 0 ||
      s.finalTestQuestions.length === 0 ||
      s.finalTestAnswers.length === 0
    ) {
      navigate({ to: "/" });
      return;
    }
    const finalScore = scoreTest(s.finalTestQuestions, s.finalTestAnswers);
    const next = patchState({ finalTestScore: finalScore }) ?? s;
    setState(next);

    suggest({ data: { topic: s.topic } })
      .then((res) => setRelated(res.topics ?? []))
      .catch((e) => console.error("suggest failed", e))
      .finally(() => setRelatedReady(true));
  }, [navigate, suggest]);

  // Auto-save once state + suggestions + auth status are settled
  useEffect(() => {
    if (!state || authLoading || !relatedReady || saved !== "idle") return;
    setSaved("saving");
    const startedAt = state.startedAt ? new Date(state.startedAt) : new Date();
    const duration = Math.max(
      1,
      Math.round((Date.now() - startedAt.getTime()) / 60000),
    );

    const preTotal = state.preTestQuestions.length;
    const finalTotal = state.finalTestQuestions.length;
    const prePct = preTotal ? Math.round((state.preTestScore / preTotal) * 100) : 0;
    const finalPct = finalTotal
      ? Math.round((state.finalTestScore / finalTotal) * 100)
      : 0;
    const improvement = finalPct - prePct;
    const knowledge_gaps = state.finalTestQuestions
      .map((q, i) => ({ q, ok: isAnswerCorrect(q, state.finalTestAnswers[i] ?? "") }))
      .filter((x) => !x.ok)
      .map((x) => ({ question: x.q.question, correct_answer: x.q.correct_answer }));

    const payload = {
      topic: state.topic,
      pre_test_questions: state.preTestQuestions,
      pre_test_answers: state.preTestAnswers,
      pre_test_score: state.preTestScore,
      pre_test_total: preTotal,
      final_test_questions: state.finalTestQuestions,
      final_test_answers: state.finalTestAnswers,
      final_test_score: state.finalTestScore,
      final_test_total: finalTotal,
      lesson_content: state.lesson,
      flashcards: state.flashcards,
      duration_minutes: duration,
      questions_count: preTotal + finalTotal,
      subtopics: [],
      messages: [],
      improvement,
      knowledge_gaps,
      suggested_topics: related,
    };

    (async () => {
      if (user) {
        const { error } = await supabase
          .from("conversations")
          .insert({ ...payload, user_id: user.id } as never);
        if (error) {
          console.error("Save to cloud failed:", error);
          saveSession({
            id: crypto.randomUUID(),
            topic: state.topic,
            date: new Date().toISOString(),
            subtopics: [],
            messages: [],
            stats: { questionsAnswered: payload.questions_count, durationMinutes: duration },
          });
          setSaved("saved-local");
        } else {
          setSaved("saved-cloud");
        }
      } else {
        saveSession({
          id: crypto.randomUUID(),
          topic: state.topic,
          date: new Date().toISOString(),
          subtopics: [],
          messages: [],
          stats: { questionsAnswered: payload.questions_count, durationMinutes: duration },
        });
        setSaved("saved-local");
      }
    })();
  }, [state, user, authLoading, saved, related, relatedReady]);

  const data = useMemo(() => {
    if (!state) return null;
    const preTotal = state.preTestQuestions.length;
    const finalTotal = state.finalTestQuestions.length;
    const prePct = preTotal ? Math.round((state.preTestScore / preTotal) * 100) : 0;
    const finalPct = finalTotal
      ? Math.round((state.finalTestScore / finalTotal) * 100)
      : 0;
    const delta = finalPct - prePct;

    const preRows = state.preTestQuestions.map((q, i) => ({
      label: q.question,
      correct: isAnswerCorrect(q, state.preTestAnswers[i] ?? ""),
    }));
    const finalRows = state.finalTestQuestions.map((q, i) => ({
      label: q.question,
      correct: isAnswerCorrect(q, state.finalTestAnswers[i] ?? ""),
    }));
    const gaps = state.finalTestQuestions
      .map((q, i) => ({ q, correct: isAnswerCorrect(q, state.finalTestAnswers[i] ?? "") }))
      .filter((x) => !x.correct);

    return { preTotal, finalTotal, prePct, finalPct, delta, preRows, finalRows, gaps };
  }, [state]);

  if (!state || !data) return null;

  const overallTone =
    data.finalPct >= 80
      ? "Outstanding work — you've genuinely got this."
      : data.finalPct >= 60
        ? "Solid progress. There's still room to deepen your grasp."
        : data.delta > 0
          ? "You're improving, but you're still building understanding in this area."
          : "Be honest with yourself — this topic needs more work.";

  return (
    <main className="min-h-screen w-full bg-background px-6 py-12">
      <div className="mx-auto w-full max-w-[820px]">
        <div className="text-center mb-10">
          <span className="inline-flex items-center rounded-full border border-[#7C6AF7]/40 bg-[#7C6AF7]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#7C6AF7]">
            Stage 6 · Final Analysis
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-foreground">
            Your learning report
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{state.topic}</p>
        </div>

        {/* Score comparison */}
        <section className="rounded-2xl border border-surface-border bg-surface p-6 sm:p-7">
          <h2 className="text-lg font-semibold text-foreground mb-5">Score Comparison</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <ScoreCell label="Pre-Test" score={state.preTestScore} total={data.preTotal} pct={data.prePct} />
            <div className="flex flex-col items-center justify-center">
              <ArrowRight size={22} className="text-muted-foreground" />
              <div
                className={`mt-2 text-sm font-semibold inline-flex items-center gap-1 ${
                  data.delta > 0
                    ? "text-emerald-300"
                    : data.delta < 0
                      ? "text-red-300"
                      : "text-muted-foreground"
                }`}
              >
                {data.delta > 0 && <TrendingUp size={14} />}
                {data.delta > 0 ? `+${data.delta}%` : `${data.delta}%`}
              </div>
            </div>
            <ScoreCell label="Final Test" score={state.finalTestScore} total={data.finalTotal} pct={data.finalPct} highlight />
          </div>
        </section>

        {/* Question-by-question */}
        <section className="mt-6 rounded-2xl border border-surface-border bg-surface p-6 sm:p-7">
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Concept-by-concept
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            How you performed on each question across both tests.
          </p>
          <div className="space-y-2">
            <Row left="Pre-Test" right="Final Test" header />
            {Array.from({ length: Math.max(data.preRows.length, data.finalRows.length) }).map(
              (_, i) => {
                const a = data.preRows[i];
                const b = data.finalRows[i];
                const improved = a && b && !a.correct && b.correct;
                const stillGap = a && b && !a.correct && !b.correct;
                return (
                  <div
                    key={i}
                    className={`grid grid-cols-[28px_1fr_60px_60px] items-center gap-3 rounded-lg border px-3 py-2.5 ${
                      improved
                        ? "border-emerald-500/30 bg-emerald-500/[0.05]"
                        : stillGap
                          ? "border-red-500/30 bg-red-500/[0.05]"
                          : "border-surface-border bg-background/30"
                    }`}
                  >
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Q{i + 1}
                    </span>
                    <div className="text-sm text-foreground truncate" title={b?.label || a?.label || ""}>
                      {b?.label || a?.label || ""}
                    </div>
                    <ResultBadge ok={a?.correct} />
                    <ResultBadge ok={b?.correct} />
                  </div>
                );
              },
            )}
          </div>
        </section>

        {/* Knowledge gaps */}
        <section className="mt-6 rounded-2xl border border-surface-border bg-surface p-6 sm:p-7">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 text-amber-300 shrink-0" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">
                Areas that need more work
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{overallTone}</p>
              {data.gaps.length === 0 ? (
                <p className="mt-4 text-sm text-emerald-300">
                  No remaining gaps on this test — well done.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {data.gaps.map((g, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-red-500/25 bg-red-500/[0.05] p-3"
                    >
                      <div className="text-sm font-medium text-foreground">{g.q.question}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Correct answer: <span className="text-emerald-300">{g.q.correct_answer}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Suggested next */}
        {related.length > 0 && (
          <section className="mt-6 rounded-2xl border border-surface-border bg-surface p-6 sm:p-7">
            <h2 className="text-lg font-semibold text-foreground mb-4">Suggested next topics</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {related.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    try {
                      sessionStorage.setItem("knowgap:topic", t);
                    } catch {}
                    clearState();
                    navigate({ to: "/pretest" });
                  }}
                  className="rounded-xl border border-surface-border bg-background/40 p-4 text-left text-sm font-medium text-foreground hover:border-[#7C6AF7]/50 hover:bg-[#7C6AF7]/5 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Save status */}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          {saved === "saving" && "Saving session…"}
          {saved === "saved-cloud" && "✓ Saved to your account"}
          {saved === "saved-local" && "Saved locally (sign in to sync)"}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {data.gaps.length > 0 && (
            <button
              type="button"
              onClick={() => {
                // Restart learning focused on remaining gaps:
                // copy final-test wrong questions into the pretest slot and clear lesson/final.
                patchState({
                  preTestQuestions: data.gaps.map((g, i) => ({ ...g.q, id: i + 1 })),
                  preTestAnswers: data.gaps.map(() => ""),
                  preTestScore: 0,
                  lesson: [],
                  finalTestQuestions: [],
                  finalTestAnswers: [],
                  finalTestScore: 0,
                });
                navigate({ to: "/learn" });
              }}
              className="rounded-lg border border-[#7C6AF7]/50 bg-[#7C6AF7]/10 px-5 py-2.5 text-sm font-semibold text-[#7C6AF7] hover:bg-[#7C6AF7]/20"
            >
              Study these gaps
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              clearState();
              try {
                sessionStorage.removeItem("knowgap:topic");
              } catch {}
              navigate({ to: "/" });
            }}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
            style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }}
          >
            Start a new topic
          </button>
          <Link
            to="/history"
            className="rounded-lg border border-surface-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface/70"
          >
            View history
          </Link>
        </div>
      </div>
    </main>
  );
}

function ScoreCell({
  label,
  score,
  total,
  pct,
  highlight,
}: {
  label: string;
  score: number;
  total: number;
  pct: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlight ? "border-[#7C6AF7]/40 bg-[#7C6AF7]/[0.06]" : "border-surface-border bg-background/30"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-foreground tabular-nums">
        {score}/{total}
      </div>
      <div className={`mt-1 text-sm ${highlight ? "text-[#7C6AF7]" : "text-muted-foreground"}`}>
        {pct}%
      </div>
    </div>
  );
}

function Row({ left, right, header }: { left: string; right: string; header?: boolean }) {
  if (!header) return null;
  return (
    <div className="grid grid-cols-[28px_1fr_60px_60px] items-center gap-3 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span />
      <span>Question</span>
      <span className="text-center">{left}</span>
      <span className="text-center">{right}</span>
    </div>
  );
}

function ResultBadge({ ok }: { ok?: boolean }) {
  if (ok === undefined) {
    return <span className="mx-auto block text-xs text-muted-foreground">—</span>;
  }
  return (
    <span
      className={`mx-auto inline-flex h-6 w-6 items-center justify-center rounded-full ${
        ok ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
      }`}
    >
      {ok ? <Check size={14} /> : <X size={14} />}
    </span>
  );
}
