import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  error?: boolean;
}

interface Subtopic {
  name: string;
  description: string;
  status: "Likely Clear" | "Partially Clear" | "Likely Missing";
}

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Learning Session — KnowGap" },
      { name: "description", content: "Socratic learning session with KnowGap AI." },
    ],
  }),
  component: ChatScreen,
});

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function ChatScreen() {
  const [topic, setTopic] = useState("your topic");
  const [gaps, setGaps] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const navigate = useNavigate();

  // Load topic + gaps + kick off first AI question
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let t = "your topic";
    let g: string[] = [];
    try {
      const storedTopic = sessionStorage.getItem("knowgap:topic");
      if (storedTopic) t = storedTopic;
      const storedSubs = sessionStorage.getItem("knowgap:subtopics");
      if (storedSubs) {
        const subs: Subtopic[] = JSON.parse(storedSubs);
        g = subs
          .filter(
            (s) => s.status === "Likely Missing" || s.status === "Partially Clear",
          )
          .map((s) => s.name);
      }
    } catch {}
    try {
      if (!sessionStorage.getItem("knowgap:startedAt")) {
        sessionStorage.setItem("knowgap:startedAt", String(Date.now()));
      }
    } catch {}
    setTopic(t);
    setGaps(g);

    // Kick off initial AI question
    void streamAssistant([], t, g);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 24;
    const maxHeight = lineHeight * 4;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), maxHeight)}px`;
  }, [inputValue]);

  const streamAssistant = useCallback(
    async (history: Message[], topicVal: string, gapsVal: string[]) => {
      setIsStreaming(true);
      const assistantId = uid();
      let started = false;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: topicVal,
            gaps: gapsVal,
            messages: history.map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";
        let done = false;

        while (!done) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          buffer += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line || line.startsWith(":")) continue;
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(json);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                acc += delta;
                if (!started) {
                  started = true;
                  setMessages((prev) => [
                    ...prev,
                    { id: assistantId, role: "assistant", content: acc },
                  ]);
                } else {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: acc } : m,
                    ),
                  );
                }
              }
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }

        if (!started) throw new Error("Empty stream");
      } catch (e) {
        console.error("chat stream failed:", e);
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: "Something went wrong. Try sending again.",
            error: true,
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [],
  );

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    const userMsg: Message = { id: uid(), role: "user", content: text };
    const next = [...messages.filter((m) => !m.error), userMsg];
    setMessages(next);
    setInputValue("");
    void streamAssistant(next, topic, gaps);
  };

  const handleFinish = () => {
    try {
      sessionStorage.setItem(
        "knowgap:messages",
        JSON.stringify(
          messages
            .filter((m) => !m.error)
            .map((m) => ({ role: m.role, content: m.content })),
        ),
      );
    } catch {}
    navigate({ to: "/summary" });
  };

  return (
    <div className="flex h-screen flex-col bg-background">
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
            {gaps.length > 0
              ? `${gaps.length} gap${gaps.length === 1 ? "" : "s"} to explore`
              : "Socratic session"}
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

      <div className="h-1 w-full bg-surface">
        <div
          className="h-full bg-[#7C6AF7] transition-[width] duration-500"
          style={{
            width: `${Math.min(100, messages.filter((m) => m.role === "user").length * 15)}%`,
          }}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-[680px] flex-col gap-5">
          {messages.map((msg, i) => {
            if (msg.role === "assistant") {
              const isFirst = i === 0;
              return (
                <div key={msg.id} className="flex flex-col items-start">
                  {isFirst && (
                    <span className="mb-1 text-xs text-muted-foreground">
                      KnowGap
                    </span>
                  )}
                  <div
                    className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface px-5 py-3.5 text-[15px] leading-relaxed text-foreground whitespace-pre-wrap"
                    style={{
                      borderLeft: `3px solid ${msg.error ? "#F87171" : "#7C6AF7"}`,
                      fontWeight: 300,
                      fontStyle: "italic",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            }
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-[#7C6AF7] px-5 py-3.5 text-[15px] leading-relaxed text-white whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            );
          })}

          {isStreaming &&
            !messages.some(
              (m, i) =>
                m.role === "assistant" && i === messages.length - 1 && m.content,
            ) && (
              <div className="flex flex-col items-start">
                <div
                  className="rounded-2xl rounded-bl-sm bg-surface px-5 py-4"
                  style={{ borderLeft: "3px solid #7C6AF7" }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-[pulse_1.2s_ease-in-out_infinite]" />
                    <span
                      className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-[pulse_1.2s_ease-in-out_infinite]"
                      style={{ animationDelay: "0.2s" }}
                    />
                    <span
                      className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-[pulse_1.2s_ease-in-out_infinite]"
                      style={{ animationDelay: "0.4s" }}
                    />
                  </div>
                </div>
              </div>
            )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-surface-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-[680px] items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your answer..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-[#7C6AF7] disabled:opacity-60"
            style={{ minHeight: 44, maxHeight: 96 }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={inputValue.trim().length === 0 || isStreaming}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7C6AF7] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
