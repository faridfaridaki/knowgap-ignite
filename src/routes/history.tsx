import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import {
  loadHistory,
  formatDate,
  STATUS_COLOR,
  type HistorySession,
} from "@/lib/history";
import { fetchConversationsForUser } from "@/lib/history-db";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Your Learning History — KnowGap" },
      { name: "description", content: "Past KnowGap learning sessions." },
    ],
  }),
  component: () => (
    <AuthGuard>
      <HistoryScreen />
    </AuthGuard>
  ),
});

function HistoryScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (user) {
        const rows = await fetchConversationsForUser(user.id);
        if (!cancelled) {
          setSessions(rows);
          setLoading(false);
        }
      } else {
        setSessions(loadHistory());
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <main className="min-h-screen w-full bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-[720px]">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </Link>

        <h1 className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Your Learning History
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {loading
            ? "Loading…"
            : `${sessions.length} saved session${sessions.length === 1 ? "" : "s"}`}
        </p>

        {!loading && sessions.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full"
              style={{
                backgroundColor: "rgba(124,106,247,0.12)",
                border: "1px solid rgba(124,106,247,0.3)",
              }}
            >
              <BookOpen size={36} className="text-[#7C6AF7]" />
            </div>
            <p className="mt-5 text-base text-foreground font-medium">
              No sessions yet.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start learning to build your history.
            </p>
            <Link
              to="/"
              className="mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,106,247,0.6)]"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #7C6AF7 0%, #5B4FD4 100%)",
              }}
            >
              Start learning →
            </Link>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-3">
            {sessions.map((s) => {
              const preTotal = s.preTest?.questions.length ?? 0;
              const finalTotal = s.finalTest?.questions.length ?? 0;
              const prePct = preTotal
                ? Math.round((s.preTest!.score / preTotal) * 100)
                : null;
              const finalPct = finalTotal
                ? Math.round((s.finalTest!.score / finalTotal) * 100)
                : null;
              const delta =
                prePct !== null && finalPct !== null ? finalPct - prePct : null;
              return (
                <Link
                  key={s.id}
                  to="/final-analysis/$id"
                  params={{ id: s.id }}
                  className="block rounded-2xl border border-surface-border bg-surface/60 backdrop-blur-sm p-5 transition-all hover:border-[#7C6AF7]/60 hover:bg-surface"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="truncate text-base font-bold text-foreground">
                      {s.topic}
                    </h2>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(s.date)}
                    </span>
                  </div>
                  {prePct !== null || finalPct !== null ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      {prePct !== null && (
                        <span className="rounded-full border border-surface-border bg-background/40 px-2.5 py-1 text-foreground">
                          Pre {s.preTest!.score}/{preTotal} ({prePct}%)
                        </span>
                      )}
                      {finalPct !== null && (
                        <span className="rounded-full border border-[#7C6AF7]/40 bg-[#7C6AF7]/10 px-2.5 py-1 text-[#7C6AF7] font-medium">
                          Final {s.finalTest!.score}/{finalTotal} ({finalPct}%)
                        </span>
                      )}
                      {delta !== null && delta !== 0 && (
                        <span
                          className={`rounded-full px-2 py-1 font-semibold ${
                            delta > 0
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-red-500/15 text-red-300"
                          }`}
                        >
                          {delta > 0 ? `+${delta}%` : `${delta}%`}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.stats.questionsAnswered} question
                      {s.stats.questionsAnswered === 1 ? "" : "s"} ·{" "}
                      {s.stats.durationMinutes} min
                    </p>
                  )}
                  {s.subtopics.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {s.subtopics.map((sub, i) => {
                        const color = STATUS_COLOR[sub.status];
                        return (
                          <span
                            key={i}
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              color,
                              backgroundColor: `${color}1A`,
                              border: `1px solid ${color}40`,
                            }}
                          >
                            {sub.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
