import { createServerFn } from "@tanstack/react-start";
import { callGroqJson } from "./groq";
import { AI_BUSY_MESSAGE } from "./ai-error";

type Lang = "en" | "ru";

function langInstruction(lang: Lang): string {
  const name = lang === "ru" ? "Russian" : "English";
  return `Respond entirely in ${name}. ALL questions, options, explanations, lesson text, examples, terms, problems, and answers must be in ${name}.`;
}

function normLang(input: unknown): Lang {
  return input === "ru" ? "ru" : "en";
}

interface QuizQuestion {
  id: number;
  type: "multiple_choice" | "short_answer";
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
}

interface LessonConcept {
  concept: string;
  simple_explanation: string;
  real_life_example: string;
  key_takeaway: string;
}

interface Flashcard {
  term: string;
  definition: string;
}

function sanitizeQuestions(raw: any): QuizQuestion[] {
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.questions) ? raw.questions : [];
  const out: QuizQuestion[] = [];
  arr.slice(0, 5).forEach((q: any, i: number) => {
    if (!q || typeof q.question !== "string" || typeof q.correct_answer !== "string") return;
    const options = Array.isArray(q.options)
      ? q.options.filter((o: any) => typeof o === "string").slice(0, 4)
      : null;
    if (!options || options.length !== 4) return;
    // Ensure correct_answer is one of the options
    if (!options.includes(q.correct_answer)) return;
    out.push({
      id: i + 1,
      type: "multiple_choice",
      question: q.question,
      options,
      correct_answer: q.correct_answer,
      explanation: typeof q.explanation === "string" ? q.explanation : "",
    });
  });
  return out;
}

const QUIZ_SYSTEM_BASE = `You generate multiple-choice quiz questions for students. Return ONLY valid JSON. Schema:
{"questions":[{"id":1,"type":"multiple_choice","question":"...","options":["A","B","C","D"],"correct_answer":"...","explanation":"..."}]}
Rules:
- Exactly 5 questions, ALL multiple_choice. Never use short_answer.
- Each question MUST have exactly 4 options.
- correct_answer MUST exactly match one of the four options (string equality).
- The 3 wrong options must be PLAUSIBLE distractors based on common misconceptions — never silly or obviously wrong.
- explanation is one clear sentence explaining why the correct answer is right.`;

export const generatePreTest = createServerFn({ method: "POST" })
  .inputValidator((input: { topic: string; language?: string }) => {
    if (!input?.topic?.trim()) throw new Error("Topic required");
    return { topic: input.topic.slice(0, 2000), language: normLang(input.language) };
  })
  .handler(async ({ data }): Promise<{ questions: QuizQuestion[]; error?: string }> => {
    const sys = `${QUIZ_SYSTEM_BASE}\n${langInstruction(data.language)}`;
    try {
      const parsed = await callGroqJson({
        prompt: `Create a 5-question multiple-choice pre-test to gauge a student's current understanding of: "${data.topic}". Cover core sub-concepts. ${langInstruction(data.language)}`,
        system: sys,
        temperature: 0.6,
      });
      const questions = sanitizeQuestions(parsed);
      if (questions.length < 3) throw new Error("Invalid quiz response");
      return { questions };
    } catch (error) {
      console.error("generatePreTest failed:", error);
      return { questions: [], error: AI_BUSY_MESSAGE };
    }
  });

export const generateFinalTest = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { topic: string; previousQuestions: string[]; language?: string }) => {
      if (!input?.topic?.trim()) throw new Error("Topic required");
      return {
        topic: input.topic.slice(0, 2000),
        previousQuestions: (input.previousQuestions || []).slice(0, 10),
        language: normLang(input.language),
      };
    },
  )
  .handler(async ({ data }): Promise<{ questions: QuizQuestion[]; error?: string }> => {
    const avoid = data.previousQuestions.map((q) => `- ${q}`).join("\n");
    const sys = `${QUIZ_SYSTEM_BASE}\n${langInstruction(data.language)}`;
    try {
      const parsed = await callGroqJson({
        prompt: `Create a 5-question multiple-choice FINAL test on: "${data.topic}". These questions must be DIFFERENT from the pre-test questions below but cover the same core concepts:\n${avoid}\n${langInstruction(data.language)}`,
        system: sys,
        temperature: 0.8,
      });
      const questions = sanitizeQuestions(parsed);
      if (questions.length < 3) throw new Error("Invalid quiz response");
      return { questions };
    } catch (error) {
      console.error("generateFinalTest failed:", error);
      return { questions: [], error: AI_BUSY_MESSAGE };
    }
  });

