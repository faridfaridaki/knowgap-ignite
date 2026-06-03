import { createServerFn } from "@tanstack/react-start";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

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

async function callGroq(prompt: string, system?: string, temperature = 0.7) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");
  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Groq error:", res.status, body);
    throw new Error(`Groq API error: ${res.status}`);
  }
  const payload = await res.json();
  const content: string = payload?.choices?.[0]?.message?.content ?? "";
  const cleaned = content
    .replace(/^\s*```json\s*/i, "")
    .replace(/^\s*```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function sanitizeQuestions(raw: any): QuizQuestion[] {
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.questions) ? raw.questions : [];
  const out: QuizQuestion[] = [];
  arr.slice(0, 5).forEach((q: any, i: number) => {
    if (!q || typeof q.question !== "string" || typeof q.correct_answer !== "string") return;
    const type: "multiple_choice" | "short_answer" =
      q.type === "short_answer" ? "short_answer" : "multiple_choice";
    const options =
      type === "multiple_choice" && Array.isArray(q.options)
        ? q.options.filter((o: any) => typeof o === "string").slice(0, 4)
        : undefined;
    if (type === "multiple_choice" && (!options || options.length < 2)) return;
    out.push({
      id: i + 1,
      type,
      question: q.question,
      options,
      correct_answer: q.correct_answer,
      explanation: typeof q.explanation === "string" ? q.explanation : "",
    });
  });
  return out;
}

const QUIZ_SYSTEM = `You generate quiz questions for students. Return ONLY valid JSON. Schema:
{"questions":[{"id":1,"type":"multiple_choice"|"short_answer","question":"...","options":["A","B","C","D"],"correct_answer":"...","explanation":"..."}]}
Rules:
- Exactly 5 questions, mix of multiple_choice and short_answer (at least 3 multiple_choice).
- For multiple_choice: exactly 4 options. correct_answer MUST exactly match one of the options.
- For short_answer: omit "options". correct_answer is a short phrase (1-5 words).
- explanation is one clear sentence explaining the correct answer.`;

export const generatePreTest = createServerFn({ method: "POST" })
  .inputValidator((input: { topic: string }) => {
    if (!input?.topic?.trim()) throw new Error("Topic required");
    return { topic: input.topic.slice(0, 2000) };
  })
  .handler(async ({ data }): Promise<{ questions: QuizQuestion[] }> => {
    const parsed = await callGroq(
      `Create a 5-question pre-test to gauge a student's current understanding of: "${data.topic}". Cover core sub-concepts.`,
      QUIZ_SYSTEM,
      0.6,
    );
    const questions = sanitizeQuestions(parsed);
    if (questions.length < 3) throw new Error("Invalid quiz response");
    return { questions };
  });

export const generateFinalTest = createServerFn({ method: "POST" })
  .inputValidator((input: { topic: string; previousQuestions: string[] }) => {
    if (!input?.topic?.trim()) throw new Error("Topic required");
    return {
      topic: input.topic.slice(0, 2000),
      previousQuestions: (input.previousQuestions || []).slice(0, 10),
    };
  })
  .handler(async ({ data }): Promise<{ questions: QuizQuestion[] }> => {
    const avoid = data.previousQuestions.map((q) => `- ${q}`).join("\n");
    const parsed = await callGroq(
      `Create a 5-question FINAL test on: "${data.topic}". These questions must be DIFFERENT from the pre-test questions below but cover the same core concepts:\n${avoid}`,
      QUIZ_SYSTEM,
      0.8,
    );
    const questions = sanitizeQuestions(parsed);
    if (questions.length < 3) throw new Error("Invalid quiz response");
    return { questions };
  });

export const generateLesson = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { topic: string; missedConcepts: string[] }) => {
      if (!input?.topic?.trim()) throw new Error("Topic required");
      return {
        topic: input.topic.slice(0, 2000),
        missedConcepts: (input.missedConcepts || []).slice(0, 10),
      };
    },
  )
  .handler(async ({ data }): Promise<{ lesson: LessonConcept[] }> => {
    const list = data.missedConcepts.length
      ? data.missedConcepts.map((c) => `- ${c}`).join("\n")
      : `- Core concepts of ${data.topic}`;
    const prompt = `The student is learning about "${data.topic}". They got these questions/concepts WRONG and need a refresher:\n${list}\n\nCreate a lesson with one section per missed concept. Use VERY simple language (like explaining to a curious 10-year-old). Include a real-life example or analogy. Return JSON: {"lesson":[{"concept":"...","simple_explanation":"2-3 sentences","real_life_example":"a short concrete story or analogy","key_takeaway":"one sentence"}]}`;
    const parsed = await callGroq(prompt, undefined, 0.7);
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
  });

