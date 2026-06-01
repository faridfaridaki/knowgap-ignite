import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, BookOpen, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import { suggestRelatedTopics } from "@/lib/analyze.functions";

export const Route = createFileRoute("/summary")({
  head: () => ({
    meta: [
      { title: "Session Summary — KnowGap" },
      { name: "description", content: "Summary of your KnowGap learning session." },
    ],
  }),
  component: SummaryScreen,
});

type Status = "Likely Clear" | "Partially Clear" | "Likely Missing";

interface Subtopic {
  name: string;
  description: string;
  status: Status;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const STATUS_COLOR: Record<Status, string> = {
  "Likely Clear": "#4ADE80",
  "Partially Clear": "#FBBF24",
  "Likely Missing": "#F87171",
};

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

function AnimatedCheck() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="36"
        cy="36"
        r="32"
        stroke="#4ADE80"
        strokeWidth="3"
        fill="rgba(74,222,128,0.08)"
        strokeDasharray="201"
        strokeDashoffset="201"
        style={{
          animation: "knowgap-draw 0.8s ease-out forwards",
        }}
      />
      <path
        d="M22 37 L32 47 L51 27"
        stroke="#4ADE80"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray="60"
        strokeDashoffset="60"
        style={{
          animation: "knowgap-draw 0.5s ease-out 0.6s forwards",
        }}
      />
      <style>{`
        @keyframes knowgap-draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  );
}

function SummaryScreen() {
  const navigate = useNavigate();
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [topic, setTopic] = useState("your topic");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [elapsedMin, setElapsedMin] = useState(1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const reviewRef = useRef<HTMLDivElement>(null);
  const suggest = useServerFn(suggestRelatedTopics);
  const suggestRef = useRef(false);

  useEffect(() => {
    try {
      const storedTopic = sessionStorage.getItem("knowgap:topic");
      if (storedTopic) setTopic(storedTopic);
      const storedSubs = sessionStorage.getItem("knowgap:subtopics");
      if (storedSubs) setSubtopics(JSON.parse(storedSubs));
      const storedMsgs = sessionStorage.getItem("knowgap:messages");
      if (storedMsgs) setMessages(JSON.parse(storedMsgs));
      const startedAt = sessionStorage.getItem("knowgap:startedAt");
      if (startedAt) {
        const min = Math.max(1, Math.round((Date.now() - Number(startedAt)) / 60000));
        setElapsedMin(min);
      }
    } catch {}
  }, []);

  const fallbackSuggestions = (t: string) => [
    `Deep dive into ${t}: edge cases`,
    `History and origins of ${t}`,
    `How ${t} connects to related fields`,
  ];

  useEffect(() => {
    if (!topic || topic === "your topic") return;
    if (suggestRef.current) return;
    suggestRef.current = true;
    suggest({ data: { topic } })
      .then((res) => {
        if (res?.topics && res.topics.length > 0) {
          setSuggestions(res.topics);
        } else {
          setSuggestions(fallbackSuggestions(topic));
        }
      })
      .catch((e) => {
        console.error("suggestRelatedTopics failed:", e);
        setSuggestions(fallbackSuggestions(topic));
      });
  }, [topic, suggest]);

  const questionsAnswered = useMemo(
    () => messages.filter((m) => m.role === "user").length,
    [messages],
  );

  const resetSession = () => {
    try {
      sessionStorage.removeItem("knowgap:topic");
      sessionStorage.removeItem("knowgap:subtopics");
      sessionStorage.removeItem("knowgap:messages");
      sessionStorage.removeItem("knowgap:startedAt");
      sessionStorage.removeItem("knowgap:pendingTopic");
    } catch {}
  };

  const handleStartTopic = (newTopic: string) => {
    resetSession();
    try {
      sessionStorage.setItem("knowgap:pendingTopic", newTopic);
    } catch {}
    navigate({ to: "/" });
  };

  const handleNewTopic = () => {
    resetSession();
    navigate({ to: "/" });
  };

  const handleReview = () => {
    reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="min-h-screen w-full bg-background px-6 py-12">
      <div className="mx-auto w-full max-w-[680px]">
        <div className="flex justify-center">
          <AnimatedCheck />
        </div>

        <h1 className="mt-6 text-center text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Here's what changed
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Your understanding of <span className="text-foreground">{topic}</span>
        </p>

        <div className="mt-4 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4ADE80]/40 bg-[#4ADE80]/10 px-3 py-1 text-xs font-medium text-[#4ADE80]">
            <CheckCircle2 size={14} />
            Session saved to your history
          </span>
        </div>

        {/* Before/After table */}
        <div className="mt-10 rounded-2xl border border-surface-border bg-surface/60 backdrop-blur-sm p-2 sm:p-4">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 sm:gap-x-3 gap-y-1 items-center px-2 sm:px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
            <span>Subtopic</span>
            <span className="text-center">Before</span>
            <span />
            <span className="text-center">After</span>
          </div>

          {subtopics.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No subtopics from this session.
            </p>
          ) : (
            subtopics.map((s, i) => {
              const improved = s.status !== "Likely Clear";
              return (
                <div
                  key={`${s.name}-${i}`}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 sm:gap-x-3 rounded-xl px-2 sm:px-3 py-3 transition-colors"
                  style={
                    improved
                      ? {
                          borderLeft: "3px solid #4ADE80",
                          backgroundColor: "rgba(74,222,128,0.06)",
                          boxShadow: "0 0 24px -8px rgba(74,222,128,0.35)",
                        }
                      : { borderLeft: "3px solid transparent" }
                  }
                >
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {s.name}
                  </span>
                  <StatusBadge status={s.status} />
                  <ArrowRight size={14} className="text-muted-foreground" />
                  <StatusBadge status="Likely Clear" />
                </div>
              );
            })
          )}
        </div>

        {/* Session stats */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              icon: <MessageCircle size={16} className="text-[#7C6AF7]" />,
              text: `${questionsAnswered} question${questionsAnswered === 1 ? "" : "s"} answered`,
            },
            {
              icon: <BookOpen size={16} className="text-[#7C6AF7]" />,
              text: `${subtopics.length} subtopic${subtopics.length === 1 ? "" : "s"} explored`,
            },
            {
              icon: <Clock size={16} className="text-[#7C6AF7]" />,
              text: `~${elapsedMin} min`,
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-xl border border-surface-border bg-surface/60 backdrop-blur-sm px-4 py-3"
            >
              {stat.icon}
              <span className="text-sm text-foreground">{stat.text}</span>
            </div>
          ))}
        </div>

        {/* Continue learning */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-foreground">Continue learning</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What to explore next
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3">
            {suggestions.map((sug, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleStartTopic(sug)}
                className="text-left rounded-2xl border border-surface-border bg-surface/60 backdrop-blur-sm p-4 transition-all hover:border-[#7C6AF7]/60 hover:bg-surface"
              >
                <p className="text-sm font-medium text-foreground">{sug}</p>
                <p className="mt-1 text-xs text-[#7C6AF7]">
                  → Start with KnowGap
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Actions */}
        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleNewTopic}
            className="flex-1 rounded-xl px-6 py-3.5 text-base font-semibold text-white transition-transform duration-150 hover:scale-[1.02] active:scale-[0.99] shadow-[0_8px_24px_-8px_rgba(124,106,247,0.6)]"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #7C6AF7 0%, #5B4FD4 100%)",
            }}
          >
            Start a new topic →
          </button>
          <button
            type="button"
            onClick={handleReview}
            className="flex-1 rounded-xl border border-surface-border bg-transparent px-6 py-3.5 text-base font-semibold text-foreground transition-colors hover:bg-surface"
          >
            Review this session
          </button>
        </div>

        {/* Read-only session log */}
        <section
          ref={reviewRef}
          className="mt-14 rounded-2xl border border-surface-border bg-surface/60 backdrop-blur-sm p-5"
        >
          <h2 className="text-lg font-bold text-foreground">Session log</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Read-only transcript of your conversation
          </p>
          <div className="mt-5 flex flex-col gap-4">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No messages from this session.
              </p>
            ) : (
              messages.map((m, i) =>
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
      </div>
    </main>
  );
}
