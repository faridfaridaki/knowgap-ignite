import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  loadState,
  patchState,
  scoreTest,
  isAnswerCorrect,
  formatScore,
} from "@/lib/learning-state";
import type { LearningState } from "@/lib/learning-state";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/pretest-results")({
  component: PreTestResults,
});

function PreTestResults() {
  const navigate = useNavigate();
  const { t } = useT();
  const [state, setState] = useState<LearningState | null>(null);

  useEffect(() => {
    const s = loadState();
    if (!s || s.preTestQuestions.length === 0 || s.preTestAnswers.length === 0) {
      navigate({ to: "/" });
      return;
    }
    const score = scoreTest(s.preTestQuestions, s.preTestAnswers, s.preTestHints);
    const next = patchState({ preTestScore: score });
    setState(next);
  }, [navigate]);

  const pct = useMemo(() => {
    if (!state || state.preTestQuestions.length === 0) return 0;
    return Math.round((state.preTestScore / state.preTestQuestions.length) * 100);
  }, [state]);

  if (!state) return null;

  const total = state.preTestQuestions.length;

  return (
    <main className="min-h-screen w-full bg-background px-6 py-14 relative animate-fade-in">
      <AppHeader />
      <div className="mx-auto w-full max-w-[720px]">
        <div className="text-center mb-10">
          <span className="inline-flex items-center rounded-full border border-[#7C6AF7]/40 bg-[#7C6AF7]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#7C6AF7]">
            {t("stage2")}
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-foreground">
            {t("youGot")} {formatScore(state.preTestScore)} {t("outOf")} {total} {t("correct")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("dontWorry")}</p>
          <div className="mt-6 mx-auto max-w-md">
            <div className="h-3 w-full rounded-full bg-surface overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  backgroundImage: "linear-gradient(90deg, #7C6AF7, #4FC4CF)",
                }}
              />
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">{pct}%</div>
          </div>
        </div>

        <div className="space-y-4">
          {state.preTestQuestions.map((q, i) => {
            const given = state.preTestAnswers[i] ?? "";
            const correct = isAnswerCorrect(q, given);
            return (
              <div
                key={q.id}
                className={`rounded-2xl border p-5 ${
                  correct
                    ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                    : "border-red-500/30 bg-red-500/[0.04]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      correct ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                    }`}
                  >
                    {correct ? <Check size={16} /> : <X size={16} />}
                  </span>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-1">
                      {t("question")} {i + 1}
                    </div>
                    <p className="text-base font-medium text-foreground">{q.question}</p>

                    <div className="mt-3 space-y-1.5 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t("yourAnswer")} </span>
                        <span className={correct ? "text-emerald-300" : "text-red-300"}>
                          {given || <em className="opacity-60">—</em>}
                        </span>
                      </div>
                      {!correct && (
                        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                          <span className="text-emerald-300 font-medium">{t("correctLabel")} </span>
                          <span className="text-foreground">{q.correct_answer}</span>
                        </div>
                      )}
                      {q.explanation && (
                        <p className="text-muted-foreground italic mt-2">{q.explanation}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => navigate({ to: "/course" })}
            className="rounded-xl px-7 py-3.5 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,106,247,0.6)] transition-transform hover:scale-[1.02]"
            style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }}
          >
            {t("startLearning")}
          </button>
        </div>
      </div>
    </main>
  );
}
