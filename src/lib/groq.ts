import { AI_BUSY_MESSAGE } from "./ai-error";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const LOVABLE_MODEL = "google/gemini-3-flash-preview";
const RETRY_DELAYS_MS = [1500, 3500];
const MAX_RETRY_AFTER_MS = 4000;
const FETCH_TIMEOUT_MS = 12000;

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqRequest = {
  messages: GroqMessage[];
  temperature?: number;
  response_format?: { type: "json_object" };
  stream?: boolean;
  max_tokens?: number;
  lovableModelOverride?: string;
};

type AiProvider = {
  name: "Groq" | "Lovable AI";
  url: string;
  model: string;
  apiKey?: string;
};

let groqQueue: Promise<unknown> = Promise.resolve();
let groqCooldownUntil = 0;

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

function getProviders(): AiProvider[] {
  const canUseLovableAi = Boolean(process.env.LOVABLE_API_KEY);
  const groqIsCoolingDown = canUseLovableAi && Date.now() < groqCooldownUntil;
  const providers: AiProvider[] = [
    {
      name: "Lovable AI",
      url: LOVABLE_AI_URL,
      model: LOVABLE_MODEL,
      apiKey: process.env.LOVABLE_API_KEY,
    },
    {
      name: "Groq",
      url: GROQ_URL,
      model: MODEL,
      apiKey: groqIsCoolingDown ? undefined : process.env.GROQ_API_KEY,
    },
  ];
  return providers.filter((provider) => Boolean(provider.apiKey));
}

function isDailyTokenLimit(errorText: string): boolean {
  const lower = errorText.toLowerCase();
  return lower.includes("tokens per day") || lower.includes("tpd") || lower.includes("try again in");
}

async function fetchProvider(provider: AiProvider, body: GroqRequest): Promise<Response> {
  if (!provider.apiKey) throw new Error(`${provider.name} API key is not configured`);
  const { lovableModelOverride, ...rest } = body;
  const model =
    provider.name === "Lovable AI" && lovableModelOverride ? lovableModelOverride : provider.model;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model,
          ...rest,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(`${provider.name} fetch failed (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}):`, err);
      if (attempt < RETRY_DELAYS_MS.length) {
        await wait(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new Error(AI_BUSY_MESSAGE);
    }
    clearTimeout(timeoutId);

    if (res.ok) return res;

    const errorText = await res.text().catch(() => "");
    console.error(`${provider.name} error (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}):`, res.status, errorText);

    const isRetryable = res.status === 429 || res.status >= 500;
    if (provider.name === "Groq" && res.status === 429) {
      // Stop retrying Groq immediately so we fall back to Lovable AI fast.
      throw new Error(AI_BUSY_MESSAGE);
    }
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

async function fetchGroq(body: GroqRequest): Promise<Response> {
  const providers = getProviders();
  if (providers.length === 0) throw new Error("No AI provider is configured");

  let lastError: unknown;
  for (let i = 0; i < providers.length; i += 1) {
    const provider = providers[i];
    const isLast = i === providers.length - 1;
    try {
      return await fetchProvider(provider, body);
    } catch (error) {
      lastError = error;
      if (provider.name === "Groq") {
        groqCooldownUntil = Date.now() + 10 * 60 * 1000;
      }
      if (!isLast) {
        console.warn(`${provider.name} failed; falling back to next provider.`);
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(AI_BUSY_MESSAGE);
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