import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QuizPlayer } from "@/components/QuizPlayer";
import { FullScreenLoader } from "@/components/FullScreenLoader";
import { AiErrorState } from "@/components/AiErrorState";
import { AppHeader } from "@/components/AppHeader";
import { generateFinalTest } from "@/lib/learning.functions";
import { loadState, patchState } from "@/lib/learning-state";
import type { QuizQuestion } from "@/lib/learning-state";
import { useT } from "@/lib/i18n";
import { friendlyAiError } from "@/lib/ai-error";

export const Route = createFileRoute("/final-test")({
  component: FinalTestPage,
});

function FinalTestPage() {
  const navigate = useNavigate();
  const { t, lang, hydrated } = useT();
  const generate = useServerFn(generateFinalTest);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");

  const loadQuestions = useCallback(() => {
    if (!hydrated) return;
    setError(null);
    setQuestions(null);
    const s = loadState();
    if (!s) {
      navigate({ to: "/" });
      return;
    }
    setTopic(s.topic);
    if (s.finalTestQuestions.length > 0) {
      setQuestions(s.finalTestQuestions);
      return;
    }
    let cancelled = false;
    generate({
      data: {
        topic: s.topic,
        previousQuestions: s.preTestQuestions.map((q) => q.question),
        language: lang,
      },
    })
      .then((res) => {
        if (cancelled) return;
        if (res.error || res.questions.length === 0) {
          setError(res.error ?? friendlyAiError(new Error("AI response unavailable")));
          return;
        }
        patchState({ finalTestQuestions: res.questions });
        setQuestions(res.questions);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(friendlyAiError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, lang, hydrated]);

  useEffect(() => loadQuestions(), [loadQuestions]);

  const handleSubmit = (answers: string[], hints: boolean[]) => {
    patchState({ finalTestAnswers: answers, finalTestHints: hints });
    navigate({ to: "/final-analysis" });
  };

  if (error) {
    return <AiErrorState message={error} onRetry={loadQuestions} />;
  }

  if (!questions) {
    return <FullScreenLoader title={t("buildingFinalTest")} subtitle={t("buildingFinalTestSub")} />;
  }

  return (
    <main className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background px-4 pb-4 pt-24 animate-fade-in sm:px-6 sm:pb-6 sm:pt-28">
      <AppHeader />
      <div className="mx-auto mb-3 w-full max-w-[680px] shrink-0 text-center sm:mb-4">
        <span className="inline-flex items-center rounded-full border border-[#7C6AF7]/40 bg-[#7C6AF7]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#7C6AF7]">
          {t("stage5")}
        </span>
        <h1 className="mt-2 text-lg font-bold text-foreground sm:mt-3 sm:text-2xl">
          {t("finalTestTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{topic}</p>
      </div>

      <div className="min-h-0 flex-1">
        <QuizPlayer
          questions={questions}
          onSubmit={handleSubmit}
          submitLabel={t("submitFinalTest")}
        />
      </div>
    </main>
  );
}
