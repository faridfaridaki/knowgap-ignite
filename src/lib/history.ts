export type Status = "Likely Clear" | "Partially Clear" | "Likely Missing";

export interface HistorySubtopic {
  name: string;
  description: string;
  status: Status;
}

export interface HistoryMessage {
  role: "assistant" | "user";
  content: string;
}

export interface HistorySession {
  id: string;
  topic: string;
  date: string; // ISO
  subtopics: HistorySubtopic[];
  messages: HistoryMessage[];
  stats: {
    questionsAnswered: number;
    durationMinutes: number;
  };
}

const KEY = "knowgap_history";
const MAX = 20;

export function loadHistory(): HistorySession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistorySession[];
  } catch {
    return [];
  }
}

export function saveSession(session: HistorySession): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadHistory();
    const next = [session, ...existing].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function getSession(id: string): HistorySession | undefined {
  return loadHistory().find((s) => s.id === id);
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export const STATUS_COLOR: Record<Status, string> = {
  "Likely Clear": "#4ADE80",
  "Partially Clear": "#FBBF24",
  "Likely Missing": "#F87171",
};
