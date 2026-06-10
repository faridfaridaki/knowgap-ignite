import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Sparkles, Brain } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KnowGap — Learn anything. Really understand it." },
      {
        name: "description",
        content:
          "Paste your notes or enter a topic. KnowGap finds what you're missing and teaches you through a personalized course.",
      },
      { property: "og:title", content: "KnowGap — Learn anything. Really understand it." },
      {
        property: "og:description",
        content:
          "AI-powered learning that finds your blind spots and teaches you through a personalized 10-lesson course.",
      },
    ],
  }),
  component: Index,
});

const MAX_CHARS = 5000;

function Index() {
  const { t } = useT();
  const { user, loading: authLoading } = useAuth();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  const startAnalyzeTopic = useCallback(
    (fresh: string) => {
      try {
        sessionStorage.removeItem("knowgap:subtopics");
        sessionStorage.removeItem("knowgap:messages");
        sessionStorage.removeItem("knowgap:startedAt");
        sessionStorage.removeItem("knowgap:pendingTopic");
        sessionStorage.removeItem("knowgap:state");
        sessionStorage.setItem("knowgap:topic", fresh);
      } catch {}
      navigate({ to: "/pretest" });
    },
    [navigate],
  );

  useEffect(() => {
    if (authLoading) return;
    let pending = "";
    try {
      pending = sessionStorage.getItem("knowgap:pendingTopic")?.trim() ?? "";
    } catch {}
    if (!pending) return;
    if (user) {
      startAnalyzeTopic(pending);
      return;
    }
    setValue(pending);
    try {
      sessionStorage.removeItem("knowgap:pendingTopic");
    } catch {}
  }, [authLoading, user, startAnalyzeTopic]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(120, el.scrollHeight)}px`;
  }, [value]);

  const topicMissing = value.trim().length === 0;
  const disabled = topicMissing || authLoading;

  const handleAnalyze = () => {
    if (topicMissing || authLoading) return;
    const fresh = value.trim();
    if (!user) {
      try {
        sessionStorage.setItem("knowgap:pendingTopic", fresh);
      } catch {}
      navigate({ to: "/auth" });
      return;
    }
    startAnalyzeTopic(fresh);
  };

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center bg-background px-4 pb-10 pt-28 animate-fade-in sm:px-6 sm:py-16">
      <AppHeader />
      <div className="w-full max-w-[720px] flex flex-col items-center text-center">
        <span className="inline-flex items-center rounded-full border border-[#7C6AF7]/50 px-3 py-1 text-xs font-medium text-[#7C6AF7] tracking-wide">
          {t("badge")}
        </span>

        <h1 className="mt-5 text-3xl font-bold leading-[1.08] tracking-tight text-foreground sm:mt-6 sm:text-5xl md:text-6xl">
          {t("landingTitle1")}
          <br />
          {t("landingTitle2")}
        </h1>

        <p className="mt-4 max-w-[560px] text-sm leading-relaxed text-muted-foreground sm:mt-5 sm:text-lg">
          {t("landingSubtitle")}
        </p>

        <div className="mt-7 w-full max-w-[680px] sm:mt-10">
          <div className="group relative rounded-xl bg-surface border border-surface-border transition-shadow focus-within:border-[#7C6AF7] focus-within:shadow-[0_0_0_4px_rgba(124,106,247,0.18)]">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, MAX_CHARS))}
              placeholder={t("landingPlaceholder")}
              className="w-full resize-none bg-transparent px-4 py-4 pb-9 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 sm:px-5"
              style={{ minHeight: 132 }}
            />
            <div className="pointer-events-none absolute bottom-2.5 right-4 text-xs text-muted-foreground tabular-nums">
              {value.length}/{MAX_CHARS}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={disabled}
            className="mt-4 w-full rounded-xl px-6 py-4 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,106,247,0.6)] transition-transform duration-150 disabled:cursor-not-allowed disabled:opacity-40 enabled:active:scale-[0.99] sm:py-3.5 sm:enabled:hover:scale-[1.02]"
            style={{
              backgroundImage: "linear-gradient(135deg, #7C6AF7 0%, #5B4FD4 100%)",
            }}
          >
            {authLoading ? t("pleaseWait") : user ? t("analyzeBtn") : t("signInToAnalyze")}
          </button>
        </div>

        <div className="mt-8 grid w-full grid-cols-1 gap-3 text-sm text-muted-foreground sm:mt-10 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-8 sm:gap-y-3">
          <div className="inline-flex items-center gap-2">
            <Search size={16} className="text-[#7C6AF7]" />
            <span>{t("chip1")}</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <Sparkles size={16} className="text-[#4FC4CF]" />
            <span>{t("chip2")}</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <Brain size={16} className="text-[#7C6AF7]" />
            <span>{t("chip3")}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
