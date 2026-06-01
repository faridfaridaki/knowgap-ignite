import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import {
  loadHistory,
  formatDate,
  STATUS_COLOR,
  type HistorySession,
} from "@/lib/history";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Your Learning History — KnowGap" },
      { name: "description", content: "Past KnowGap learning sessions." },
    ],
  }),
  component: HistoryScreen,
});

function HistoryScreen() {
  const [sessions, setSessions] = useState<HistorySession[]>([]);

  useEffect(() => {
    setSessions(loadHistory());
  }, []);

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
          {sessions.length} saved session{sessions.length === 1 ? "" : "s"}
        </p>

        {sessions.length === 0 ? (
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
            {sessions.map((s) => (
              <Link
                key={s.id}
                to="/history/$id"
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
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.stats.questionsAnswered} question
                  {s.stats.questionsAnswered === 1 ? "" : "s"} ·{" "}
                  {s.stats.durationMinutes} min
                </p>
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
