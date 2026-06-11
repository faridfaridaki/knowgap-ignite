import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QuizPlayer } from "@/components/QuizPlayer";
import { FullScreenLoader } from "@/components/FullScreenLoader";
import { AiErrorState } from "@/components/AiErrorState";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { generatePreTest } from "@/lib/learning.functions";
import { initState, loadState, patchState } from "@/lib/learning-state";
import type { QuizQuestion } from "@/lib/learning-state";
import { useT } from "@/lib/i18n";
import { friendlyAiError } from "@/lib/ai-error";

export const Route = createFileRoute("/pretest")({
  component: PreTestRoute,
});

function PreTestRoute() {
  const { t } = useT();
  return (
    <AuthGuard preserveTopicForAuth loadingTitle={t("pleaseWait")}>
      <PreTestPage />
    </AuthGuard>
  );
}

function PreTestPage() {
  const navigate = useNavigate();
  const { t, lang, hydrated } = useT();
  const generate = useServerFn(generatePreTest);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");

  const loadQuestions = useCallback(() => {
    if (!hydrated) return;
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
    const state =
      existing && existing.topic === topicNow && existing.language === lang
        ? existing
        : initState(topicNow, lang);
    if (state.preTestQuestions.length > 0) {
      setQuestions(state.preTestQuestions);
      return;
    }
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setError(friendlyAiError(new Error("AI service is busy")));
    }, 25000);
    generate({ data: { topic: topicNow, language: lang } })
      .then((res) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        if (res.error || !res.questions || res.questions.length === 0) {
          setError(res.error ?? friendlyAiError(new Error("busy")));
          return;
        }
        patchState({ language: lang, preTestQuestions: res.questions });
        setQuestions(res.questions);
      })
      .catch((e) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setError(friendlyAiError(e));
      });
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [navigate, lang, hydrated]);

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
    <main className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background px-4 pb-4 pt-24 animate-fade-in sm:px-6 sm:pb-6 sm:pt-28">
      <AppHeader />
      <div className="mx-auto mb-3 w-full max-w-[680px] shrink-0 text-center sm:mb-4">
        <span className="inline-flex items-center rounded-full border border-[#7C6AF7]/40 bg-[#7C6AF7]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#7C6AF7]">
          {t("stage1")}
        </span>
        <h1 className="mt-2 text-lg font-bold text-foreground sm:mt-3 sm:text-2xl">
          {t("preTestTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{topic}</p>
      </div>

      <div className="min-h-0 flex-1">
        <QuizPlayer questions={questions} onSubmit={handleSubmit} />
      </div>
    </main>
  );
}
