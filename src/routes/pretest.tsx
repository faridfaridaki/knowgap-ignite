import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QuizPlayer } from "@/components/QuizPlayer";
import { generatePreTest } from "@/lib/learning.functions";
import { initState, loadState, patchState } from "@/lib/learning-state";
import type { QuizQuestion } from "@/lib/learning-state";

export const Route = createFileRoute("/pretest")({
  component: PreTestPage,
});

function PreTestPage() {
  const navigate = useNavigate();
  const generate = useServerFn(generatePreTest);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");

  useEffect(() => {
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
    generate({ data: { topic: topicNow } })
      .then((res) => {
        if (cancelled) return;
        patchState({ preTestQuestions: res.questions });
        setQuestions(res.questions);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setError(e?.message ?? "Failed to generate quiz");
      });
    return () => {
      cancelled = true;
    };
  }, [generate, navigate]);

  const handleSubmit = (answers: string[]) => {
    patchState({ preTestAnswers: answers });
    navigate({ to: "/pretest-results" });
  };

  return (
    <main className="min-h-screen w-full bg-background px-6 py-14">
      <div className="mx-auto w-full max-w-[680px] mb-8 text-center">
        <span className="inline-flex items-center rounded-full border border-[#7C6AF7]/40 bg-[#7C6AF7]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#7C6AF7]">
          Stage 1 · Pre-Test
        </span>
        <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-foreground">
          Let's see what you already know
        </h1>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{topic}</p>
      </div>

      {error && (
        <div className="mx-auto max-w-[680px] rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
          {error}
        </div>
      )}

      {!questions && !error && (
        <div className="mx-auto max-w-[680px] rounded-2xl border border-surface-border bg-surface p-10 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#7C6AF7] border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Generating your pre-test…</p>
        </div>
      )}

      {questions && <QuizPlayer questions={questions} onSubmit={handleSubmit} />}
    </main>
  );
}