export const generateLesson = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { topic: string; missedConcepts: string[]; language?: string }) => {
      if (!input?.topic?.trim()) throw new Error("Topic required");
      return {
        topic: input.topic.slice(0, 2000),
        missedConcepts: (input.missedConcepts || []).slice(0, 10),
        language: normLang(input.language),
      };
    },
  )
  .handler(async ({ data }): Promise<{ lesson: LessonConcept[]; error?: string }> => {
    const list = data.missedConcepts.length
      ? data.missedConcepts.map((c) => `- ${c}`).join("\n")
      : `- Core concepts of ${data.topic}`;
    const prompt = `The student is learning about "${data.topic}". They got these questions/concepts WRONG and need a refresher:\n${list}\n\nCreate a lesson with one section per missed concept. Use VERY simple language. Include a real-life example or analogy. Return JSON: {"lesson":[{"concept":"...","simple_explanation":"2-3 sentences","real_life_example":"a short concrete story or analogy","key_takeaway":"one sentence"}]}\n${langInstruction(data.language)}`;
    try {
      const parsed = await callGroqJson({ prompt, temperature: 0.7 });
      const arr = Array.isArray(parsed?.lesson) ? parsed.lesson : [];
      const lesson: LessonConcept[] = arr
        .filter(
          (c: any) =>
            c &&
            typeof c.concept === "string" &&
            typeof c.simple_explanation === "string" &&
            typeof c.real_life_example === "string" &&
            typeof c.key_takeaway === "string",
        )
        .slice(0, 8);
      if (lesson.length === 0) throw new Error("Invalid lesson response");
      return { lesson };
    } catch (error) {
      console.error("generateLesson failed:", error);
      return { lesson: [], error: AI_BUSY_MESSAGE };
    }
  });

export const generateFlashcards = createServerFn({ method: "POST" })
  .inputValidator((input: { topic: string; lessonTitles?: string[]; language?: string }) => {
    if (!input?.topic?.trim()) throw new Error("Topic required");
    return {
      topic: input.topic.slice(0, 2000),
      lessonTitles: Array.isArray(input.lessonTitles)
        ? input.lessonTitles.filter((t) => typeof t === "string").slice(0, 12)
        : [],
      language: normLang(input.language),
    };
  })
  .handler(async ({ data }): Promise<{ flashcards: Flashcard[]; error?: string }> => {
    const lessonsBlock = data.lessonTitles.length
      ? data.lessonTitles.map((t) => `- ${t}`).join("\n")
      : "(use core concepts of the topic)";
    const prompt = `Generate 8-10 flashcards for the topic "${data.topic}". Use the key terms and concepts from these lessons:\n${lessonsBlock}\n\nReturn ONLY JSON: {"flashcards":[{"term":"...","definition":"..."}]} where definition is 1-2 clear sentences.\n${langInstruction(data.language)}`;
    try {
      const parsed = await callGroqJson({ prompt, temperature: 0.6 });
      const arr = Array.isArray(parsed?.flashcards) ? parsed.flashcards : [];
      const flashcards: Flashcard[] = arr
        .filter(
          (c: any) => c && typeof c.term === "string" && typeof c.definition === "string",
        )
        .slice(0, 10);
      if (flashcards.length === 0) throw new Error("Invalid flashcards response");
      return { flashcards };
    } catch (error) {
      console.error("generateFlashcards failed:", error);
      return { flashcards: [], error: AI_BUSY_MESSAGE };
    }
  });

interface CourseFormula {
  formula: string;
  variables?: { symbol: string; meaning: string }[];
  worked_example?: string;
  explanation: string;
}
interface CoursePracticeProblem {
  problem: string;
  steps: string[];
  final_answer: string;
}
interface CourseLesson {
  lesson_number: number;
  title: string;
  explanation: string;
  terms: { term: string; definition: string }[];
  formulas: CourseFormula[];
  real_life_examples: string[];
  practice_problems: CoursePracticeProblem[];
  has_problems: boolean;
}
interface Course {
  course_title: string;
  lessons: CourseLesson[];
}

