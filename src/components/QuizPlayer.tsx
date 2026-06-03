import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import type { QuizQuestion } from "@/lib/learning-state";
import { useT } from "@/lib/i18n";

interface Props {
  questions: QuizQuestion[];
  onSubmit: (answers: string[], hints: boolean[]) => void;
  submitLabel?: string;
}

export function QuizPlayer({ questions, onSubmit, submitLabel }: Props) {
  const { t } = useT();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const [hintsUsed, setHintsUsed] = useState<boolean[]>(() => questions.map(() => false));
  // For each question, the set of options the user is allowed to choose from after a hint.
  const [allowedOptions, setAllowedOptions] = useState<Record<number, string[]>>({});

  const q = questions[idx];
  const total = questions.length;
  const isLast = idx === total - 1;
  const progress = ((idx + 1) / total) * 100;
  const currentAnswer = answers[idx] ?? "";
  const canAdvance = currentAnswer.trim().length > 0;
  const hintUsed = hintsUsed[idx] ?? false;

  const setAnswer = (val: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const useHint = () => {
    if (hintUsed || !q.options) return;
    const wrong = q.options.filter((o) => o !== q.correct_answer);
    // pick one random wrong to keep
    const keepWrong = wrong[Math.floor(Math.random() * wrong.length)];
    const allowed = q.options.filter((o) => o === q.correct_answer || o === keepWrong);
    setAllowedOptions((prev) => ({ ...prev, [idx]: allowed }));
    setHintsUsed((prev) => {
      const next = [...prev];
      next[idx] = true;
      return next;
    });
    // if user had selected one of the now-disabled options, clear it
    if (currentAnswer && !allowed.includes(currentAnswer)) {
      setAnswer("");
    }
  };

  const allowedForCurrent = useMemo(() => {
    return allowedOptions[idx] ?? (q.options ?? []);
  }, [allowedOptions, idx, q.options]);

  return (
    <div className="w-full max-w-[680px] mx-auto animate-fade-in">
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>
            {t("question")} {idx + 1} {t("of")} {total}
          </span>
          <span className="tabular-nums">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              backgroundImage: "linear-gradient(90deg, #7C6AF7, #5B4FD4)",
            }}
          />
        </div>
      </div>

      <div className="rounded-2xl bg-surface border border-surface-border p-7 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-[#7C6AF7] uppercase tracking-wider">
            {t("question")} {idx + 1}
          </div>
          {!hintUsed && q.options && q.options.length === 4 && (
            <button
              type="button"
              onClick={useHint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-400/15"
            >
              <Lightbulb size={13} />
              {t("useHint")}
            </button>
          )}
        </div>
        <h2 className="mt-3 text-xl sm:text-2xl font-semibold text-foreground leading-snug">
          {q.question}
        </h2>

        {q.options && q.options.length > 0 ? (
          <div className="mt-6 space-y-2.5">
            {q.options.map((opt) => {
              const selected = currentAnswer === opt;
              const disabled = !allowedForCurrent.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => !disabled && setAnswer(opt)}
                  disabled={disabled}
                  className={`w-full text-left rounded-xl border px-4 py-3.5 text-sm transition-all ${
                    disabled
                      ? "border-surface-border bg-background/20 text-muted-foreground/50 line-through cursor-not-allowed"
                      : selected
                        ? "border-[#7C6AF7] bg-[#7C6AF7]/10 text-foreground shadow-[0_0_0_3px_rgba(124,106,247,0.15)]"
                        : "border-surface-border bg-background/40 text-foreground hover:border-[#7C6AF7]/50 hover:bg-[#7C6AF7]/5"
                  }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                        selected ? "border-[#7C6AF7] bg-[#7C6AF7]" : "border-muted-foreground/40"
                      }`}
                    >
                      {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                    <span>{opt}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {hintUsed && (
          <p className="mt-4 text-xs text-amber-300 italic">{t("hintUsedNote")}</p>
        )}
      </div>

      {!canAdvance && (
        <p className="mt-3 text-center text-xs text-muted-foreground italic">
          {t("selectAnswerFirst")}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="rounded-lg border border-surface-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface/70 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("previous")}
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={() => onSubmit(answers, hintsUsed)}
            disabled={!canAdvance}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-transform disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.02]"
            style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }}
          >
            {submitLabel ?? t("submitTest")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            disabled={!canAdvance}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-transform disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.02]"
            style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }}
          >
            {t("next")}
          </button>
        )}
      </div>
    </div>
  );
}
