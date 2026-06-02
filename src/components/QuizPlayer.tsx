import { useState } from "react";
import type { QuizQuestion } from "@/lib/learning-state";

interface Props {
  questions: QuizQuestion[];
  onSubmit: (answers: string[]) => void;
  submitLabel?: string;
}

export function QuizPlayer({ questions, onSubmit, submitLabel = "Submit Test" }: Props) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() =>
    questions.map(() => ""),
  );

  const q = questions[idx];
  const total = questions.length;
  const isLast = idx === total - 1;
  const progress = ((idx + 1) / total) * 100;
  const currentAnswer = answers[idx] ?? "";
  const canAdvance = currentAnswer.trim().length > 0;

  const setAnswer = (val: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  return (
    <div className="w-full max-w-[680px] mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>Question {idx + 1} of {total}</span>
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
        <div className="text-xs font-medium text-[#7C6AF7] uppercase tracking-wider mb-3">
          Question {idx + 1}
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground leading-snug">
          {q.question}
        </h2>

        {q.type === "multiple_choice" && q.options ? (
          <div className="mt-6 space-y-2.5">
            {q.options.map((opt) => {
              const selected = currentAnswer === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAnswer(opt)}
                  className={`w-full text-left rounded-xl border px-4 py-3.5 text-sm transition-all ${
                    selected
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
                      {selected && (
                        <span className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </span>
                    <span>{opt}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-6">
            <input
              type="text"
              value={currentAnswer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer…"
              className="w-full rounded-xl border border-surface-border bg-background/40 px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-[#7C6AF7] focus:shadow-[0_0_0_3px_rgba(124,106,247,0.18)]"
            />
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="rounded-lg border border-surface-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface/70 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={() => onSubmit(answers)}
            disabled={!canAdvance}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-transform disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.02]"
            style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }}
          >
            {submitLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            disabled={!canAdvance}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-transform disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.02]"
            style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
