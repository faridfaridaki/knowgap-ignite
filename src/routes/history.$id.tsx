import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, X, Lightbulb } from "lucide-react";
import {
  getSession,
  formatDate,
  type HistorySession,
  type HistoryQuizQuestion,
} from "@/lib/history";
import { fetchConversation } from "@/lib/history-db";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/history/$id")({
  head: () => ({
    meta: [
      { title: "Session — KnowGap" },
      { name: "description", content: "Saved KnowGap learning session." },
    ],
  }),
  component: () => (
    <AuthGuard>
      <HistoryDetail />
    </AuthGuard>
  ),
});

function normalize(s: string) {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!?;:,"']/g, "");
}
function isCorrect(q: HistoryQuizQuestion, a: string) {
  if (!a) return false;
  const g = normalize(a);
  const c = normalize(q.correct_answer);
  if (g === c) return true;
  if (q.type === "multiple_choice") return false;
  if (g.length >= 3 && c.includes(g)) return true;
  if (c.length >= 3 && g.includes(c)) return true;
  return false;
}

function TestSection({
  title,
  questions,
  answers,
  score,
}: {
  title: string;
  questions: HistoryQuizQuestion[];
  answers: string[];
  score: number;
}) {
  const total = questions.length;
  const pct = total ? Math.round((score / total) * 100) : 0;
  return (
    <details className="mt-4 rounded-2xl border border-surface-border bg-surface/60 backdrop-blur-sm">
      <summary className="cursor-pointer list-none p-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {score}/{total} correct · {pct}%
          </p>
        </div>
        <span className="text-xs text-muted-foreground">Expand</span>
      </summary>
      <div className="px-5 pb-5 space-y-3">
        {questions.map((q, i) => {
          const given = answers[i] ?? "";
          const ok = isCorrect(q, given);
          return (
            <div
              key={q.id ?? i}
              className={`rounded-xl border p-4 ${
                ok ? "border-emerald-500/30 bg-emerald-500/[0.04]" : "border-red-500/30 bg-red-500/[0.04]"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    ok ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {ok ? <Check size={12} /> : <X size={12} />}
                </span>
                <div className="flex-1 text-sm">
                  <p className="font-medium text-foreground">{q.question}</p>
                  <p className="mt-1 text-muted-foreground">
                    Your answer:{" "}
                    <span className={ok ? "text-emerald-300" : "text-red-300"}>
                      {given || <em className="opacity-60">(blank)</em>}
                    </span>
                  </p>
                  {!ok && (
                    <p className="mt-1 text-emerald-300">
                      Correct: <span className="text-foreground">{q.correct_answer}</span>
                    </p>
                  )}
                  {q.explanation && (
                    <p className="mt-1 italic text-muted-foreground">{q.explanation}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function HistoryDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState<HistorySession | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (user) {
        const row = await fetchConversation(user.id, id);
        if (cancelled) return;
        if (row) {
          setSession(row);
          return;
        }
      }
      if (!cancelled) setSession(getSession(id) ?? null);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  const handleRestart = () => {
    if (!session) return;
    try {
      sessionStorage.removeItem("knowgap:state");
      sessionStorage.setItem("knowgap:topic", session.topic);
    } catch {}
    navigate({ to: "/pretest" });
  };

  if (session === undefined) {
    return (
      <main className="min-h-screen w-full bg-background px-6 py-10">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }
  if (session === null) {
    return (
      <main className="min-h-screen w-full bg-background px-6 py-10">
        <div className="mx-auto w-full max-w-[680px]">
          <Link to="/history" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} /> Back to history
          </Link>
          <p className="mt-8 text-sm text-foreground">Session not found.</p>
        </div>
      </main>
    );
  }

  const preTotal = session.preTest?.questions.length ?? 0;
  const finalTotal = session.finalTest?.questions.length ?? 0;
  const prePct = preTotal ? Math.round((session.preTest!.score / preTotal) * 100) : null;
  const finalPct = finalTotal ? Math.round((session.finalTest!.score / finalTotal) * 100) : null;
  const delta = prePct !== null && finalPct !== null ? finalPct - prePct : null;

  return (
    <main className="min-h-screen w-full bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-[760px]">
        <Link to="/history" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} />
          <span>Back to history</span>
        </Link>

        <h1 className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          {session.topic}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatDate(session.date)} · {session.stats.durationMinutes} min
        </p>

        {(prePct !== null || finalPct !== null) && (
          <section className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-surface-border bg-surface/60 p-4 text-center">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Pre-Test</div>
              <div className="mt-1 text-2xl font-bold text-foreground tabular-nums">
                {prePct !== null ? `${session.preTest!.score}/${preTotal}` : "—"}
              </div>
              {prePct !== null && (
                <div className="text-xs text-muted-foreground">{prePct}%</div>
              )}
            </div>
            <div className="rounded-xl border border-surface-border bg-surface/60 p-4 text-center flex items-center justify-center">
              <div
                className={`text-base font-semibold ${
                  delta === null
                    ? "text-muted-foreground"
                    : delta > 0
                      ? "text-emerald-300"
                      : delta < 0
                        ? "text-red-300"
                        : "text-muted-foreground"
                }`}
              >
                {delta === null ? "—" : delta > 0 ? `+${delta}%` : `${delta}%`}
              </div>
            </div>
            <div className="rounded-xl border border-[#7C6AF7]/40 bg-[#7C6AF7]/[0.08] p-4 text-center">
              <div className="text-[11px] uppercase tracking-wider text-[#7C6AF7]">Final Test</div>
              <div className="mt-1 text-2xl font-bold text-foreground tabular-nums">
                {finalPct !== null ? `${session.finalTest!.score}/${finalTotal}` : "—"}
              </div>
              {finalPct !== null && (
                <div className="text-xs text-[#7C6AF7]">{finalPct}%</div>
              )}
            </div>
          </section>
        )}

        {session.preTest && (
          <TestSection
            title="Pre-test questions"
            questions={session.preTest.questions}
            answers={session.preTest.answers}
            score={session.preTest.score}
          />
        )}

        {session.lesson && session.lesson.length > 0 && (
          <details className="mt-4 rounded-2xl border border-surface-border bg-surface/60 backdrop-blur-sm">
            <summary className="cursor-pointer list-none p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Lesson</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {session.lesson.length} concept{session.lesson.length === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">Expand</span>
            </summary>
            <div className="px-5 pb-5 space-y-4">
              {session.lesson.map((c, i) => (
                <article key={i} className="rounded-xl border border-surface-border bg-background/40 p-4">
                  <h4 className="text-base font-semibold text-foreground">{c.concept}</h4>
                  <p className="mt-2 text-sm text-foreground leading-relaxed">{c.simple_explanation}</p>
                  <div className="mt-3 rounded-lg border border-[#4FC4CF]/25 bg-[#4FC4CF]/[0.06] p-3 text-sm text-foreground">
                    {c.real_life_example}
                  </div>
                  <div className="mt-3 rounded-lg border border-[#7C6AF7]/40 bg-[#7C6AF7]/10 p-3 text-sm text-foreground flex gap-2">
                    <Lightbulb size={16} className="mt-0.5 text-[#7C6AF7] shrink-0" />
                    <span className="font-medium">{c.key_takeaway}</span>
                  </div>
                </article>
              ))}
            </div>
          </details>
        )}

        {session.finalTest && (
          <TestSection
            title="Final test questions"
            questions={session.finalTest.questions}
            answers={session.finalTest.answers}
            score={session.finalTest.score}
          />
        )}

        {session.flashcards && session.flashcards.length > 0 && (
          <details className="mt-4 rounded-2xl border border-surface-border bg-surface/60 backdrop-blur-sm">
            <summary className="cursor-pointer list-none p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Flashcards</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {session.flashcards.length} cards
                </p>
              </div>
              <span className="text-xs text-muted-foreground">Expand</span>
            </summary>
            <div className="px-5 pb-5 grid sm:grid-cols-2 gap-3">
              {session.flashcards.map((f, i) => (
                <div key={i} className="rounded-xl border border-surface-border bg-background/40 p-4">
                  <div className="text-sm font-semibold text-foreground">{f.term}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{f.definition}</div>
                </div>
              ))}
            </div>
          </details>
        )}

        <button
          type="button"
          onClick={handleRestart}
          className="mt-8 w-full rounded-xl px-6 py-3.5 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,106,247,0.6)] transition-transform hover:scale-[1.02] active:scale-[0.99]"
          style={{
            backgroundImage: "linear-gradient(135deg, #7C6AF7 0%, #5B4FD4 100%)",
          }}
        >
          Restart this topic →
        </button>
      </div>
    </main>
  );
}