function sanitizeCourse(raw: any): Course | null {
  if (!raw || typeof raw !== "object") return null;
  const title = typeof raw.course_title === "string" ? raw.course_title : "";
  const lessonsRaw = Array.isArray(raw.lessons) ? raw.lessons : [];
  const lessons: CourseLesson[] = lessonsRaw
    .map((l: any, i: number): CourseLesson | null => {
      if (!l || typeof l.title !== "string" || typeof l.explanation !== "string") return null;
      const terms = Array.isArray(l.terms)
        ? l.terms
            .filter((t: any) => t && typeof t.term === "string" && typeof t.definition === "string")
            .map((t: any) => ({ term: t.term, definition: t.definition }))
        : [];
      const formulas: CourseFormula[] = Array.isArray(l.formulas)
        ? l.formulas
            .filter(
              (f: any) => f && typeof f.formula === "string" && typeof f.explanation === "string",
            )
            .map((f: any) => ({
              formula: f.formula,
              explanation: f.explanation,
              variables: Array.isArray(f.variables)
                ? f.variables
                    .filter(
                      (v: any) =>
                        v && typeof v.symbol === "string" && typeof v.meaning === "string",
                    )
                    .map((v: any) => ({ symbol: v.symbol, meaning: v.meaning }))
                : [],
              worked_example:
                typeof f.worked_example === "string" ? f.worked_example : undefined,
            }))
        : [];
      const examples = Array.isArray(l.real_life_examples)
        ? l.real_life_examples.filter((e: any) => typeof e === "string")
        : [];
      const problems: CoursePracticeProblem[] = Array.isArray(l.practice_problems)
        ? l.practice_problems
            .filter((p: any) => p && typeof p.problem === "string")
            .map((p: any) => {
              // accept either {steps:[], final_answer} or legacy {solution_steps, answer}
              let steps: string[] = [];
              if (Array.isArray(p.steps)) {
                steps = p.steps.filter((s: any) => typeof s === "string");
              } else if (typeof p.solution_steps === "string") {
                steps = p.solution_steps
                  .split(/\n+/)
                  .map((s: string) => s.replace(/^\s*\d+[.)]\s*/, "").trim())
                  .filter(Boolean);
              }
              const final_answer =
                typeof p.final_answer === "string"
                  ? p.final_answer
                  : typeof p.answer === "string"
                    ? p.answer
                    : "";
              return { problem: p.problem, steps, final_answer };
            })
        : [];
      return {
        lesson_number: typeof l.lesson_number === "number" ? l.lesson_number : i + 1,
        title: l.title,
        explanation: l.explanation,
        terms,
        formulas,
        real_life_examples: examples,
        practice_problems: problems,
        has_problems: typeof l.has_problems === "boolean" ? l.has_problems : problems.length > 0,
      };
    })
    .filter(Boolean) as CourseLesson[];
  if (lessons.length === 0) return null;
  return { course_title: title || "Your Course", lessons: lessons.slice(0, 10) };
}

function emptyLesson(n: number, title: string): CourseLesson {
  return {
    lesson_number: n,
    title,
    explanation: "",
    terms: [],
    formulas: [],
    real_life_examples: [],
    practice_problems: [],
    has_problems: false,
  };
}

export const generateCourse = createServerFn({ method: "POST" })
  .inputValidator((input: { topic: string; wrongQuestions: string[]; language?: string }) => {
    if (!input?.topic?.trim()) throw new Error("Topic required");
    return {
      topic: input.topic.slice(0, 2000),
      wrongQuestions: (input.wrongQuestions || []).slice(0, 10),
      language: normLang(input.language),
    };
  })
  .handler(async ({ data }): Promise<{ course: Course | null; error?: string }> => {
    const wrong = data.wrongQuestions.length
      ? data.wrongQuestions.map((q) => `- ${q}`).join("\n")
      : "(none — student got everything right, still teach the topic from scratch)";
    const prompt = `Design a 10-lesson course outline on the topic: "${data.topic}". The student got these pre-test questions wrong and needs special focus on them:
${wrong}

Return ONLY valid JSON with this exact schema:
{
  "course_title": "...",
  "lessons": [
    { "lesson_number": 1, "title": "..." },
    { "lesson_number": 2, "title": "..." }
  ]
}

Rules:
- Return EXACTLY 10 lessons, numbered 1-10, progressing from basics to advanced.
- Each title is short (under 80 chars), specific, and descriptive.
- Do NOT include explanations, terms, formulas, or problems — TITLES ONLY.
- ${langInstruction(data.language)}`;
    try {
      const raw: any = await callGroqJson({
        prompt,
        temperature: 0.7,
        maxTokens: 1200,
        timeoutMs: 20000,
        retryCount: 1,
        queued: false,
      });
      const title =
        typeof raw?.course_title === "string" && raw.course_title.trim()
          ? raw.course_title
          : `Course on ${data.topic}`;
      const lessonsRaw = Array.isArray(raw?.lessons) ? raw.lessons : [];
      const lessons: CourseLesson[] = [];
      for (let i = 1; i <= 10; i += 1) {
        const found = lessonsRaw.find((l: any) => Number(l?.lesson_number) === i);
        const lessonTitle =
          (found && typeof found.title === "string" && found.title.trim()) ||
          `Lesson ${i}`;
        lessons.push(emptyLesson(i, lessonTitle));
      }
      return { course: { course_title: title, lessons } };
    } catch (error) {
      console.error("generateCourse (outline) failed:", error);
      return { course: null, error: AI_BUSY_MESSAGE };
    }
  });

