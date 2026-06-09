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

interface FlashcardSource {
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

function fallbackQuestions(topic: string, lang: Lang, kind: "pre" | "final"): QuizQuestion[] {
  const isRu = lang === "ru";
  const label = kind === "pre" ? "pre-test" : "final test";
  const ruLabel = kind === "pre" ? "предварительного теста" : "итогового теста";
  const templates = isRu
    ? [
        {
          question: `Что лучше всего описывает главную цель темы "${topic}"?`,
          options: [
            `Понять основные идеи темы "${topic}" и уметь применять их`,
            "Запомнить случайные факты без связи между ними",
            "Избегать примеров и практики",
            "Использовать только сложные определения",
          ],
          correct: `Понять основные идеи темы "${topic}" и уметь применять их`,
          explanation:
            "Понимание темы означает знание ключевых идей и умение применять их в задачах.",
        },
        {
          question: `Какой первый шаг лучше сделать при изучении "${topic}"?`,
          options: [
            "Определить ключевые понятия простыми словами",
            "Сразу переходить к самым сложным деталям",
            "Игнорировать непонятные слова",
            "Учить ответы без объяснения",
          ],
          correct: "Определить ключевые понятия простыми словами",
          explanation: "Простые определения создают основу для более сложного понимания.",
        },
        {
          question: `Что показывает, что ученик действительно понимает "${topic}"?`,
          options: [
            "Он может объяснить идею своими словами и привести пример",
            "Он может повторить фразу без понимания",
            "Он избегает вопросов по теме",
            "Он знает только название темы",
          ],
          correct: "Он может объяснить идею своими словами и привести пример",
          explanation: "Собственное объяснение и пример показывают реальное понимание.",
        },
        {
          question: `Что делать, если часть темы "${topic}" непонятна?`,
          options: [
            "Разбить её на меньшие вопросы и разобрать по шагам",
            "Пропустить всю тему",
            "Учить только ответы",
            "Не использовать примеры",
          ],
          correct: "Разбить её на меньшие вопросы и разобрать по шагам",
          explanation: "Сложные темы легче понять, когда они разделены на понятные части.",
        },
        {
          question: `Какой способ лучше всего закрепляет "${topic}"?`,
          options: [
            "Решить задачу или объяснить пример самостоятельно",
            "Просто перечитать заголовок",
            "Не проверять себя",
            "Смотреть только готовые ответы",
          ],
          correct: "Решить задачу или объяснить пример самостоятельно",
          explanation: "Активная практика помогает проверить и укрепить понимание.",
        },
      ]
    : [
        {
          question: `What best describes the main goal of learning "${topic}"?`,
          options: [
            `Understand the core ideas of "${topic}" and apply them`,
            "Memorize random facts with no connection",
            "Avoid examples and practice",
            "Use only complicated definitions",
          ],
          correct: `Understand the core ideas of "${topic}" and apply them`,
          explanation: "Understanding means knowing the key ideas and being able to use them.",
        },
        {
          question: `What is the best first step when studying "${topic}"?`,
          options: [
            "Define the key concepts in simple words",
            "Jump straight to the hardest details",
            "Ignore unfamiliar terms",
            "Memorize answers without explanations",
          ],
          correct: "Define the key concepts in simple words",
          explanation: "Simple definitions create a base for deeper understanding.",
        },
        {
          question: `What shows that a student really understands "${topic}"?`,
          options: [
            "They can explain the idea in their own words and give an example",
            "They can repeat a sentence without understanding it",
            "They avoid questions about the topic",
            "They only know the topic name",
          ],
          correct: "They can explain the idea in their own words and give an example",
          explanation: "A personal explanation and example are strong signs of real understanding.",
        },
        {
          question: `What should you do if part of "${topic}" is confusing?`,
          options: [
            "Break it into smaller questions and work step by step",
            "Skip the whole topic",
            "Only memorize answers",
            "Avoid using examples",
          ],
          correct: "Break it into smaller questions and work step by step",
          explanation:
            "Complex ideas are easier to learn when they are divided into smaller parts.",
        },
        {
          question: `What is the best way to strengthen your understanding of "${topic}"?`,
          options: [
            "Solve a problem or explain an example yourself",
            "Only reread the title",
            "Never test yourself",
            "Only look at finished answers",
          ],
          correct: "Solve a problem or explain an example yourself",
          explanation: "Active practice checks and strengthens understanding.",
        },
      ];

  return templates.map((q, index) => ({
    id: index + 1,
    type: "multiple_choice",
    question:
      kind === "pre"
        ? q.question
        : isRu
          ? `${q.question} (Вопрос ${ruLabel})`
          : `${q.question} (${label} question)`,
    options: q.options,
    correct_answer: q.correct,
    explanation: q.explanation,
  }));
}

function fallbackFlashcards(
  topic: string,
  sources: FlashcardSource[],
  lessonTitles: string[],
  lang: Lang,
): Flashcard[] {
  const isRu = lang === "ru";
  if (sources.length > 0) {
    return sources.slice(0, 10).map((source) => ({
      term: source.term,
      definition: source.definition,
    }));
  }

  const baseTerms = lessonTitles.length
    ? lessonTitles
    : isRu
      ? [`Основная идея ${topic}`, "Ключевые понятия", "Практическое применение", "Пример"]
      : [`Core idea of ${topic}`, "Key concepts", "Practical application", "Example"];
  const cards = baseTerms.slice(0, 8).map((term) => ({
    term,
    definition: isRu
      ? `Это важная часть темы "${topic}". Попробуйте объяснить её своими словами и связать с конкретным примером.`
      : `This is an important part of "${topic}". Try to explain it in your own words and connect it to a concrete example.`,
  }));
  const extras = isRu
    ? [
        {
          term: "Проверка понимания",
          definition:
            "Способ убедиться, что вы можете не только узнать ответ, но и объяснить причину.",
        },
        {
          term: "Связь между идеями",
          definition:
            "Понимание становится сильнее, когда вы видите, как отдельные понятия работают вместе.",
        },
        {
          term: "Активная практика",
          definition:
            "Решение задач и самостоятельные объяснения помогают закрепить материал лучше, чем простое чтение.",
        },
      ]
    : [
        {
          term: "Understanding check",
          definition:
            "A way to confirm that you can explain the reason behind an answer, not only recognize it.",
        },
        {
          term: "Connections between ideas",
          definition:
            "Understanding gets stronger when you see how separate concepts work together.",
        },
        {
          term: "Active practice",
          definition:
            "Solving problems and explaining ideas yourself helps the material stick better than rereading.",
        },
      ];

  return [...cards, ...extras].slice(0, 10);
}

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
      return { questions: fallbackQuestions(data.topic, data.language, "pre") };
    }
  });

