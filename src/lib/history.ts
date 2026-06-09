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

export interface HistoryQuizQuestion {
  id: number;
  type: "multiple_choice" | "short_answer";
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
}

export interface HistoryLessonConcept {
  concept: string;
  simple_explanation: string;
  real_life_example: string;
  key_takeaway: string;
}

export interface HistoryFlashcard {
  term: string;
  definition: string;
  simple_definition?: string;
  expanded_explanation?: string;
  how_it_works?: string;
  example?: string;
}

export interface HistoryKnowledgeGap {
  question: string;
  correct_answer: string;
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
  preTest?: {
    questions: HistoryQuizQuestion[];
    answers: string[];
    score: number;
    total?: number;
  };
  finalTest?: {
    questions: HistoryQuizQuestion[];
    answers: string[];
    score: number;
    total?: number;
  };
  lesson?: HistoryLessonConcept[];
  flashcards?: HistoryFlashcard[];
  improvement?: number;
  knowledgeGaps?: HistoryKnowledgeGap[];
  suggestedTopics?: string[];
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
