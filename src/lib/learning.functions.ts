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
  format_version?: string;
  simple_definition?: string;
  expanded_explanation?: string;
  how_it_works?: string;
  example?: string;
}

interface FlashcardSource {
  term: string;
  definition: string;
}

const FLASHCARD_FORMAT_VERSION = "topic-rich-v2";
const COURSE_LESSON_FORMAT_VERSION = "practical-lesson-v3";
const GENERIC_FLASHCARD_TERMS = new Set([
  "word",
  "definition",
  "part of speech",
  "context",
  "etymology",
  "example",
  "concept",
  "term",
]);

function shuffleOptions(options: string[]): string[] {
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function uniqueFlashcards(cards: Flashcard[]): Flashcard[] {
  const seen = new Set<string>();
  const out: Flashcard[] = [];
  for (const card of cards) {
    const term = card.term.trim();
    const simple_definition = (card.simple_definition || card.definition).trim();
    const definition = (card.definition || simple_definition).trim();
    if (!term || !definition) continue;
    const key = normalizeKey(term);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      term,
      definition,
      format_version: FLASHCARD_FORMAT_VERSION,
      simple_definition,
      expanded_explanation: card.expanded_explanation?.trim(),
      how_it_works: card.how_it_works?.trim(),
      example: card.example?.trim(),
    });
  }
  return out;
}

function buildFlashcard(
  term: string,
  simple_definition: string,
  expanded_explanation: string,
  how_it_works: string,
  example: string,
): Flashcard {
  return {
    term,
    definition: simple_definition,
    format_version: FLASHCARD_FORMAT_VERSION,
    simple_definition,
    expanded_explanation,
    how_it_works,
    example,
  };
}

function topicAllowsLanguageTerms(topic: string): boolean {
  const normalized = normalizeKey(topic);
  return [
    "language",
    "linguistic",
    "grammar",
    "vocabulary",
    "word",
    "definition",
    "speech",
    "etymology",
    "english",
    "writing",
  ].some((needle) => normalized.includes(needle));
}

function isTopicSpecificFlashcard(card: Flashcard, topic: string): boolean {
  if (
    !card.simple_definition ||
    !card.expanded_explanation ||
    !card.how_it_works ||
    !card.example
  ) {
    return false;
  }
  if (!topicAllowsLanguageTerms(topic) && GENERIC_FLASHCARD_TERMS.has(normalizeKey(card.term))) {
    return false;
  }
  return true;
}

