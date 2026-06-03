export const AI_BUSY_MESSAGE =
  "Our AI is a bit busy right now. Please wait a moment and try again.";

export function friendlyAiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (
    message.includes("429") ||
    message.toLowerCase().includes("rate") ||
    message.toLowerCase().includes("busy") ||
    message.toLowerCase().includes("groq") ||
    message.toLowerCase().includes("ai service")
  ) {
    return AI_BUSY_MESSAGE;
  }
  return AI_BUSY_MESSAGE;
}