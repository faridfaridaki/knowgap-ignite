import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
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

function ScoreCell({
  label,
  score,
  total,
  pct,
  highlight,
}: {
  label: string;
  score: number;
  total: number;
  pct: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlight
          ? "border-[#7C6AF7]/40 bg-[#7C6AF7]/[0.06]"
          : "border-surface-border bg-background/30"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-foreground tabular-nums">
        {score}/{total}
      </div>
      <div
        className={`mt-1 text-sm ${highlight ? "text-[#7C6AF7]" : "text-muted-foreground"}`}
      >
        {pct}%
      </div>
    </div>
  );
}

function ResultBadge({ ok }: { ok?: boolean }) {
  if (ok === undefined) {
    return <span className="mx-auto block text-xs text-muted-foreground">—</span>;
  }
  return (
    <span
      className={`mx-auto inline-flex h-6 w-6 items-center justify-center rounded-full ${
        ok ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
      }`}
    >
      {ok ? <Check size={14} /> : <X size={14} />}
    </span>
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
          <Link
            to="/history"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} /> Back to history
          </Link>
          <p className="mt-8 text-sm text-foreground">Session not found.</p>
        </div>
      </main>
    );
  }

  const preTotal = session.preTest?.total ?? session.preTest?.questions.length ?? 0;
  const finalTotal =
    session.finalTest?.total ?? session.finalTest?.questions.length ?? 0;
  const preScore = session.preTest?.score ?? 0;
  const finalScore = session.finalTest?.score ?? 0;
  const prePct = preTotal ? Math.round((preScore / preTotal) * 100) : 0;
  const finalPct = finalTotal ? Math.round((finalScore / finalTotal) * 100) : 0;
  const delta = session.improvement ?? finalPct - prePct;

  const preRows = (session.preTest?.questions ?? []).map((q, i) => ({
    label: q.question,
    correct: isCorrect(q, session.preTest?.answers[i] ?? ""),
  }));
  const finalRows = (session.finalTest?.questions ?? []).map((q, i) => ({
    label: q.question,
    correct: isCorrect(q, session.finalTest?.answers[i] ?? ""),
  }));

  // Prefer saved knowledge gaps; fallback to recomputing from final test
  const gaps =
    session.knowledgeGaps && session.knowledgeGaps.length > 0
      ? session.knowledgeGaps
      : (session.finalTest?.questions ?? [])
          .map((q, i) => ({
            q,
            ok: isCorrect(q, session.finalTest?.answers[i] ?? ""),
          }))
          .filter((x) => !x.ok)
          .map((x) => ({
            question: x.q.question,
            correct_answer: x.q.correct_answer,
          }));

  const suggested = session.suggestedTopics ?? [];

  const overallTone =
    finalPct >= 80
      ? "Outstanding work — you've genuinely got this."
      : finalPct >= 60
        ? "Solid progress. There's still room to deepen your grasp."
        : delta > 0
          ? "You're improving, but you're still building understanding in this area."
          : "Be honest with yourself — this topic needs more work.";

  return (
    <main className="min-h-screen w-full bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-[820px]">
        <Link
          to="/history"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          <span>Back to history</span>
        </Link>

        <div className="mt-6 text-center mb-8">
          <span className="inline-flex items-center rounded-full border border-[#7C6AF7]/40 bg-[#7C6AF7]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#7C6AF7]">
            Final Analysis
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-foreground">
            {session.topic}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatDate(session.date)} · {session.stats.durationMinutes} min
          </p>
        </div>

        {/* Score comparison */}
        {(preTotal > 0 || finalTotal > 0) && (
          <section className="rounded-2xl border border-surface-border bg-surface p-6 sm:p-7">
            <h2 className="text-lg font-semibold text-foreground mb-5">
              Score Comparison
            </h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <ScoreCell
                label="Pre-Test"
                score={preScore}
                total={preTotal}
                pct={prePct}
              />
              <div className="flex flex-col items-center justify-center">
                <ArrowRight size={22} className="text-muted-foreground" />
                <div
                  className={`mt-2 text-sm font-semibold inline-flex items-center gap-1 ${
                    delta > 0
                      ? "text-emerald-300"
                      : delta < 0
                        ? "text-red-300"
                        : "text-muted-foreground"
                  }`}
                >
                  {delta > 0 && <TrendingUp size={14} />}
                  {delta > 0 ? `+${delta}%` : `${delta}%`}
                </div>
              </div>
              <ScoreCell
                label="Final Test"
                score={finalScore}
                total={finalTotal}
                pct={finalPct}
                highlight
              />
            </div>
          </section>
        )}

        {/* Question-by-question */}
        {(preRows.length > 0 || finalRows.length > 0) && (
          <section className="mt-6 rounded-2xl border border-surface-border bg-surface p-6 sm:p-7">
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Concept-by-concept
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              How you performed on each question across both tests.
            </p>
            <div className="space-y-2">
              <div className="grid grid-cols-[28px_1fr_60px_60px] items-center gap-3 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span />
                <span>Question</span>
                <span className="text-center">Pre-Test</span>
                <span className="text-center">Final Test</span>
              </div>
              {Array.from({
                length: Math.max(preRows.length, finalRows.length),
              }).map((_, i) => {
                const a = preRows[i];
                const b = finalRows[i];
                const improved = a && b && !a.correct && b.correct;
                const stillGap = a && b && !a.correct && !b.correct;
                return (
                  <div
                    key={i}
                    className={`grid grid-cols-[28px_1fr_60px_60px] items-center gap-3 rounded-lg border px-3 py-2.5 ${
                      improved
                        ? "border-emerald-500/30 bg-emerald-500/[0.05]"
                        : stillGap
                          ? "border-red-500/30 bg-red-500/[0.05]"
                          : "border-surface-border bg-background/30"
                    }`}
                  >
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Q{i + 1}
                    </span>
                    <div
                      className="text-sm text-foreground truncate"
                      title={b?.label || a?.label || ""}
                    >
                      {b?.label || a?.label || ""}
                    </div>
                    <ResultBadge ok={a?.correct} />
                    <ResultBadge ok={b?.correct} />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Knowledge gaps */}
        {session.finalTest && (
          <section className="mt-6 rounded-2xl border border-surface-border bg-surface p-6 sm:p-7">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="mt-0.5 text-amber-300 shrink-0" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Knowledge Gaps
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{overallTone}</p>
                {gaps.length === 0 ? (
                  <p className="mt-4 text-sm text-emerald-300">
                    No remaining gaps on this test — well done.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {gaps.map((g, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-red-500/25 bg-red-500/[0.05] p-3"
                      >
                        <div className="text-sm font-medium text-foreground">
                          {g.question}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Correct answer:{" "}
                          <span className="text-emerald-300">{g.correct_answer}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Suggested next topics */}
        {suggested.length > 0 && (
          <section className="mt-6 rounded-2xl border border-surface-border bg-surface p-6 sm:p-7">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Suggested next topics
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {suggested.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    try {
                      sessionStorage.removeItem("knowgap:state");
                      sessionStorage.setItem("knowgap:topic", t);
                    } catch {}
                    navigate({ to: "/pretest" });
                  }}
                  className="rounded-xl border border-surface-border bg-background/40 p-4 text-left text-sm font-medium text-foreground hover:border-[#7C6AF7]/50 hover:bg-[#7C6AF7]/5 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.removeItem("knowgap:state");
              sessionStorage.setItem("knowgap:topic", session.topic);
            } catch {}
            navigate({ to: "/pretest" });
          }}
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
