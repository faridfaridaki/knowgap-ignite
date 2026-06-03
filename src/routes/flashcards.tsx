import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { AiErrorState } from "@/components/AiErrorState";
import { AppHeader } from "@/components/AppHeader";
import { generateFlashcards } from "@/lib/learning.functions";
import { loadState, patchState } from "@/lib/learning-state";
import type { Flashcard } from "@/lib/learning-state";
import { friendlyAiError } from "@/lib/ai-error";

export const Route = createFileRoute("/flashcards")({
  component: FlashcardsPage,
});

function FlashcardsPage() {
  const navigate = useNavigate();
  const generate = useServerFn(generateFlashcards);
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFlashcards = useCallback(() => {
    setError(null);
    setCards(null);
    const s = loadState();
    if (!s) {
      navigate({ to: "/" });
      return;
    }
    if (s.flashcards.length > 0) {
      setCards(s.flashcards);
      return;
    }
    let cancelled = false;
    generate({ data: { topic: s.topic } })
      .then((res) => {
        if (cancelled) return;
        if (res.error || res.flashcards.length === 0) {
          setError(res.error ?? friendlyAiError(new Error("AI response unavailable")));
          return;
        }
        patchState({ flashcards: res.flashcards });
        setCards(res.flashcards);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setError(friendlyAiError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [generate, navigate]);

  useEffect(() => loadFlashcards(), [loadFlashcards]);

  useEffect(() => {
    setFlipped(false);
  }, [idx]);

  if (error) {
    return <AiErrorState message={error} onRetry={loadFlashcards} />;
  }

  if (!cards) {
    return (
      <main className="min-h-screen w-full bg-background flex items-center justify-center px-6 relative">
        <AppHeader />
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#7C6AF7] border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Building flashcards…</p>
        </div>
      </main>
    );
  }

  const total = cards.length;
  const card = cards[idx];

  return (
    <main className="min-h-screen w-full bg-background px-6 py-12 relative">
      <AppHeader />
      <div className="mx-auto w-full max-w-[640px]">
        <div className="text-center mb-8">
          <span className="inline-flex items-center rounded-full border border-[#4FC4CF]/40 bg-[#4FC4CF]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#4FC4CF]">
            Optional · Flashcards
          </span>
          <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-foreground">
            Quick recall practice
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tap the card to flip it.
          </p>
        </div>

        <div
          className="relative mx-auto"
          style={{ perspective: "1200px", height: 320 }}
        >
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="relative w-full h-full"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div
              className="absolute inset-0 transition-transform duration-500"
              style={{
                transformStyle: "preserve-3d",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              <div
                className="absolute inset-0 rounded-2xl border border-surface-border bg-surface flex items-center justify-center p-8 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Term
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">
                    {card.term}
                  </div>
                </div>
              </div>
              <div
                className="absolute inset-0 rounded-2xl border border-[#7C6AF7]/40 flex items-center justify-center p-8 shadow-[0_12px_40px_-12px_rgba(124,106,247,0.4)]"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  backgroundImage:
                    "linear-gradient(135deg, rgba(124,106,247,0.15), rgba(91,79,212,0.08))",
                }}
              >
                <div className="text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7C6AF7] mb-3">
                    Definition
                  </div>
                  <div className="text-lg sm:text-xl text-foreground leading-relaxed">
                    {card.definition}
                  </div>
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setIdx((i) => (i - 1 + total) % total)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-surface-border bg-surface text-foreground hover:bg-surface/70"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-muted-foreground tabular-nums">
            {idx + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-surface/70"
          >
            <RotateCw size={14} />
            Flip
          </button>
          <button
            type="button"
            onClick={() => setIdx((i) => (i + 1) % total)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-surface-border bg-surface text-foreground hover:bg-surface/70"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mt-10 flex items-center justify-between">
          <Link
            to="/learn"
            className="rounded-lg border border-surface-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface/70"
          >
            ← Back to Learning
          </Link>
          <button
            type="button"
            onClick={() => navigate({ to: "/final-test" })}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
            style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }}
          >
            Take Final Test →
          </button>
        </div>
      </div>
    </main>
  );
}
