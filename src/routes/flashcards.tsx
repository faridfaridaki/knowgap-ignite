import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, RotateCw, Shuffle, Sparkles } from "lucide-react";
import { AiErrorState } from "@/components/AiErrorState";
import { AppHeader } from "@/components/AppHeader";
import { generateFlashcards } from "@/lib/learning.functions";
import { loadState, patchState } from "@/lib/learning-state";
import type { Flashcard } from "@/lib/learning-state";
import { friendlyAiError } from "@/lib/ai-error";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/flashcards")({
  component: FlashcardsPage,
});

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function FlashcardsPage() {
  const navigate = useNavigate();
  const { lang, hydrated } = useT();
  const generate = useServerFn(generateFlashcards);
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(new Set([0]));
  const [error, setError] = useState<string | null>(null);

  const loadFlashcards = useCallback(() => {
    if (!hydrated) return;
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
    const lessonTitles = s.course?.lessons?.map((l) => l.title) ?? [];
    const sources =
      s.course?.lessons?.flatMap((lesson) => [
        ...(lesson.terms ?? []).map((term) => ({
          term: term.term,
          definition: term.definition,
        })),
        ...(lesson.formulas ?? []).map((formula) => ({
          term: formula.formula,
          definition: [
            formula.explanation,
            formula.variables?.length
              ? `Variables: ${formula.variables.map((v) => `${v.symbol} = ${v.meaning}`).join(", ")}`
              : "",
          ]
            .filter(Boolean)
            .join(" "),
        })),
      ]) ?? [];
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setError(friendlyAiError(new Error("AI service is busy")));
    }, 30000);
    generate({ data: { topic: s.topic, lessonTitles, sources, language: lang } })
      .then((res) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        if (res.error || res.flashcards.length === 0) {
          setError(res.error ?? friendlyAiError(new Error("AI response unavailable")));
          return;
        }
        patchState({ flashcards: res.flashcards });
        setCards(res.flashcards);
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

  useEffect(() => loadFlashcards(), [loadFlashcards]);

  useEffect(() => {
    setFlipped(false);
    setSeen((s) => {
      if (s.has(idx)) return s;
      const next = new Set(s);
      next.add(idx);
      return next;
    });
  }, [idx]);

  const total = cards?.length ?? 0;

  const goPrev = useCallback(() => {
    if (total === 0) return;
    setIdx((i) => (i - 1 + total) % total);
  }, [total]);

  const goNext = useCallback(() => {
    if (total === 0) return;
    setIdx((i) => (i + 1) % total);
  }, [total]);

  const flip = useCallback(() => setFlipped((f) => !f), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        flip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, flip]);

  const shuffle = () => {
    if (!cards) return;
    const next = shuffleArr(cards);
    setCards(next);
    patchState({ flashcards: next });
    setIdx(0);
    setSeen(new Set([0]));
    setFlipped(false);
  };

  const allSeen = useMemo(() => total > 0 && seen.size >= total, [seen, total]);

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

  const card = cards[idx];

  return (
    <main className="min-h-screen w-full bg-background px-6 py-12 relative">
      <AppHeader />
      <div className="mx-auto w-full max-w-[720px]">
        <div className="flex items-center justify-between mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4FC4CF]/40 bg-[#4FC4CF]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#4FC4CF]">
            <Sparkles size={12} /> Practice Flashcards
          </span>
          <Link
            to="/final-test"
            className="text-xs font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Skip Flashcards →
          </Link>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Quick recall practice</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tap the card or press{" "}
            <kbd className="rounded border border-surface-border bg-surface px-1.5 py-0.5 text-[10px]">
              Space
            </kbd>{" "}
            to flip · use{" "}
            <kbd className="rounded border border-surface-border bg-surface px-1.5 py-0.5 text-[10px]">
              ←
            </kbd>{" "}
            <kbd className="rounded border border-surface-border bg-surface px-1.5 py-0.5 text-[10px]">
              →
            </kbd>{" "}
            to navigate
          </p>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground tabular-nums">
            Card {idx + 1} of {total}
          </span>
          <button
            type="button"
            onClick={shuffle}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface/70"
          >
            <Shuffle size={13} /> Shuffle
          </button>
        </div>

        <div className="relative mx-auto" style={{ perspective: "1200px", height: 360 }}>
          <button
            type="button"
            onClick={flip}
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
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                    Term
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold text-foreground">{card.term}</div>
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
            onClick={goPrev}
            aria-label="Previous card"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-surface-border bg-surface text-foreground hover:bg-surface/70"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={flip}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface/70"
          >
            <RotateCw size={14} />
            Flip
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next card"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-surface-border bg-surface text-foreground hover:bg-surface/70"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mt-10 flex items-center justify-between gap-3">
          <Link
            to="/course"
            className="rounded-lg border border-surface-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface/70"
          >
            ← Back to Course
          </Link>
          {allSeen ? (
            <button
              type="button"
              onClick={() => navigate({ to: "/final-test" })}
              className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] animate-fade-in"
              style={{ backgroundImage: "linear-gradient(135deg, #10b981, #059669)" }}
            >
              Done! Ready for the Final Test →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate({ to: "/final-test" })}
              className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }}
            >
              Take Final Test →
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
