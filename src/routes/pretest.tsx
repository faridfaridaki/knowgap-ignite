import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QuizPlayer } from "@/components/QuizPlayer";
import { FullScreenLoader } from "@/components/FullScreenLoader";
import { AiErrorState } from "@/components/AiErrorState";
import { AppHeader } from "@/components/AppHeader";
import { generatePreTest } from "@/lib/learning.functions";
import { initState, loadState, patchState } from "@/lib/learning-state";
import type { QuizQuestion } from "@/lib/learning-state";
import { useT } from "@/lib/i18n";
import { friendlyAiError } from "@/lib/ai-error";

export const Route = createFileRoute("/pretest")({
  component: PreTestPage,
});

function PreTestPage() {
  const navigate = useNavigate();
  const { t, lang } = useT();
  const generate = useServerFn(generatePreTest);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");

  const loadQuestions = useCallback(() => {
    setError(null);
    setQuestions(null);
    let topicNow = "";
    try {
      topicNow = sessionStorage.getItem("knowgap:topic") ?? "";
    } catch {}
    if (!topicNow) {
      navigate({ to: "/" });
      return;
    }
    setTopic(topicNow);
    const existing = loadState();
    const state = existing && existing.topic === topicNow ? existing : initState(topicNow);
    if (state.preTestQuestions.length > 0) {
      setQuestions(state.preTestQuestions);
      return;
    }
    let cancelled = false;
    generate({ data: { topic: topicNow, language: lang } })
      .then((res) => {
        if (cancelled) return;
        patchState({ preTestQuestions: res.questions });
        setQuestions(res.questions);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setError(friendlyAiError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [generate, navigate, lang]);

  useEffect(() => loadQuestions(), [loadQuestions]);

  const handleSubmit = (answers: string[], hints: boolean[]) => {
    patchState({ preTestAnswers: answers, preTestHints: hints });
    navigate({ to: "/pretest-results" });
  };

  if (error) {
    return <AiErrorState message={error} onRetry={loadQuestions} />;
  }

  if (!questions) {
    return <FullScreenLoader title={t("generatingPreTest")} subtitle={t("generatingPreTestSub")} />;
  }

  return (
    <main className="min-h-screen w-full bg-background px-6 py-14 relative animate-fade-in">
      <AppHeader />
      <div className="mx-auto w-full max-w-[680px] mb-8 text-center">
        <span className="inline-flex items-center rounded-full border border-[#7C6AF7]/40 bg-[#7C6AF7]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#7C6AF7]">
          {t("stage1")}
        </span>
        <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-foreground">
          {t("preTestTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{topic}</p>
      </div>

      <QuizPlayer questions={questions} onSubmit={handleSubmit} />
    </main>
  );
}
