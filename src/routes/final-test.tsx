import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QuizPlayer } from "@/components/QuizPlayer";
import { FullScreenLoader } from "@/components/FullScreenLoader";
import { AppHeader } from "@/components/AppHeader";
import { generateFinalTest } from "@/lib/learning.functions";
import { loadState, patchState } from "@/lib/learning-state";
import type { QuizQuestion } from "@/lib/learning-state";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/final-test")({
  component: FinalTestPage,
});

function FinalTestPage() {
  const navigate = useNavigate();
  const { t, lang } = useT();
  const generate = useServerFn(generateFinalTest);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");

  useEffect(() => {
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
        patchState({ finalTestQuestions: res.questions });
        setQuestions(res.questions);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setError(e?.message ?? "Failed to generate final test");
      });
    return () => {
      cancelled = true;
    };
  }, [generate, navigate, lang]);

  const handleSubmit = (answers: string[], hints: boolean[]) => {
    patchState({ finalTestAnswers: answers, finalTestHints: hints });
    navigate({ to: "/final-analysis" });
  };

  if (error) {
    return (
      <main className="min-h-screen w-full bg-background px-6 py-14">
        <div className="mx-auto max-w-[680px] rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
          {error}
        </div>
      </main>
    );
  }

  if (!questions) {
    return <FullScreenLoader title={t("buildingFinalTest")} subtitle={t("buildingFinalTestSub")} />;
  }

  return (
    <main className="min-h-screen w-full bg-background px-6 py-14 relative animate-fade-in">
      <AppHeader />
      <div className="mx-auto w-full max-w-[680px] mb-8 text-center">
        <span className="inline-flex items-center rounded-full border border-[#7C6AF7]/40 bg-[#7C6AF7]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#7C6AF7]">
          {t("stage5")}
        </span>
        <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-foreground">
          {t("finalTestTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{topic}</p>
      </div>

      <QuizPlayer questions={questions} onSubmit={handleSubmit} submitLabel={t("submitFinalTest")} />
    </main>
  );
}
