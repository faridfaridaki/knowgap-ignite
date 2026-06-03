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

export interface CourseTerm {
  term: string;
  definition: string;
}
export interface CourseFormula {
  formula: string;
  variables?: { symbol: string; meaning: string }[];
  worked_example?: string;
  explanation: string;
}
export interface CoursePracticeProblem {
  problem: string;
  steps: string[];
  final_answer: string;
  // legacy fallback
  solution_steps?: string;
  answer?: string;
}
export interface CourseLesson {
  lesson_number: number;
  title: string;
  explanation: string;
  terms: CourseTerm[];
  formulas: CourseFormula[];
  real_life_examples: string[];
  practice_problems: CoursePracticeProblem[];
  has_problems: boolean;
}
export interface Course {
  course_title: string;
  lessons: CourseLesson[];
}

export interface LearningState {
  topic: string;
  startedAt: string;
  preTestQuestions: QuizQuestion[];
  preTestAnswers: string[];
  preTestHints: boolean[];
  preTestScore: number;
  lesson: LessonConcept[];
  flashcards: Flashcard[];
  finalTestQuestions: QuizQuestion[];
  finalTestAnswers: string[];
  finalTestHints: boolean[];
  finalTestScore: number;
  course: Course | null;
  completedLessons: number[];
  currentLesson: number;
}

const KEY = "knowgap:state";

export function loadState(): LearningState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LearningState;
    // backward-compat for older saved state without hints arrays
    if (!Array.isArray(parsed.preTestHints)) parsed.preTestHints = [];
    if (!Array.isArray(parsed.finalTestHints)) parsed.finalTestHints = [];
    return parsed;
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
    preTestHints: [],
    preTestScore: 0,
    lesson: [],
    flashcards: [],
    finalTestQuestions: [],
    finalTestAnswers: [],
    finalTestHints: [],
    finalTestScore: 0,
    course: null,
    completedLessons: [],
    currentLesson: 1,
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
  if (g === c) return true;
  if (g.length >= 3 && c.includes(g)) return true;
  if (c.length >= 3 && g.includes(c)) return true;
  return false;
}

/**
 * Score returns decimals: correct=1, correct after hint=0.5, wrong=0.
 */
export function scoreTest(
  qs: QuizQuestion[],
  answers: string[],
  hints?: boolean[],
): number {
  let s = 0;
  qs.forEach((q, i) => {
    if (isAnswerCorrect(q, answers[i] ?? "")) {
      s += hints?.[i] ? 0.5 : 1;
    }
  });
  return Math.round(s * 10) / 10;
}

export function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
