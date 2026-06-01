import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Search, MessageCircle, Brain, History as HistoryIcon } from "lucide-react";
import { loadHistory } from "@/lib/history";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KnowGap — Learn anything. Really understand it." },
      {
        name: "description",
        content:
          "Paste your notes or enter a topic. KnowGap finds what you're missing and teaches you through questions — not lectures.",
      },
      { property: "og:title", content: "KnowGap — Learn anything. Really understand it." },
      {
        property: "og:description",
        content:
          "AI-powered learning that finds your blind spots and teaches through dialogue.",
      },
    ],
  }),
  component: Index,
});

const MAX_CHARS = 5000;

function Index() {
  const [value, setValue] = useState("");
  const [hasHistory, setHasHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setHasHistory(loadHistory().length > 0);
  }, []);

  useEffect(() => {
    try {
      const pending = sessionStorage.getItem("knowgap:pendingTopic");
      if (pending) {
        setValue(pending);
        sessionStorage.removeItem("knowgap:pendingTopic");
      }
    } catch {}
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(120, el.scrollHeight)}px`;
  }, [value]);

  const disabled = value.trim().length === 0;

  const handleAnalyze = () => {
    if (disabled) return;
    const fresh = value.trim();
    try {
      // Wipe ALL prior session state so a new topic never inherits old data
      sessionStorage.removeItem("knowgap:subtopics");
      sessionStorage.removeItem("knowgap:messages");
      sessionStorage.removeItem("knowgap:startedAt");
      sessionStorage.removeItem("knowgap:pendingTopic");
      sessionStorage.setItem("knowgap:topic", fresh);
    } catch {}
    navigate({ to: "/map" });
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center px-6 py-16 bg-background">
      <div className="w-full max-w-[720px] flex flex-col items-center text-center">
        <span className="inline-flex items-center rounded-full border border-[#7C6AF7]/50 px-3 py-1 text-xs font-medium text-[#7C6AF7] tracking-wide">
          AI-Powered Learning
        </span>

        <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.05]">
          Learn anything.
          <br />
          Really understand it.
        </h1>

        <p className="mt-5 max-w-[560px] text-base sm:text-lg text-muted-foreground leading-relaxed">
          Paste your notes or enter a topic. KnowGap finds what you're missing
          and teaches you through questions — not lectures.
        </p>

        <div className="mt-10 w-full max-w-[680px]">
          <div className="group relative rounded-xl bg-surface border border-surface-border transition-shadow focus-within:border-[#7C6AF7] focus-within:shadow-[0_0_0_4px_rgba(124,106,247,0.18)]">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, MAX_CHARS))}
              placeholder="e.g. 'The French Revolution' or paste your study notes here..."
              className="w-full resize-none bg-transparent px-5 py-4 pb-9 text-foreground placeholder:text-muted-foreground/70 outline-none text-base leading-relaxed"
              style={{ minHeight: 120 }}
            />
            <div className="pointer-events-none absolute bottom-2.5 right-4 text-xs text-muted-foreground tabular-nums">
              {value.length}/{MAX_CHARS}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={disabled}
            className="mt-4 w-full rounded-xl px-6 py-3.5 text-base font-semibold text-white transition-transform duration-150 disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.02] enabled:active:scale-[0.99] shadow-[0_8px_24px_-8px_rgba(124,106,247,0.6)]"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #7C6AF7 0%, #5B4FD4 100%)",
            }}
          >
            Analyze My Understanding →
          </button>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
          <div className="inline-flex items-center gap-2">
            <Search size={16} className="text-[#7C6AF7]" />
            <span>Finds your blind spots</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <MessageCircle size={16} className="text-[#4FC4CF]" />
            <span>Teaches through dialogue</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <Brain size={16} className="text-[#7C6AF7]" />
            <span>Adapts to your understanding</span>
          </div>
        </div>
      </div>
    </main>
  );
}

// keep Link import used (re-export prevents tree-shake warnings)
export { Link };
