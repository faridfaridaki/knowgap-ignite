import { createFileRoute } from "@tanstack/react-router";
import { AI_BUSY_MESSAGE } from "@/lib/ai-error";
import { callGroqStreamText } from "@/lib/groq";

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

LANGUAGE RULE — Always respond in the SAME language the student is writing in. If they switch languages, switch with them.

RULE — EVERY response (except the very first question of the session) MUST begin by judging the student's previous answer. Start the very first sentence with an explicit verdict:
- If correct: start with "Correct." (or the equivalent in the student's language, e.g. "Correcto.", "Exact.", "Richtig.")
- If wrong: start with "Not quite." or "That's not correct." (or the equivalent in the student's language)
- If partially correct: start with "Partially correct." (or equivalent)
- If the student says they don't know, are unsure, guessing, or gives a vague non-answer (e.g. "idk", "not sure", "maybe?", "no idea", "не знаю", "не уверен"): open with a warm, encouraging phrase in the student's language that means something like "let's figure this out together" — but VARY the wording every time and adapt it naturally to the language and tone (e.g. "No worries, let's work through it.", "Давай разберёмся вместе.", "Ничего страшного, подумаем вместе.", "Vamos a descubrirlo juntos."). Never repeat the exact same opener twice in a row. Do NOT treat this as wrong — then give the correct answer and explanation as usual.

Then, in the SAME response, follow this exact order:
1. The verdict sentence (above).
2. State the correct answer clearly in 1-2 sentences.
3. Briefly explain WHY it's correct (1 sentence).
4. Ask the next question to continue learning.

This applies to BOTH wrong AND right answers — always show the explanation of the correct answer before moving on.

Example (wrong):
Student: "Photosynthesis is when animals digest food"
You: "Not quite. Photosynthesis is actually the process where plants use sunlight, water, and CO2 to produce glucose and oxygen. This happens in the chloroplasts because they contain chlorophyll that captures light energy. Now, do you know what role sunlight plays in this process?"

Example (right):
Student: "Plants use sunlight to make glucose from CO2 and water."
You: "Correct. Photosynthesis converts light energy into chemical energy stored in glucose, releasing oxygen as a byproduct. This works because chlorophyll in the chloroplasts absorbs light to drive the reaction. What do you think happens to the glucose the plant produces?"

RULE — Never move on without first stating the verdict and the correct explanation. Never lecture for more than 3 sentences before asking the next question. Every response must end with exactly one question mark.

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

        try {
          const streamText = await callGroqStreamText({
            messages: [
              { role: "system", content: buildSystemPrompt(topic, gaps) },
              ...cleanMessages,
            ],
            temperature: 0.8,
          });

          return new Response(streamText, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        } catch (error) {
          console.error("Groq chat error:", error);
          return new Response(JSON.stringify({ error: AI_BUSY_MESSAGE }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
