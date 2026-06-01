import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { analyzeTopic } from "@/lib/analyze.functions";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Your Understanding Map — KnowGap" },
      {
        name: "description",
        content:
          "AI-predicted map of what you likely know and what you're missing.",
      },
    ],
  }),
  component: MapScreen,
});

type Status = "Likely Clear" | "Partially Clear" | "Likely Missing";

interface Subtopic {
  name: string;
  description: string;
  status: Status;
}

const STATUS_COLOR: Record<Status, string> = {
  "Likely Clear": "#4ADE80",
  "Partially Clear": "#FBBF24",
  "Likely Missing": "#F87171",
};

function SkeletonCard({ delay, full }: { delay: number; full: boolean }) {
  return (
    <div
      className={`rounded-2xl bg-surface border border-surface-border p-5 overflow-hidden relative ${
        full ? "sm:col-span-2" : ""
      }`}
      style={{ borderLeft: "3px solid #2A2A3A" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div
            className="h-4 w-2/3 rounded bg-[#1E1E2E] animate-pulse"
            style={{ animationDelay: `${delay}ms` }}
          />
          <div
            className="h-3 w-full rounded bg-[#1E1E2E] animate-pulse"
            style={{ animationDelay: `${delay + 80}ms` }}
          />
        </div>
        <div
          className="h-6 w-20 shrink-0 rounded-full bg-[#1E1E2E] animate-pulse"
          style={{ animationDelay: `${delay + 40}ms` }}
        />
      </div>
    </div>
  );
}

function MapScreen() {
  const [topic, setTopic] = useState("your topic");
  const [subtopics, setSubtopics] = useState<Subtopic[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeTopic);

  const run = useCallback(
    (t: string) => {
      setLoading(true);
      setError(null);
      setSubtopics(null);
      // Clear any stale subtopics so a failed/slow call can't leak prior session
      try {
        sessionStorage.removeItem("knowgap:subtopics");
      } catch {}
      analyze({ data: { topic: t } })
        .then((res) => {
          setSubtopics(res.subtopics);
          try {
            sessionStorage.setItem(
              "knowgap:subtopics",
              JSON.stringify(res.subtopics),
            );
          } catch {}
        })
        .catch((e) => {
          console.error("analyzeTopic failed:", e);
          setError("Couldn't analyze this topic. Please try again.");
        })
        .finally(() => setLoading(false));
    },
    [analyze],
  );

  useEffect(() => {
    let t = "your topic";
    try {
      const stored = sessionStorage.getItem("knowgap:topic");
      if (stored) t = stored;
    } catch {}
    setTopic(t);
    run(t);
  }, [run]);

  const handleStart = () => {
    navigate({ to: "/chat" });
  };

  const skeletonLayout = [false, false, false, false, true];

  return (
    <main className="min-h-screen w-full bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-[820px]">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </Link>

        <div className="mt-8 flex flex-col items-start">
          <span className="inline-flex max-w-full items-center rounded-full border border-[#7C6AF7]/50 px-3 py-1 text-xs font-medium text-[#7C6AF7]">
            <span className="truncate">Analyzing: {topic}</span>
          </span>
          <p className="mt-3 text-sm text-muted-foreground">
            Here's what AI predicts about your current understanding
          </p>
        </div>

        <h2 className="mt-10 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Your Understanding Map
        </h2>

        {error ? (
          <div className="mt-6 rounded-2xl bg-surface border border-surface-border p-6 text-center">
            <p className="text-foreground font-medium">{error}</p>
            <button
              type="button"
              onClick={() => run(topic)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-150 hover:scale-[1.02] active:scale-[0.99]"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #7C6AF7 0%, #5B4FD4 100%)",
              }}
            >
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {skeletonLayout.map((full, i) => (
              <SkeletonCard key={i} delay={i * 120} full={full} />
            ))}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subtopics!.map((s, i) => {
              const color = STATUS_COLOR[s.status];
              const isLast =
                i === subtopics!.length - 1 && subtopics!.length % 2 === 1;
              return (
                <div
                  key={`${s.name}-${i}`}
                  className={`opacity-0 animate-[fade-in_0.4s_ease-out_forwards] rounded-2xl bg-surface border border-surface-border p-5 ${
                    isLast ? "sm:col-span-2" : ""
                  }`}
                  style={{
                    animationDelay: `${i * 50}ms`,
                    borderLeft: `3px solid ${color}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground text-base">
                        {s.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {s.description}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap"
                      style={{
                        color,
                        backgroundColor: `${color}1A`,
                        border: `1px solid ${color}40`,
                      }}
                    >
                      {s.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!error && !loading && (
          <p className="mt-5 text-xs text-muted-foreground">
            This is a prediction, not a test result.
          </p>
        )}

        <div className="mt-8 rounded-2xl bg-surface border border-surface-border p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-foreground font-semibold">
              {loading || error || !subtopics
                ? "Analyzing subtopics…"
                : `${subtopics.length} subtopics to explore`}
            </p>
            <p className="text-sm text-muted-foreground">
              Estimated session: ~10 minutes
            </p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            KnowGap won't give you answers. It will ask questions that lead you
            to understand on your own.
          </p>

          <button
            type="button"
            onClick={handleStart}
            disabled={loading || !!error || !subtopics}
            className="mt-5 w-full rounded-xl px-6 py-3.5 text-base font-semibold text-white transition-transform duration-150 enabled:hover:scale-[1.02] enabled:active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_8px_24px_-8px_rgba(124,106,247,0.6)]"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #7C6AF7 0%, #5B4FD4 100%)",
            }}
          >
            Start Learning Session →
          </button>

          <div className="mt-4 text-center">
            <Link
              to="/"
              className="text-sm text-[#4FC4CF] hover:underline underline-offset-4"
            >
              Looks wrong? Edit topic
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
