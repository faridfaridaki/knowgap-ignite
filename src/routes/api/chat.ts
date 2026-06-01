import { createFileRoute } from "@tanstack/react-router";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatBody {
  topic?: string;
  gaps?: string[];
  messages?: ChatMessage[];
}

function buildSystemPrompt(topic: string, gaps: string[]): string {
  const gapList = gaps.length > 0 ? gaps.join(", ") : "(none identified)";
  return `You are a Socratic tutor. You must NEVER correct the user directly, NEVER explain, NEVER state facts, and NEVER lecture. Your ONLY tool is questions. If the user is wrong, ask a simpler question that leads them toward the truth. If the user is right, briefly acknowledge and ask a deeper question. Every single response must end with exactly one question mark. No exceptions.

Topic: ${topic}
Student's knowledge gaps to prioritize: ${gapList}`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: ChatBody;
        try {
          body = (await request.json()) as ChatBody;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const topic = (body.topic ?? "").toString().slice(0, 500) || "the chosen topic";
        const gaps = Array.isArray(body.gaps)
          ? body.gaps.filter((g): g is string => typeof g === "string").slice(0, 20)
          : [];
        const messages = Array.isArray(body.messages) ? body.messages : [];

        const cleanMessages = messages
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string",
          )
          .slice(-30)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "GROQ_API_KEY is not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const upstream = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [
                { role: "system", content: buildSystemPrompt(topic, gaps) },
                ...cleanMessages,
              ],
              temperature: 0.8,
              stream: true,
            }),
          },
        );

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          console.error("Groq chat error:", upstream.status, text);
          return new Response(
            JSON.stringify({ error: `Groq error ${upstream.status}` }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
