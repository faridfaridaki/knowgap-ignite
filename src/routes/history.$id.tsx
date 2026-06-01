import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  getSession,
  formatDate,
  STATUS_COLOR,
  type HistorySession,
  type Status,
} from "@/lib/history";

export const Route = createFileRoute("/history/$id")({
  head: () => ({
    meta: [
      { title: "Session — KnowGap" },
      { name: "description", content: "Saved KnowGap learning session." },
    ],
  }),
  component: HistoryDetail,
});

function StatusBadge({ status }: { status: Status }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="inline-block shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap"
      style={{
        color,
        backgroundColor: `${color}1A`,
        border: `1px solid ${color}40`,
      }}
    >
      {status}
    </span>
  );
}

function HistoryDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<HistorySession | null | undefined>(
    undefined,
  );

  useEffect(() => {
    setSession(getSession(id) ?? null);
  }, [id]);

  const handleRestart = () => {
    if (!session) return;
    try {
      sessionStorage.removeItem("knowgap:subtopics");
      sessionStorage.removeItem("knowgap:messages");
      sessionStorage.removeItem("knowgap:startedAt");
      sessionStorage.setItem("knowgap:pendingTopic", session.topic);
    } catch {}
    navigate({ to: "/" });
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

  return (
    <main className="min-h-screen w-full bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-[680px]">
        <Link
          to="/history"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          <span>Back to history</span>
        </Link>

        <h1 className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          {session.topic}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatDate(session.date)} · {session.stats.questionsAnswered} question
          {session.stats.questionsAnswered === 1 ? "" : "s"} ·{" "}
          {session.stats.durationMinutes} min
        </p>

        {/* Before/After Knowledge Map */}
        <section className="mt-8 rounded-2xl border border-surface-border bg-surface/60 backdrop-blur-sm p-2 sm:p-4">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 sm:gap-x-3 items-center px-2 sm:px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
            <span>Subtopic</span>
            <span className="text-center">Before</span>
            <span />
            <span className="text-center">After</span>
          </div>
          {session.subtopics.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No subtopics recorded.
            </p>
          ) : (
            session.subtopics.map((s, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 sm:gap-x-3 rounded-xl px-2 sm:px-3 py-3"
              >
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {s.name}
                </span>
                <StatusBadge status={s.status} />
                <ArrowRight size={14} className="text-muted-foreground" />
                <StatusBadge status="Likely Clear" />
              </div>
            ))
          )}
        </section>

        {/* Transcript */}
        <section className="mt-8 rounded-2xl border border-surface-border bg-surface/60 backdrop-blur-sm p-5">
          <h2 className="text-lg font-bold text-foreground">Transcript</h2>
          <div className="mt-5 flex flex-col gap-4">
            {session.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages.</p>
            ) : (
              session.messages.map((m, i) =>
                m.role === "assistant" ? (
                  <div key={i} className="flex flex-col items-start">
                    <span className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                      KnowGap
                    </span>
                    <div
                      className="max-w-[90%] rounded-2xl rounded-bl-sm bg-surface px-4 py-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap"
                      style={{
                        borderLeft: "3px solid #7C6AF7",
                        fontWeight: 300,
                        fontStyle: "italic",
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[90%] rounded-2xl bg-[#7C6AF7] px-4 py-3 text-sm leading-relaxed text-white whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                ),
              )
            )}
          </div>
        </section>

        <button
          type="button"
          onClick={handleRestart}
          className="mt-8 w-full rounded-xl px-6 py-3.5 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,106,247,0.6)] transition-transform hover:scale-[1.02] active:scale-[0.99]"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #7C6AF7 0%, #5B4FD4 100%)",
          }}
        >
          Start this topic again →
        </button>
      </div>
    </main>
  );
}
