import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";

interface Message {
  id: string;
  type: "ai" | "user";
  text: string;
}

const MESSAGES: Message[] = [
  {
    id: "1",
    type: "ai",
    text: "Let's start with the causes. Before looking anything up — what do you think were the main reasons ordinary French people were angry in 1789?",
  },
  {
    id: "2",
    type: "user",
    text: "I think it was mostly about poverty and hunger",
  },
  {
    id: "3",
    type: "ai",
    text: "That's a good start. What do you think caused that poverty — was it sudden, or had it been building for years?",
  },
];

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Learning Session — KnowGap" },
      { name: "description", content: "Socratic learning session with KnowGap AI." },
    ],
  }),
  component: ChatScreen,
});

function ChatScreen() {
  const [topic, setTopic] = useState("French Revolution");
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const t = sessionStorage.getItem("knowgap:topic");
      if (t) setTopic(t);
    } catch {}
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 24;
    const maxHeight = lineHeight * 4;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), maxHeight)}px`;
  }, [inputValue]);

  const handleSend = () => {
    // no-op for now — no API calls
  };

  const handleFinish = () => {
    navigate({ to: "/summary" });
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-surface-border bg-background px-4">
        <Link
          to="/map"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={18} />
        </Link>

        <div className="flex flex-col items-center">
          <span className="max-w-[180px] truncate text-sm font-medium text-foreground">
            {topic}
          </span>
          <span className="text-xs text-muted-foreground">
            3 of 5 subtopics explored
          </span>
        </div>

        <button
          type="button"
          onClick={handleFinish}
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
        >
          Finish Session
        </button>
      </header>

      {/* Progress bar */}
      <div className="h-1 w-full bg-surface">
        <div className="h-full bg-[#7C6AF7]" style={{ width: "60%" }} />
      </div>

      {/* Scrollable message list */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-[680px] flex-col gap-5">
          {MESSAGES.map((msg, i) => {
            if (msg.type === "ai") {
              const isFirst = i === 0;
              return (
                <div key={msg.id} className="flex flex-col items-start">
                  {isFirst && (
                    <span className="mb-1 text-xs text-muted-foreground">
                      KnowGap
                    </span>
                  )}
                  <div
                    className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface px-5 py-3.5 text-[15px] leading-relaxed text-foreground"
                    style={{
                      borderLeft: "3px solid #7C6AF7",
                      fontWeight: 300,
                      fontStyle: "italic",
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-[#7C6AF7] px-5 py-3.5 text-[15px] leading-relaxed text-white">
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Sticky input area */}
      <div className="sticky bottom-0 border-t border-surface-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-[680px] items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your answer..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-[#7C6AF7]"
            style={{ minHeight: 44, maxHeight: 96 }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={inputValue.trim().length === 0}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7C6AF7] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
