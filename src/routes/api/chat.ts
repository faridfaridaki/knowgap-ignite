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
  return `You are a learning tutor helping a student understand a topic through guided conversation. Your goal is for the student to leave knowing the correct answers, not just feeling confused.

RULE — When the student gives a WRONG answer, you MUST do all four of these in order, in a single response:
1. Say clearly that the answer is wrong, starting with "Not quite." or "That's not correct."
2. Give the correct answer in 1-2 sentences.
3. Briefly explain why it's correct (1 sentence).
4. Then ask the next question to continue learning.

Example:
Student: "Photosynthesis is when animals digest food"
You: "Not quite. Photosynthesis is actually the process where plants use sunlight, water, and CO2 to produce glucose and oxygen. This happens in the chloroplasts — the green parts of plant cells — because they contain chlorophyll that captures light energy. Now, do you know what role sunlight plays in this process?"

RULE — When the student gives a RIGHT answer, briefly acknowledge it and ask a deeper follow-up question.

RULE — Never just move on with a new question without addressing a mistake. Never lecture for more than 3 sentences before asking the next question. Every response must end with exactly one question mark.

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