export const generateFlashcards = createServerFn({ method: "POST" })
  .inputValidator((input: { topic: string }) => {
    if (!input?.topic?.trim()) throw new Error("Topic required");
    return { topic: input.topic.slice(0, 2000) };
  })
  .handler(async ({ data }): Promise<{ flashcards: Flashcard[] }> => {
    const prompt = `Generate 6-8 flashcards for the topic "${data.topic}". Each flashcard has a key term and a 1-2 sentence definition. Return JSON: {"flashcards":[{"term":"...","definition":"..."}]}`;
    const parsed = await callGroq(prompt, undefined, 0.6);
    const arr = Array.isArray(parsed?.flashcards) ? parsed.flashcards : [];
    const flashcards: Flashcard[] = arr
      .filter(
        (c: any) => c && typeof c.term === "string" && typeof c.definition === "string",
      )
      .slice(0, 8);
    if (flashcards.length === 0) throw new Error("Invalid flashcards response");
    return { flashcards };
  });

interface CourseLesson {
  lesson_number: number;
  title: string;
  explanation: string;
  terms: { term: string; definition: string }[];
  formulas: { formula: string; explanation: string }[];
  real_life_examples: string[];
  practice_problems: { problem: string; answer: string; solution_steps: string }[];
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
      const formulas = Array.isArray(l.formulas)
        ? l.formulas
            .filter(
              (f: any) => f && typeof f.formula === "string" && typeof f.explanation === "string",
            )
            .map((f: any) => ({ formula: f.formula, explanation: f.explanation }))
        : [];
      const examples = Array.isArray(l.real_life_examples)
        ? l.real_life_examples.filter((e: any) => typeof e === "string")
        : [];
      const problems = Array.isArray(l.practice_problems)
        ? l.practice_problems
            .filter(
              (p: any) =>
                p &&
                typeof p.problem === "string" &&
                typeof p.answer === "string" &&
                typeof p.solution_steps === "string",
            )
            .map((p: any) => ({
              problem: p.problem,
              answer: p.answer,
              solution_steps: p.solution_steps,
            }))
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

export const generateCourse = createServerFn({ method: "POST" })
  .inputValidator((input: { topic: string; wrongQuestions: string[] }) => {
    if (!input?.topic?.trim()) throw new Error("Topic required");
    return {
      topic: input.topic.slice(0, 2000),
      wrongQuestions: (input.wrongQuestions || []).slice(0, 10),
    };
  })
  .handler(async ({ data }): Promise<{ course: Course }> => {
    const wrong = data.wrongQuestions.length
      ? data.wrongQuestions.map((q) => `- ${q}`).join("\n")
      : "(none — student got everything right, still teach the topic from scratch)";
    const prompt = `Create a complete 10-lesson course on the topic: "${data.topic}". The student got these questions wrong in the pre-test and needs special focus on them:
${wrong}

Return ONLY valid JSON with this exact schema:
{
  "course_title": "...",
  "lessons": [
    {
      "lesson_number": 1,
      "title": "...",
      "explanation": "Full clear explanation in simple language, like explaining to a 5-year-old. Use analogies. 3-5 paragraphs separated by \\n\\n.",
      "terms": [{ "term": "...", "definition": "..." }],
      "formulas": [{ "formula": "...", "explanation": "..." }],
      "real_life_examples": ["example 1", "example 2"],
      "practice_problems": [{ "problem": "...", "answer": "...", "solution_steps": "..." }],
      "has_problems": true
    }
  ]
}

Rules:
- EXACTLY 10 lessons, numbered 1-10, progressing from basics to advanced.
- "formulas" and "practice_problems" can be empty arrays [] if the topic doesn't require them.
- "has_problems" must be false for purely conceptual topics with no practice problems.
- Make explanations rich and educational. Use simple words.`;
    const parsed = await callGroq(prompt, undefined, 0.7);
    const course = sanitizeCourse(parsed);
    if (!course) throw new Error("Invalid course response");
    return { course };
  });
