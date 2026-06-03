import { AI_BUSY_MESSAGE } from "./ai-error";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const RETRY_DELAYS_MS = [1500, 3500];
const MAX_RETRY_AFTER_MS = 4000;
const FETCH_TIMEOUT_MS = 8000;

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqRequest = {
  messages: GroqMessage[];
  temperature?: number;
  response_format?: { type: "json_object" };
  stream?: boolean;
};

let groqQueue: Promise<unknown> = Promise.resolve();

function enqueueGroq<T>(task: () => Promise<T>): Promise<T> {
  const run = groqQueue.then(task, task);
  groqQueue = run.catch(() => undefined);
  return run;
}

function cleanContent(content: string): string {
  return content
    .replace(/^\s*```json\s*/i, "")
    .replace(/^\s*```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGroq(body: GroqRequest): Promise<Response> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          ...body,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(`Groq fetch failed (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}):`, err);
      if (attempt < RETRY_DELAYS_MS.length) {
        await wait(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new Error(AI_BUSY_MESSAGE);
    }
    clearTimeout(timeoutId);

    if (res.ok) return res;

    const errorText = await res.text().catch(() => "");
    console.error(`Groq error (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}):`, res.status, errorText);

    const isRetryable = res.status === 429 || res.status >= 500;
    if (isRetryable && attempt < RETRY_DELAYS_MS.length) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const headerMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS) : 0;
      const delay = Math.max(RETRY_DELAYS_MS[attempt], headerMs);
      await wait(delay);
      continue;
    }

    if (res.status === 429) throw new Error(AI_BUSY_MESSAGE);
    throw new Error(`AI request failed (${res.status})`);
  }

  throw new Error(AI_BUSY_MESSAGE);
}

export async function callGroqJson<T = any>({
  prompt,
  system,
  temperature = 0.7,
}: {
  prompt: string;
  system?: string;
  temperature?: number;
}): Promise<T> {
  const messages: GroqMessage[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  return enqueueGroq(async () => {
    const res = await fetchGroq({
      messages,
      response_format: { type: "json_object" },
      temperature,
    });
    const payload = await res.json();
    const content: string = payload?.choices?.[0]?.message?.content ?? "";
    return JSON.parse(cleanContent(content)) as T;
  });
}

export async function callGroqText({
  prompt,
  system,
  temperature = 0.7,
}: {
  prompt: string;
  system?: string;
  temperature?: number;
}): Promise<string> {
  const messages: GroqMessage[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  return enqueueGroq(async () => {
    const res = await fetchGroq({ messages, temperature });
    const payload = await res.json();
    return cleanContent(payload?.choices?.[0]?.message?.content ?? "");
  });
}

export async function callGroqStreamText({
  messages,
  temperature = 0.8,
}: {
  messages: GroqMessage[];
  temperature?: number;
}): Promise<string> {
  return enqueueGroq(async () => {
    const res = await fetchGroq({ messages, temperature, stream: true });
    return res.text();
  });
}