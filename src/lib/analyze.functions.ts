import { createServerFn } from "@tanstack/react-start";
import { callGroqJson, callGroqText } from "./groq";

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
    const parsed: any = await callGroqJson({
      prompt: data.topic,
      system: SYSTEM_PROMPT,
      temperature: 0.7,
    });
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

export const suggestRelatedTopics = createServerFn({ method: "POST" })
  .inputValidator((input: { topic: string }) => {
    if (!input || typeof input.topic !== "string" || !input.topic.trim()) {
      throw new Error("Topic is required");
    }
    return { topic: input.topic.slice(0, 500) };
  })
  .handler(async ({ data }): Promise<{ topics: string[] }> => {
    const prompt = `Given that a student just studied '${data.topic}', suggest exactly 3 related topics they should explore next. Return ONLY a JSON array: ['topic 1', 'topic 2', 'topic 3']`;
    const cleaned = await callGroqText({ prompt, temperature: 0.7 });

    // Find first JSON array in the response
    const match = cleaned.match(/\[[\s\S]*\]/);
    const raw = match ? match[0].replace(/'/g, '"') : cleaned;

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("Failed to parse suggestions:", err, "raw:", cleaned);
      throw new Error("Failed to parse AI response");
    }
    if (!Array.isArray(parsed)) throw new Error("Invalid response shape");
    const topics = parsed
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .slice(0, 3);
    if (topics.length === 0) throw new Error("No topics returned");
    return { topics };
  });

export interface Takeaway {
  subtopic: string;
  explanation: string;
}

export const generateSummaryExtras = createServerFn({ method: "POST" })
  .inputValidator((input: { topic: string; subtopics: string[] }) => {
    if (!input || typeof input.topic !== "string" || !input.topic.trim()) {
      throw new Error("Topic is required");
    }
    return {
      topic: input.topic.slice(0, 500),
      subtopics: Array.isArray(input.subtopics)
        ? input.subtopics
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .slice(0, 10)
        : [],
    };
  })
  .handler(async ({ data }): Promise<{ topics: string[]; takeaways: Takeaway[] }> => {
    const list = data.subtopics.map((s) => `"${s}"`).join(", ") || "none";
    const prompt = `For a student who just studied '${data.topic}', return ONLY valid JSON with this exact shape: {"topics":["topic 1","topic 2","topic 3"],"takeaways":[{"subtopic":"name","explanation":"one sentence"}]}. Suggest exactly 3 related next topics. For these missing subtopics [${list}], include one concise correct explanation each. If there are no missing subtopics, return an empty takeaways array.`;
    const parsed: any = await callGroqJson({ prompt, temperature: 0.6 });
    const topics = Array.isArray(parsed?.topics)
      ? parsed.topics
          .filter((t: any): t is string => typeof t === "string" && t.trim().length > 0)
          .slice(0, 3)
      : [];
    const takeaways = Array.isArray(parsed?.takeaways)
      ? parsed.takeaways
          .filter((t: any) => t && typeof t.subtopic === "string" && typeof t.explanation === "string")
          .map((t: any) => ({ subtopic: t.subtopic, explanation: t.explanation }))
      : [];
    return { topics, takeaways };
  });

export const generateTakeaways = createServerFn({ method: "POST" })
  .inputValidator((input: { topic: string; subtopics: string[] }) => {
    if (!input || typeof input.topic !== "string" || !input.topic.trim()) {
      throw new Error("Topic is required");
    }
    if (!Array.isArray(input.subtopics)) {
      throw new Error("Subtopics must be an array");
    }
    return {
      topic: input.topic.slice(0, 500),
      subtopics: input.subtopics
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .slice(0, 10),
    };
  })
  .handler(async ({ data }): Promise<{ takeaways: Takeaway[] }> => {
    if (data.subtopics.length === 0) return { takeaways: [] };
    const list = data.subtopics.map((s) => `"${s}"`).join(", ");
    const prompt = `For the topic '${data.topic}', give a 1-sentence correct explanation for each of these subtopics: [${list}]. Return ONLY JSON: [{"subtopic": "name", "explanation": "one sentence"}]`;
    const cleaned = await callGroqText({ prompt, temperature: 0.5 });
    const match = cleaned.match(/\[[\s\S]*\]/);
    const raw = match ? match[0] : cleaned;

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("Failed to parse takeaways:", err, "raw:", cleaned);
      throw new Error("Failed to parse AI response");
    }
    if (!Array.isArray(parsed)) throw new Error("Invalid response shape");
    const takeaways: Takeaway[] = parsed
      .filter(
        (t: any) =>
          t && typeof t.subtopic === "string" && typeof t.explanation === "string",
      )
      .map((t: any) => ({ subtopic: t.subtopic, explanation: t.explanation }));
    return { takeaways };
  });
