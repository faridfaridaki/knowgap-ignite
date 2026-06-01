import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

export type Status = "Likely Clear" | "Partially Clear" | "Likely Missing";

export interface Subtopic {
  name: string;
  description: string;
  status: Status;
}

const SYSTEM_PROMPT = `You are a learning analysis AI. Given a topic or study notes, identify 4-6 key subtopics a student should understand. For each subtopic, predict whether a typical student without deep study would likely have it clear, partially clear, or missing. Return ONLY valid JSON, no markdown, no extra text:

{
  "subtopics": [
    {
      "name": "string",
      "description": "string (one sentence)",
      "status": "Likely Clear" | "Partially Clear" | "Likely Missing"
    }
  ]
}`;

const ALLOWED: Status[] = ["Likely Clear", "Partially Clear", "Likely Missing"];

export const analyzeTopic = createServerFn({ method: "POST" })
  .inputValidator((input: { topic: string }) => {
    if (!input || typeof input.topic !== "string" || !input.topic.trim()) {
      throw new Error("Topic is required");
    }
    return { topic: input.topic.slice(0, 5000) };
  })
  .handler(async ({ data }): Promise<{ subtopics: Subtopic[] }> => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama3-70b-8192",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: data.topic },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Groq API error:", res.status, body);
      throw new Error(`Groq API error: ${res.status}`);
    }

    const payload = await res.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Empty response");

    const cleaned = content
      .replace(/^\s*```json\s*/i, "")
      .replace(/^\s*```\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("Failed to parse AI response:", err, "raw:", content);
      setResponseStatus(500);
      return { error: "Failed to parse AI response" } as any;
    }
    const subtopics = parsed?.subtopics;
    if (!Array.isArray(subtopics) || subtopics.length === 0) {
      throw new Error("Invalid response shape");
    }

    const clean: Subtopic[] = subtopics.map((s: any) => {
      if (
        typeof s?.name !== "string" ||
        typeof s?.description !== "string" ||
        !ALLOWED.includes(s?.status)
      ) {
        throw new Error("Invalid subtopic shape");
      }
      return {
        name: s.name,
        description: s.description,
        status: s.status as Status,
      };
    });

    return { subtopics: clean };
  });