export const generateFinalTest = createServerFn({ method: "POST" })
  .inputValidator((input: { topic: string; previousQuestions: string[]; language?: string }) => {
    if (!input?.topic?.trim()) throw new Error("Topic required");
    return {
      topic: input.topic.slice(0, 2000),
      previousQuestions: (input.previousQuestions || []).slice(0, 10),
      language: normLang(input.language),
    };
  })
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
      return { questions: fallbackQuestions(data.topic, data.language, "final") };
    }
  });

export const generateLesson = createServerFn({ method: "POST" })
  .inputValidator((input: { topic: string; missedConcepts: string[]; language?: string }) => {
    if (!input?.topic?.trim()) throw new Error("Topic required");
    return {
      topic: input.topic.slice(0, 2000),
      missedConcepts: (input.missedConcepts || []).slice(0, 10),
      language: normLang(input.language),
    };
  })
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
  .inputValidator(
    (input: {
      topic: string;
      lessonTitles?: string[];
      sources?: FlashcardSource[];
      language?: string;
    }) => {
      if (!input?.topic?.trim()) throw new Error("Topic required");
      return {
        topic: input.topic.slice(0, 2000),
        lessonTitles: Array.isArray(input.lessonTitles)
          ? input.lessonTitles.filter((t) => typeof t === "string").slice(0, 12)
          : [],
        sources: Array.isArray(input.sources)
          ? input.sources
              .filter(
                (source) =>
                  source &&
                  typeof source.term === "string" &&
                  typeof source.definition === "string" &&
                  source.term.trim() &&
                  source.definition.trim(),
              )
              .map((source) => ({
                term: source.term.slice(0, 300),
                definition: source.definition.slice(0, 1000),
              }))
              .slice(0, 24)
          : [],
        language: normLang(input.language),
      };
    },
  )
  .handler(async ({ data }): Promise<{ flashcards: Flashcard[]; error?: string }> => {
    const lessonsBlock = data.lessonTitles.length
      ? data.lessonTitles.map((t) => `- ${t}`).join("\n")
      : "(use core concepts of the topic)";
    const sourceBlock = data.sources.length
      ? data.sources.map((source) => `- ${source.term}: ${source.definition}`).join("\n")
      : "(infer terms and formulas from the lessons)";
    const prompt = `Generate 8-10 flashcards for the topic "${data.topic}". Use ONLY important terms and formulas. The front must be only a term, concept name, or formula. The back must be its definition, meaning, or formula explanation. Do not create study-strategy cards.\n\nLessons:\n${lessonsBlock}\n\nAvailable terms and formulas:\n${sourceBlock}\n\nReturn ONLY JSON: {"flashcards":[{"term":"...","definition":"..."}]} where definition is 1-2 clear sentences.\n${langInstruction(data.language)}`;
    try {
      const parsed = await callGroqJson({ prompt, temperature: 0.6 });
      const arr = Array.isArray(parsed?.flashcards) ? parsed.flashcards : [];
      const flashcards: Flashcard[] = arr
        .filter((c: any) => c && typeof c.term === "string" && typeof c.definition === "string")
        .slice(0, 10);
      if (flashcards.length === 0) throw new Error("Invalid flashcards response");
      return { flashcards };
    } catch (error) {
      console.error("generateFlashcards failed:", error);
      return {
        flashcards: fallbackFlashcards(data.topic, data.sources, data.lessonTitles, data.language),
      };
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
              worked_example: typeof f.worked_example === "string" ? f.worked_example : undefined,
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

function fallbackCourse(topic: string, lang: Lang): Course {
  const titles =
    lang === "ru"
      ? [
          `Основы темы: ${topic}`,
          "Ключевые термины и идеи",
          "Как устроена тема шаг за шагом",
          "Типичные ошибки и заблуждения",
          "Практические примеры",
          "Связи между главными понятиями",
          "Решение базовых задач",
          "Решение более сложных задач",
          "Как проверять своё понимание",
          "Итоговое повторение и следующий шаг",
        ]
      : [
          `Foundations of ${topic}`,
          "Key terms and core ideas",
          "How the topic works step by step",
          "Common mistakes and misconceptions",
          "Practical examples",
          "How the main ideas connect",
          "Solving basic problems",
          "Solving harder problems",
          "How to check your understanding",
          "Final review and next steps",
        ];

  return {
    course_title: lang === "ru" ? `Курс по теме: ${topic}` : `Course on ${topic}`,
    lessons: titles.map((title, index) => emptyLesson(index + 1, title)),
  };
}

function fallbackLesson(data: {
  topic: string;
  lessonNumber: number;
  lessonTitle: string;
  allTitles: string[];
  wrongQuestions: string[];
  language: Lang;
}): CourseLesson {
  const isRu = data.language === "ru";
  const previous = data.allTitles.slice(0, Math.max(0, data.lessonNumber - 1)).join(", ");
  const next = data.allTitles.slice(data.lessonNumber).join(", ");
  const focus = data.wrongQuestions[0] || data.topic;
  const title =
    data.lessonTitle || (isRu ? `Урок ${data.lessonNumber}` : `Lesson ${data.lessonNumber}`);

  return {
    lesson_number: data.lessonNumber,
    title,
    explanation: isRu
      ? [
          `В этом уроке мы разбираем "${title}" в рамках темы "${data.topic}". Главная цель - понять идею простыми словами, а затем связать её с тем, что уже было в курсе.`,
          previous
            ? `Перед этим были темы: ${previous}. Используй их как основу: новое понятие должно объяснять, уточнять или применять то, что ты уже изучил.`
            : `Начни с базового вопроса: что это такое, зачем это нужно и какую проблему помогает решить?`,
          next
            ? `Дальше курс перейдёт к: ${next}. Поэтому после урока попробуй сформулировать связь между этим уроком и следующими темами одним предложением.`
            : `Это завершающий урок, поэтому собери всё в одну картину: определение, пример, типичная ошибка и способ проверить себя.`,
        ].join("\n\n")
      : [
          `In this lesson, we focus on "${title}" inside the broader topic of "${data.topic}". The goal is to understand the idea in plain language, then connect it to the rest of the course.`,
          previous
            ? `The earlier lessons were: ${previous}. Use those as the base: this lesson should extend, clarify, or apply what came before.`
            : `Start with the basic question: what is it, why does it matter, and what problem does it help solve?`,
          next
            ? `Next, the course moves toward: ${next}. After this lesson, try to explain how this idea prepares you for those topics in one sentence.`
            : `This is the final lesson, so pull everything together: definition, example, common mistake, and a quick self-check.`,
        ].join("\n\n"),
    terms: isRu
      ? [
          {
            term: "Главная идея",
            definition: `Основной смысл урока "${title}" в теме "${data.topic}".`,
          },
          { term: "Пример", definition: "Конкретная ситуация, где идея становится понятной." },
          {
            term: "Проверка понимания",
            definition: "Способ объяснить тему своими словами без подсказок.",
          },
        ]
      : [
          {
            term: "Core idea",
            definition: `The main meaning of "${title}" within "${data.topic}".`,
          },
          {
            term: "Example",
            definition: "A concrete situation that makes the idea easier to understand.",
          },
          {
            term: "Understanding check",
            definition: "A way to explain the topic in your own words without hints.",
          },
        ],
    formulas: [],
    real_life_examples: isRu
      ? [
          `Представь, что ты объясняешь "${title}" другу за одну минуту: сначала дай простое определение, потом пример.`,
          `Свяжи урок с вопросом, который вызвал трудность: "${focus}". Это помогает превратить ошибку в ориентир для обучения.`,
        ]
      : [
          `Imagine explaining "${title}" to a friend in one minute: start with a simple definition, then give one example.`,
          `Connect the lesson to a question that was difficult: "${focus}". That turns a mistake into a guide for learning.`,
        ],
    practice_problems: [
      {
        problem: isRu
          ? `Объясни "${title}" своими словами и приведи один пример из реальной жизни.`
          : `Explain "${title}" in your own words and give one real-life example.`,
        steps: isRu
          ? [
              "Шаг 1: Напиши короткое определение.",
              "Шаг 2: Добавь пример.",
              "Шаг 3: Проверь, связано ли объяснение с общей темой.",
            ]
          : [
              "Step 1: Write a short definition.",
              "Step 2: Add an example.",
              "Step 3: Check whether the explanation connects to the bigger topic.",
            ],
        final_answer: isRu
          ? "Хороший ответ содержит определение, пример и связь с темой."
          : "A good answer includes a definition, an example, and a connection to the topic.",
      },
    ],
    has_problems: true,
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
          (found && typeof found.title === "string" && found.title.trim()) || `Lesson ${i}`;
        lessons.push(emptyLesson(i, lessonTitle));
      }
      return { course: { course_title: title, lessons } };
    } catch (error) {
      console.error("generateCourse (outline) failed:", error);
      return { course: fallbackCourse(data.topic, data.language) };
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
    const outline = data.allTitles.map((t, i) => `${i + 1}. ${t}`).join("\n");
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
      console.error(`generateCourseLesson(${data.lessonNumber}) failed:`, error);
      return { lesson: fallbackLesson(data) };
    }
  });