export const generateCourseLesson = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      topic: string;
      lessonNumber: number;
      lessonTitle: string;
      allTitles: string[];
      wrongQuestions: string[];
      language?: string;
    }) => {
      if (!input?.topic?.trim()) throw new Error("Topic required");
      const n = Number(input.lessonNumber);
      if (!Number.isFinite(n) || n < 1 || n > 10) throw new Error("Invalid lesson number");
      return {
        topic: input.topic.slice(0, 2000),
        lessonNumber: Math.floor(n),
        lessonTitle: String(input.lessonTitle || "").slice(0, 200),
        allTitles: (input.allTitles || []).slice(0, 10).map((t) => String(t).slice(0, 200)),
        wrongQuestions: (input.wrongQuestions || []).slice(0, 10),
        language: normLang(input.language),
      };
    },
  )
  .handler(async ({ data }): Promise<{ lesson: CourseLesson | null; error?: string }> => {
    const wrong = data.wrongQuestions.length
      ? data.wrongQuestions.map((q) => `- ${q}`).join("\n")
      : "(none — student got everything right, still teach thoroughly)";
    const outline = data.allTitles
      .map((t, i) => `${i + 1}. ${t}`)
      .join("\n");
    const prompt = `You are writing lesson ${data.lessonNumber} of a 10-lesson course on "${data.topic}".

Course outline:
${outline}

This lesson's title: "${data.lessonTitle}"

Student's wrong pre-test questions to address where relevant:
${wrong}

Return ONLY valid JSON with this exact schema:
{
  "lesson_number": ${data.lessonNumber},
  "title": "${data.lessonTitle}",
  "explanation": "2-3 paragraphs separated by \\n\\n. Simple language, one analogy, build step by step.",
  "terms": [{ "term": "...", "definition": "..." }],
  "formulas": [{ "formula": "...", "variables": [{ "symbol": "...", "meaning": "..." }], "worked_example": "...", "explanation": "..." }],
  "real_life_examples": ["example 1", "example 2"],
  "practice_problems": [{ "problem": "...", "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."], "final_answer": "..." }],
  "has_problems": true
}

Rules:
- Stay focused on THIS lesson's scope; do not duplicate other lessons.
- Include 2-4 key terms, 0-3 formulas (empty for conceptual topics), 2 real-life examples, 1-2 practice problems.
- For each formula, include variables and a worked_example.
- For each practice_problem, provide steps as an array and final_answer as a separate string.
- ${langInstruction(data.language)}`;
    try {
      const raw: any = await callGroqJson({
        prompt,
        temperature: 0.7,
        maxTokens: 3500,
        timeoutMs: 30000,
        retryCount: 1,
        queued: false,
      });
      const wrapped = sanitizeCourse({
        course_title: "x",
        lessons: [{ ...raw, lesson_number: data.lessonNumber, title: data.lessonTitle }],
      });
      const lesson = wrapped?.lessons?.[0];
      if (!lesson) throw new Error("Invalid lesson response");
      return { lesson };
    } catch (error) {
      console.error(`generateLesson(${data.lessonNumber}) failed:`, error);
      return { lesson: null, error: AI_BUSY_MESSAGE };
    }
  });

