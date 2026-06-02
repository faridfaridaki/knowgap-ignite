export interface QuizQuestion {
  id: number;
  type: "multiple_choice" | "short_answer";
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
}

export interface LessonConcept {
  concept: string;
  simple_explanation: string;
  real_life_example: string;
  key_takeaway: string;
}

export interface Flashcard {
  term: string;
  definition: string;
}

export interface LearningState {
  topic: string;
  startedAt: string;
  preTestQuestions: QuizQuestion[];
  preTestAnswers: string[];
  preTestScore: number;
  lesson: LessonConcept[];
  flashcards: Flashcard[];
  finalTestQuestions: QuizQuestion[];
  finalTestAnswers: string[];
  finalTestScore: number;
}

const KEY = "knowgap:state";

export function loadState(): LearningState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LearningState;
  } catch {
    return null;
  }
}

export function saveState(state: LearningState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export function patchState(patch: Partial<LearningState>): LearningState | null {
  const current = loadState();
  if (!current) return null;
  const next = { ...current, ...patch };
  saveState(next);
  return next;
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

export function initState(topic: string): LearningState {
  const state: LearningState = {
    topic,
    startedAt: new Date().toISOString(),
    preTestQuestions: [],
    preTestAnswers: [],
    preTestScore: 0,
    lesson: [],
    flashcards: [],
    finalTestQuestions: [],
    finalTestAnswers: [],
    finalTestScore: 0,
  };
  saveState(state);
  return state;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!?;:,"']/g, "");
}

export function isAnswerCorrect(q: QuizQuestion, given: string): boolean {
  if (!given) return false;
  const g = normalize(given);
  const c = normalize(q.correct_answer);
  if (q.type === "multiple_choice") return g === c;
  // short answer: accept substring match either way
  if (g === c) return true;
  if (g.length >= 3 && c.includes(g)) return true;
  if (c.length >= 3 && g.includes(c)) return true;
  return false;
}

export function scoreTest(qs: QuizQuestion[], answers: string[]): number {
  let s = 0;
  qs.forEach((q, i) => {
    if (isAnswerCorrect(q, answers[i] ?? "")) s += 1;
  });
  return s;
}