function isMathTopic(value: string): boolean {
  return /\b(math|mathematics|algebra|geometry|arithmetic|calculus|statistics|probability|fraction|ratio|percentage)\b/i.test(
    value,
  );
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
    const shuffledOptions = shuffleOptions(options);
    out.push({
      id: i + 1,
      type: "multiple_choice",
      question: q.question,
      options: shuffledOptions,
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

  return templates.map((q, index) => {
    const shuffledOptions = shuffleOptions(q.options);
    return {
      id: index + 1,
      type: "multiple_choice",
      question:
        kind === "pre"
          ? q.question
          : isRu
            ? `${q.question} (Вопрос ${ruLabel})`
            : `${q.question} (${label} question)`,
      options: shuffledOptions,
      correct_answer: q.correct,
      explanation: q.explanation,
    };
  });
}

function fallbackFlashcards(
  topic: string,
  sources: FlashcardSource[],
  lessonTitles: string[],
  lang: Lang,
): Flashcard[] {
  const isRu = lang === "ru";
  const sourceCards = uniqueFlashcards(
    sources.map((source) => ({
      term: source.term,
      definition: source.definition,
      simple_definition: source.definition,
      expanded_explanation: isRu
        ? `Это понятие относится к теме "${topic}" и помогает точнее понимать материал. Оно задает смысл термина и показывает, где его использовать.`
        : `This concept belongs to "${topic}" and helps explain the topic more precisely. It gives the term a clear meaning and shows where it should be used.`,
      how_it_works: isRu
        ? `Сначала определи, что обозначает термин, затем найди его роль в задаче, примере или объяснении.`
        : `First identify what the term names, then connect it to its role in a problem, example, or explanation.`,
      example: isRu
        ? `В теме "${topic}" термин "${source.term}" используется для объяснения конкретной части материала.`
        : `In "${topic}", "${source.term}" is used to explain a specific part of the material.`,
    })),
  );

  const baseTerms = lessonTitles.length
    ? lessonTitles
    : isRu
      ? [`Основная идея ${topic}`, "Ключевые понятия", "Практическое применение", "Пример"]
      : [`Core idea of ${topic}`, "Key concepts", "Practical application", "Example"];
  const lessonCards = baseTerms.map((term) => ({
    ...buildFlashcard(
      term,
      isRu ? `Важное понятие из темы "${topic}".` : `An important concept from "${topic}".`,
      isRu
        ? `Это понятие обозначает одну из центральных идей темы и помогает связать отдельные факты в понятную систему.`
        : `This concept names one of the central ideas in the topic and helps connect separate facts into a clearer system.`,
      isRu
        ? `Когда ты встречаешь это понятие, спроси, какую роль оно играет: описывает объект, процесс, правило, причину или результат.`
        : `When you see this concept, ask what role it plays: object, process, rule, cause, or result.`,
      isRu
        ? `Например, в теме "${topic}" это понятие может использоваться для объяснения шага в решении.`
        : `For example, in "${topic}", this concept can explain one step in solving a problem.`,
    ),
  }));
  const extras = isRu
    ? [
        buildFlashcard(
          `${topic}: определение`,
          `Краткое объяснение значения темы "${topic}".`,
          `Определение устанавливает границы понятия: что входит в него и что не входит.`,
          `Оно обычно называет общий класс понятия и добавляет признаки, которые делают его отличимым.`,
          `Например, определение помогает понять, какие идеи действительно относятся к теме "${topic}".`,
        ),
        buildFlashcard(
          `${topic}: ключевой принцип`,
          `Главное правило или идея темы "${topic}".`,
          `Ключевой принцип показывает, на чем строится понимание материала и почему отдельные шаги работают.`,
          `Он связывает термины, примеры и задачи в одно объяснение.`,
          `Например, при решении задачи принцип подсказывает, какой метод выбрать.`,
        ),
        buildFlashcard(
          `${topic}: применение`,
          `Использование знаний по теме "${topic}" на практике.`,
          `Применение показывает, как идея переходит из объяснения в действие, решение или вывод.`,
          `Ты выбираешь нужное понятие, проверяешь условия и используешь его для конкретной цели.`,
          `Например, понятие можно применить, чтобы решить задачу или объяснить ситуацию.`,
        ),
        buildFlashcard(
          `${topic}: связь понятий`,
          `Отношение между несколькими терминами темы "${topic}".`,
          `Связи показывают, как одно понятие поддерживает, ограничивает или объясняет другое.`,
          `Чтобы найти связь, сравни роли терминов и посмотри, зависят ли они друг от друга.`,
          `Например, причина может быть связана с результатом через процесс.`,
        ),
        buildFlashcard(
          `${topic}: процесс`,
          `Последовательность шагов или изменений в теме "${topic}".`,
          `Процесс объясняет, как что-то развивается от начального состояния к результату.`,
          `Он работает через порядок действий, условий или причин, которые следуют друг за другом.`,
          `Например, процесс можно описать как шаг 1, шаг 2 и итог.`,
        ),
      ]
    : [
        buildFlashcard(
          `${topic}: definition`,
          `A short explanation of what "${topic}" means.`,
          `A definition sets the boundaries of a concept: what belongs to it and what does not.`,
          `It usually names the general category first, then adds the specific features that make the concept different.`,
          `For example, a definition helps decide which ideas really belong to "${topic}".`,
        ),
        buildFlashcard(
          `${topic}: key principle`,
          `The main rule or idea behind "${topic}".`,
          `A key principle explains why the material works and gives the topic its basic logic.`,
          `It connects terms, examples, and problems into one usable explanation.`,
          `For example, the principle can tell you which method to use in a problem.`,
        ),
        buildFlashcard(
          `${topic}: application`,
          `Using knowledge of "${topic}" in practice.`,
          `Application shows how an idea moves from explanation into action, problem solving, or interpretation.`,
          `You choose the right concept, check the conditions, and use it for a specific goal.`,
          `For example, you can apply a concept to solve a task or explain a situation.`,
        ),
        buildFlashcard(
          `${topic}: concept relationship`,
          `A connection between terms in "${topic}".`,
          `Concept relationships show how one idea supports, limits, causes, or explains another.`,
          `To find a relationship, compare the roles of two terms and check whether one depends on the other.`,
          `For example, a cause can connect to an outcome through a process.`,
        ),
        buildFlashcard(
          `${topic}: process`,
          `A sequence of steps or changes in "${topic}".`,
          `A process explains how something develops from a starting point to a result.`,
          `It works through ordered actions, causes, or conditions that follow one another.`,
          `For example, a process can be described as step 1, step 2, then the result.`,
        ),
      ];

  return uniqueFlashcards([...sourceCards, ...lessonCards, ...extras]).slice(0, 10);
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
      : "(infer terms from the lessons)";
    const prompt = `Generate EXACTLY 10 flashcards for the MAIN COURSE TOPIC "${data.topic}".

Every card MUST be based directly on the main course topic and its lessons. Use course-specific terms, rules, processes, formulas, methods, or concepts. Do NOT create generic language-learning cards such as "Word", "Definition", "Part of Speech", "Context", or "Etymology" unless the main course topic is actually about linguistics or vocabulary.

Each card must use a different important term or concept. The front must be ONLY the term or concept name. The back must teach that term using Markdown-friendly content in these exact fields:
- simple_definition: one short sentence giving the exact meaning
- expanded_explanation: one clear paragraph explaining the concept more deeply
- how_it_works: 2-4 concise Markdown bullets or numbered steps explaining mechanisms, rules, formulas, usage, or problem-solving role
- example: one concrete example that uses the term in the context of "${data.topic}"

Do not include formulas-only cards, study strategies, questions, examples-only cards, lesson-title-only cards, or generic filler cards.
For math, use proper superscript characters for powers, such as x², y³, 10⁵, and 5x⁴. Never use the caret symbol for exponents.
Do not write long unformatted step-by-step prose.

Lessons:
${lessonsBlock}

Available terms:
${sourceBlock}

Return ONLY JSON: {"flashcards":[{"term":"...","definition":"same as simple_definition","simple_definition":"...","expanded_explanation":"...","how_it_works":"...","example":"..."}]}.
${langInstruction(data.language)}`;
    try {
      const parsed = await callGroqJson({ prompt, temperature: 0.6 });
      const arr = Array.isArray(parsed?.flashcards) ? parsed.flashcards : [];
      const flashcards = uniqueFlashcards(
        arr.filter(
          (c: any) =>
            c &&
            typeof c.term === "string" &&
            (typeof c.definition === "string" || typeof c.simple_definition === "string"),
        ),
      ).filter((card) => isTopicSpecificFlashcard(card, data.topic));
      if (flashcards.length < 10) throw new Error("Invalid flashcards response");
      return { flashcards: flashcards.slice(0, 10) };
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
interface LessonCheckpointQuestion extends QuizQuestion {
  type: "multiple_choice";
}
interface CourseLesson {
  lesson_number: number;
  title: string;
  format_version?: string;
  explanation: string;
  terms: { term: string; definition: string }[];
  formulas: CourseFormula[];
  real_life_examples: string[];
  practice_problems: CoursePracticeProblem[];
  checkpoint_question?: LessonCheckpointQuestion;
  has_problems: boolean;
}
interface Course {
  course_title: string;
  lessons: CourseLesson[];
}

function sanitizeCheckpointQuestion(raw: any, id: number): LessonCheckpointQuestion | undefined {
  const q = raw?.checkpoint_question ?? raw;
  if (!q || typeof q.question !== "string" || typeof q.correct_answer !== "string") {
    return undefined;
  }
  const options = Array.isArray(q.options)
    ? q.options.filter((o: any) => typeof o === "string").slice(0, 4)
    : [];
  if (options.length !== 4 || !options.includes(q.correct_answer)) return undefined;
  return {
    id,
    type: "multiple_choice",
    question: q.question,
    options: shuffleOptions(options),
    correct_answer: q.correct_answer,
    explanation: typeof q.explanation === "string" ? q.explanation : "",
  };
}

function fallbackMathCheckpointQuestion(data: {
  topic: string;
  lessonNumber: number;
  lessonTitle: string;
  language: Lang;
}): LessonCheckpointQuestion {
  const isRu = data.language === "ru";
  if (isRu) {
    const correct = "5 стаканов";
    return {
      id: data.lessonNumber,
      type: "multiple_choice",
      question:
        "Рецепт использует 3 стакана риса на 6 человек. Сколько стаканов нужно на 10 человек?",
      options: shuffleOptions([correct, "4 стакана", "6 стаканов", "9 стаканов"]),
      correct_answer: correct,
      explanation: "Пропорция 3/6 = x/10 даёт 6x = 30, значит x = 5.",
    };
  }

  const title = normalizeKey(data.lessonTitle);
  const make = (
    question: string,
    correct: string,
    wrong: string[],
    explanation: string,
  ): LessonCheckpointQuestion => ({
    id: data.lessonNumber,
    type: "multiple_choice",
    question,
    options: shuffleOptions([correct, ...wrong]),
    correct_answer: correct,
    explanation,
  });

  if (/(proportion|percentage|ratio|fraction)/i.test(title)) {
    return make(
      "A recipe uses 3 cups of rice for 6 people. At the same rate, how many cups are needed for 10 people?",
      "5 cups",
      ["4 cups", "6 cups", "9 cups"],
      "Set 3/6 = x/10, then cross-multiply: 6x = 30, so x = 5.",
    );
  }
  if (/(mental|estimation|scaling)/i.test(title)) {
    return make(
      "Estimate 19 × 51 by rounding to nearby friendly numbers. Which estimate is best?",
      "About 1,000",
      ["About 100", "About 500", "About 2,000"],
      "Round 19 to 20 and 51 to 50, then calculate 20 × 50 = 1,000.",
    );
  }
  if (/(algebra|unknown|variable|equation)/i.test(title)) {
    return make(
      "Solve for x: 3x + 6 = 24.",
      "x = 6",
      ["x = 5", "x = 8", "x = 10"],
      "Subtract 6 from both sides to get 3x = 18, then divide by 3.",
    );
  }
  if (/(geometry|area|volume|space)/i.test(title)) {
    return make(
      "A rectangle is 8 meters long and 5 meters wide. What is its area?",
      "40 square meters",
      ["13 square meters", "26 square meters", "80 square meters"],
      "Rectangle area is length × width, so 8 × 5 = 40.",
    );
  }
  if (/(exponent|scaling|growth)/i.test(title)) {
    return make("What is 2³?", "8", ["5", "6", "9"], "2³ means 2 × 2 × 2, which equals 8.");
  }
  if (/(probability|odds|risk)/i.test(title)) {
    return make(
      "A bag has 3 red marbles and 7 blue marbles. What is the probability of picking a red marble?",
      "3/10",
      ["3/7", "7/10", "1/3"],
      "There are 10 total marbles and 3 are red, so the probability is 3/10.",
    );
  }
  if (/(data|average|median|graph)/i.test(title)) {
    return make(
      "What is the median of 4, 9, 2, 11, and 7?",
      "7",
      ["4", "6.6", "9"],
      "Order the numbers as 2, 4, 7, 9, 11. The middle value is 7.",
    );
  }
  if (/(financial|interest|loan|inflation)/i.test(title)) {
    return make(
      "What is 10% simple interest on $200 for one year?",
      "$20",
      ["$10", "$30", "$40"],
      "Simple interest is principal × rate, so 200 × 0.10 = 20.",
    );
  }
  return make(
    "A problem takes 4 steps, and each step has 3 possible choices. How many total paths are possible?",
    "81",
    ["12", "64", "27"],
    "Multiply the choices for each step: 3 × 3 × 3 × 3 = 81.",
  );
}

function fallbackCheckpointQuestion(data: {
  topic: string;
  lessonNumber: number;
  lessonTitle: string;
  language: Lang;
}): LessonCheckpointQuestion {
  if (isMathTopic(`${data.topic} ${data.lessonTitle}`)) {
    return fallbackMathCheckpointQuestion(data);
  }
  const isRu = data.language === "ru";
  const correct = isRu
    ? `Объяснить "${data.lessonTitle}" и применить его к теме "${data.topic}"`
    : `Explain "${data.lessonTitle}" and apply it to "${data.topic}"`;
  return {
    id: data.lessonNumber,
    type: "multiple_choice",
    question: isRu
      ? `Что лучше всего показывает понимание урока "${data.lessonTitle}"?`
      : `What best shows that you understand the lesson "${data.lessonTitle}"?`,
    options: shuffleOptions(
      isRu
        ? [
            correct,
            "Запомнить только название урока",
            "Пропустить примеры и перейти дальше",
            "Выучить отдельный факт без связи с темой",
          ]
        : [
            correct,
            "Only memorize the lesson title",
            "Skip the examples and move on",
            "Learn one isolated fact without connecting it to the topic",
          ],
    ),
    correct_answer: correct,
    explanation: isRu
      ? "Понимание означает, что ты можешь объяснить идею и применить её в контексте темы."
      : "Understanding means you can explain the idea and use it in the topic context.",
  };
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
        format_version: l.explanation?.trim() ? COURSE_LESSON_FORMAT_VERSION : undefined,
        explanation: l.explanation,
        terms,
        formulas,
        real_life_examples: examples,
        practice_problems: problems,
        checkpoint_question: sanitizeCheckpointQuestion(l.checkpoint_question, i + 1),
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
    format_version: undefined,
    explanation: "",
    terms: [],
    formulas: [],
    real_life_examples: [],
    practice_problems: [],
    checkpoint_question: undefined,
    has_problems: false,
  };
}

function fallbackCourse(topic: string, lang: Lang): Course {
  const mathTopic = isMathTopic(topic);
  const titles =
    mathTopic && lang === "ru"
      ? [
          "Пропорции, проценты и дроби",
          "Быстрый счёт и оценка результата",
          "Алгебраическое мышление и неизвестные",
          "Геометрия площади, объёма и пространства",
          "Степени, масштабирование и рост",
          "Вероятность, шансы и риск",
          "Средние значения, медианы и графики",
          "Логика, условия и таблицы истинности",
          "Финансовая математика: проценты и кредиты",
          "Стратегии решения сложных задач",
        ]
      : mathTopic
        ? [
            "Mastering Proportions, Percentages, Ratios, and Fractions",
            "Mental Math Shortcuts for Estimation and Scaling",
            "Algebraic Thinking and Solving for Unknowns",
            "Geometry of Area, Volume, and Space",
            "Exponents, Scaling, Growth, and Large Numbers",
            "Probability, Odds, Risk, and Expected Outcomes",
            "Reading Data with Averages, Medians, and Graphs",
            "Logic, Conditions, and Truth Tables",
            "Financial Math with Interest, Loans, and Inflation",
            "Problem-Solving Frameworks for Unfamiliar Problems",
          ]
        : lang === "ru"
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

function fallbackMathLesson(data: {
  topic: string;
  lessonNumber: number;
  lessonTitle: string;
  allTitles: string[];
  wrongQuestions: string[];
  language: Lang;
}): CourseLesson | null {
  if (data.language === "ru") return null;

  const title =
    data.lessonTitle || (data.lessonNumber === 1 ? "Mastering Proportions and Fractions" : "Math");
  const normalizedTitle = normalizeKey(title);

  if (data.lessonNumber === 1 || /(proportion|percentage|ratio|fraction)/i.test(normalizedTitle)) {
    return {
      lesson_number: data.lessonNumber,
      title,
      format_version: COURSE_LESSON_FORMAT_VERSION,
      explanation: [
        "## The Core Concept",
        "A fraction shows part of a whole, like 3/4 meaning 3 equal parts out of 4. A ratio compares two quantities, like 2:3 meaning 2 of one thing for every 3 of another thing. A proportion says two fractions or ratios are equal.",
        "The key rule is cross-multiplication: if a/b = c/d, then a × d = b × c. A percentage is a fraction out of 100, so 25% = 25/100 = 1/4.",
        "## The Real-Life Anchor",
        "Imagine a pancake recipe uses 2 cups of flour for 8 pancakes. If you want 20 pancakes, guessing can waste ingredients. A proportion keeps the recipe relationship the same while scaling it up.",
        "## Step-by-Step Walkthrough",
        "Problem: 2 cups of flour make 8 pancakes. How many cups make 20 pancakes?",
        "1. Write the matching ratios: 2/8 = x/20.",
        "2. Cross-multiply: 2 × 20 = 8 × x.",
        "3. Simplify: 40 = 8x.",
        "4. Divide both sides by 8: x = 5.",
        "Answer: you need 5 cups of flour.",
        "## Practice Before Answers",
        "Try the practice problems below before opening the answers. They are numerical, and each one uses the same proportional reasoning in a slightly harder way.",
      ].join("\n\n"),
      terms: [
        {
          term: "Fraction",
          definition: "A number that shows part of a whole, written as numerator/denominator.",
        },
        {
          term: "Ratio",
          definition: "A comparison between two quantities, such as 2:3 or 2/3.",
        },
        {
          term: "Proportion",
          definition: "An equation showing that two ratios or fractions are equal.",
        },
        {
          term: "Percentage",
          definition: "A fraction out of 100, such as 40% = 40/100.",
        },
      ],
      formulas: [
        {
          formula: "a/b = c/d → a × d = b × c",
          variables: [{ symbol: "a, b, c, d", meaning: "The four numbers in two equal ratios" }],
          worked_example: "3/6 = x/10 → 3 × 10 = 6x → 30 = 6x → x = 5.",
          explanation:
            "Cross-multiplication lets you solve for a missing value when two ratios are equal.",
        },
        {
          formula: "p% of total = p/100 × total",
          variables: [
            { symbol: "p", meaning: "The percentage number" },
            { symbol: "total", meaning: "The whole amount you are taking a percent of" },
          ],
          worked_example: "25% of 80 = 25/100 × 80 = 20.",
          explanation: "Convert the percent into a fraction out of 100, then multiply.",
        },
      ],
      real_life_examples: [
        "Cooking: scale 2 cups of flour for 8 pancakes up to 20 pancakes without changing the recipe balance.",
        "Shopping: calculate a 25% discount on an $80 shirt by turning 25% into 25/100 and multiplying.",
      ],
      practice_problems: [
        {
          problem:
            "Easy: A recipe uses 3 cups of rice to serve 6 people. How many cups are needed for 10 people?",
          steps: [
            "Set up the proportion: 3/6 = x/10.",
            "Cross-multiply: 3 × 10 = 6x.",
            "Simplify: 30 = 6x.",
            "Divide by 6: x = 5.",
          ],
          final_answer: "5 cups of rice.",
        },
        {
          problem:
            "Medium: A jacket costs $120 and is discounted by 30%. How much is the discount, and what is the final price?",
          steps: [
            "Convert 30% to 30/100.",
            "Find the discount: 30/100 × 120 = 36.",
            "Subtract from the original price: 120 - 36 = 84.",
          ],
          final_answer: "$36 discount, final price $84.",
        },
        {
          problem:
            "Hard: A car travels 180 miles using 6 gallons of gas. At the same rate, how many gallons are needed for 450 miles?",
          steps: [
            "Set up miles per gallon as a proportion: 180/6 = 450/x.",
            "Cross-multiply: 180x = 6 × 450.",
            "Simplify: 180x = 2700.",
            "Divide by 180: x = 15.",
          ],
          final_answer: "15 gallons.",
        },
      ],
      checkpoint_question: fallbackMathCheckpointQuestion(data),
      has_problems: true,
    };
  }

  const checkpoint = fallbackMathCheckpointQuestion(data);
  return {
    lesson_number: data.lessonNumber,
    title,
    format_version: COURSE_LESSON_FORMAT_VERSION,
    explanation: [
      "## The Core Concept",
      `This lesson teaches "${title}" as a practical math skill, not as a vocabulary topic. The goal is to identify the known values, choose the correct rule, calculate carefully, and check whether the answer makes sense.`,
      "## The Real-Life Anchor",
      "Picture a real decision with numbers: planning a budget, measuring a room, comparing risk, or checking whether a deal is actually good. The math matters because it turns a guess into a testable answer.",
      "## Step-by-Step Walkthrough",
      "Problem: A value changes from 40 to 50. What is the percent increase?",
      "1. Find the change: 50 - 40 = 10.",
      "2. Divide by the original value: 10/40 = 0.25.",
      "3. Convert to a percent: 0.25 × 100 = 25%.",
      "Answer: the value increased by 25%.",
      "## Practice Before Answers",
      "Use the same habit for each problem: write the known values, choose the rule, calculate, then check the result.",
    ].join("\n\n"),
    terms: [
      { term: "Known value", definition: "A number given directly in the problem." },
      { term: "Unknown value", definition: "The number you need to calculate." },
      { term: "Equation", definition: "A mathematical statement that two expressions are equal." },
    ],
    formulas: [
      {
        formula: "percent change = change/original × 100",
        variables: [
          { symbol: "change", meaning: "New value minus original value" },
          { symbol: "original", meaning: "The starting value" },
        ],
        worked_example: "From 40 to 50: change = 10, so 10/40 × 100 = 25%.",
        explanation: "Percent change compares the size of the change to the starting amount.",
      },
    ],
    real_life_examples: [
      "A store raises a price from $40 to $50, so percent change tells you how large the increase really is.",
      "A score improves from 24 to 30, so percent change compares the improvement to the original score.",
    ],
    practice_problems: [
      {
        problem: "Easy: A price rises from $20 to $25. What is the percent increase?",
        steps: [
          "Find the change: 25 - 20 = 5.",
          "Divide by the original: 5/20 = 0.25.",
          "Convert to a percent: 0.25 × 100 = 25%.",
        ],
        final_answer: "25% increase.",
      },
      {
        problem: "Medium: A score drops from 80 to 68. What is the percent decrease?",
        steps: [
          "Find the change: 80 - 68 = 12.",
          "Divide by the original: 12/80 = 0.15.",
          "Convert to a percent: 0.15 × 100 = 15%.",
        ],
        final_answer: "15% decrease.",
      },
      {
        problem:
          "Hard: A business grows from 250 customers to 325 customers. What is the percent increase?",
        steps: [
          "Find the change: 325 - 250 = 75.",
          "Divide by the original: 75/250 = 0.30.",
          "Convert to a percent: 0.30 × 100 = 30%.",
        ],
        final_answer: "30% increase.",
      },
    ],
    checkpoint_question: checkpoint,
    has_problems: true,
  };
}

function hasMathSignal(value: string): boolean {
  return /[0-9=×÷+/%$²³⁴⁵⁶⁷⁸⁹]/.test(value);
}

function isWeakMathLesson(lesson: CourseLesson, topic: string): boolean {
  if (!isMathTopic(`${topic} ${lesson.title}`)) return false;
  const explanation = lesson.explanation.toLowerCase();
  const practiceText = lesson.practice_problems
    .map((problem) => `${problem.problem} ${problem.steps.join(" ")} ${problem.final_answer}`)
    .join(" ");
  const checkpointText = `${lesson.checkpoint_question?.question ?? ""} ${
    lesson.checkpoint_question?.correct_answer ?? ""
  }`;
  const forbiddenSoftPrompt =
    /explain .*own words|in your own words|what best shows|understanding check|only memorize|skip the examples/i;

  if (!explanation.includes("core concept")) return true;
  if (!explanation.includes("real-life anchor")) return true;
  if (!explanation.includes("step-by-step")) return true;
  if (lesson.formulas.length === 0) return true;
  if (lesson.practice_problems.length < 3) return true;
  if (
    lesson.practice_problems.some(
      (problem) =>
        !hasMathSignal(problem.problem) ||
        problem.steps.length === 0 ||
        !problem.final_answer.trim(),
    )
  ) {
    return true;
  }
  if (!lesson.checkpoint_question || !hasMathSignal(checkpointText)) return true;
  return forbiddenSoftPrompt.test(`${practiceText} ${checkpointText}`);
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

  if (isMathTopic(`${data.topic} ${title}`)) {
    const mathLesson = fallbackMathLesson(data);
    if (mathLesson) return mathLesson;
  }

  return {
    lesson_number: data.lessonNumber,
    title,
    format_version: COURSE_LESSON_FORMAT_VERSION,
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
    checkpoint_question: fallbackCheckpointQuestion(data),
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
- Return EXACTLY 10 lessons, numbered 1-10.
- Build a clear progression: lessons 1-3 are foundations, lessons 4-6 are intermediate tools, lessons 7-9 are applied or advanced subtopics, lesson 10 integrates the course.
- Every lesson MUST teach a different subtopic. Do not make ten lessons that all explain the same idea with different wording.
- If the topic is broad, split it into concrete subdomains. For math, examples of distinct subtopics are proportions, mental math, algebra, geometry, exponents, probability, data, logic, financial math, and problem-solving frameworks.
- Each title must name the exact subtopic and skill, not just a generic phrase like "Introduction" or "Advanced Concepts".
- Each title is short (under 90 chars), specific, and descriptive.
- Use the student's wrong questions only to choose emphasis; do not let every lesson become about the same pre-test mistake.
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
  "explanation": "Markdown string. For math, use these sections: The Core Concept, The Real-Life Anchor, Step-by-Step Walkthrough, Practice Before Answers.",
  "terms": [{ "term": "...", "definition": "..." }],
  "formulas": [{ "formula": "...", "variables": [{ "symbol": "...", "meaning": "..." }], "worked_example": "...", "explanation": "..." }],
  "real_life_examples": ["example 1", "example 2"],
  "practice_problems": [{ "problem": "...", "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."], "final_answer": "..." }],
  "checkpoint_question": { "id": ${data.lessonNumber}, "type": "multiple_choice", "question": "...", "options": ["...", "...", "...", "..."], "correct_answer": "...", "explanation": "..." },
  "has_problems": true
}

Rules:
- The lesson must be real educational content, not a study plan. Explain the concepts, rules, formulas, and methods directly.
- Never generate placeholder lessons, generic templates, or repeated paragraphs that only swap the lesson title.
- Never use fake practice problems such as "explain this in your own words" for math. Math practice must contain numbers, equations, measurements, prices, probabilities, graphs/data values, or other calculable quantities.
- Never make the checkpoint test whether the student understands "understanding". The checkpoint must test the actual skill from this lesson.
- Stay focused on THIS lesson's subtopic: "${data.lessonTitle}".
- Use the full course outline to avoid repetition. Do not reteach earlier or later lessons except for one short connection sentence when useful.
- Make the lesson progressively appropriate: early lessons should be simple and concrete, middle lessons should add tools and patterns, later lessons should combine ideas and use more complex examples.
- Structure math lessons with these Markdown headings in this order:
  1. The Core Concept - explain what the concept is in plain English and include the actual mathematical rules.
  2. The Real-Life Anchor - give a concrete scenario such as cooking, scaling a business, splitting a bill, shopping, measuring, risk, or data.
  3. Step-by-Step Walkthrough - solve one specific numerical problem and show the exact math steps.
  4. Practice Before Answers - tell the student to try the practice problems below before opening answers.
- For non-math lessons, still use concrete teaching sections, specific examples, and real application tasks.
- Teach the specific skill named in the lesson title. Do not drift back to the general topic unless it directly supports this lesson.
- Include 3-5 key terms, 1-3 formulas for math lessons (empty only for truly non-formula topics), 2 real-life examples, and 3 practice problems for math lessons from easy to hard.
- Put practice problem solutions only in the steps and final_answer fields, not inside the explanation. The UI hides those answers.
- Add exactly one checkpoint_question that tests only this lesson's subtopic. It must be multiple choice with exactly 4 options. The correct_answer must exactly match one option.
- For math checkpoints, ask the student to calculate, simplify, choose the correct equation, interpret a numerical result, or identify the correct next step in a calculation.
- If the student answers the checkpoint wrong, the app may ask for another checkpoint, so make the question clear and focused.
- For each formula, include variables and a worked_example written in Markdown. Use numbered steps for worked examples.
- For each practice_problem, provide steps as an array and final_answer as a separate string.
- Use Markdown formatting inside explanation, formula explanations, worked_example, practice problem text, steps, and final_answer.
- For math, use proper superscript characters for powers, such as x², y³, 10⁵, and 5x⁴. Never use the caret symbol for exponents.
- Do not write long unformatted sequences like "First... Next... Now..." as one paragraph; use Markdown numbered lists or bullets instead.
- ${langInstruction(data.language)}`;
    try {
      const raw: any = await callGroqJson({
        prompt,
        temperature: 0.65,
        maxTokens: 5000,
        timeoutMs: 35000,
        retryCount: 1,
        queued: false,
      });
      const wrapped = sanitizeCourse({
        course_title: "x",
        lessons: [{ ...raw, lesson_number: data.lessonNumber, title: data.lessonTitle }],
      });
      const lesson = wrapped?.lessons?.[0];
      if (!lesson) throw new Error("Invalid lesson response");
      if (!lesson.checkpoint_question) {
        lesson.checkpoint_question = fallbackCheckpointQuestion(data);
      }
      if (isWeakMathLesson(lesson, data.topic)) {
        throw new Error("Weak math lesson response");
      }
      return { lesson };
    } catch (error) {
      console.error(`generateCourseLesson(${data.lessonNumber}) failed:`, error);
      return { lesson: fallbackLesson(data) };
    }
  });

export const generateLessonCheckpoint = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      topic: string;
      lessonNumber: number;
      lessonTitle: string;
      explanation?: string;
      terms?: { term: string; definition: string }[];
      language?: string;
    }) => {
      if (!input?.topic?.trim()) throw new Error("Topic required");
      const n = Number(input.lessonNumber);
      if (!Number.isFinite(n) || n < 1 || n > 10) throw new Error("Invalid lesson number");
      return {
        topic: input.topic.slice(0, 2000),
        lessonNumber: Math.floor(n),
        lessonTitle: String(input.lessonTitle || "").slice(0, 200),
        explanation: String(input.explanation || "").slice(0, 2500),
        terms: Array.isArray(input.terms)
          ? input.terms
              .filter(
                (term) =>
                  term && typeof term.term === "string" && typeof term.definition === "string",
              )
              .slice(0, 6)
          : [],
        language: normLang(input.language),
      };
    },
  )
  .handler(async ({ data }): Promise<{ question: LessonCheckpointQuestion; error?: string }> => {
    const terms = data.terms.length
      ? data.terms.map((term) => `- ${term.term}: ${term.definition}`).join("\n")
      : "(use the lesson title and explanation)";
    const prompt = `Create ONE new checkpoint question for lesson ${data.lessonNumber} of "${data.topic}".

Lesson title: "${data.lessonTitle}"

Lesson explanation:
${data.explanation || "(not provided)"}

Key terms:
${terms}

Return ONLY valid JSON:
{ "question": "...", "options": ["...", "...", "...", "..."], "correct_answer": "...", "explanation": "..." }

Rules:
- Test only this lesson's subtopic, not the whole course.
- Use exactly 4 plausible multiple-choice options.
- correct_answer must exactly match one option.
- Do not test whether the student can define learning, understanding, or the lesson title. Test the actual lesson skill.
- For math lessons, use a numerical calculation, equation, formula application, graph/data interpretation, or next-step-in-solution question.
- For math lessons, include enough numbers in the question so there is one objectively correct answer.
- Make the new question different from the obvious first question a student may have just missed.
- For math, use proper superscript characters for powers, such as x², y³, 10⁵, and 5x⁴. Never use the caret symbol for exponents.
- ${langInstruction(data.language)}`;
    try {
      const raw = await callGroqJson({
        prompt,
        temperature: 0.75,
        maxTokens: 900,
        timeoutMs: 20000,
        retryCount: 1,
        queued: false,
      });
      const question = sanitizeCheckpointQuestion(raw, data.lessonNumber);
      if (!question) throw new Error("Invalid checkpoint response");
      return { question };
    } catch (error) {
      console.error(`generateLessonCheckpoint(${data.lessonNumber}) failed:`, error);
      return { question: fallbackCheckpointQuestion(data) };
    }
  });
