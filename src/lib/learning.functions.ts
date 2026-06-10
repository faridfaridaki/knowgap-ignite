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
  if (/(mental|estimation|shortcut)/i.test(title)) {
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
  if (/(logic|truth|table|argument)/i.test(title)) {
    return make(
      "A rule says: access is allowed if age > 18 AND pass = yes. Age is 20 and pass = no. Is access allowed?",
      "No",
      ["Yes", "Only if age is 21", "Only if pass is maybe"],
      "The age condition is true, but pass = yes is false. AND needs both conditions true.",
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

  const makeMathLesson = (spec: {
    explanation: string[];
    terms: { term: string; definition: string }[];
    formulas: CourseFormula[];
    real_life_examples: string[];
    practice_problems: CoursePracticeProblem[];
  }): CourseLesson => ({
    lesson_number: data.lessonNumber,
    title,
    format_version: COURSE_LESSON_FORMAT_VERSION,
    explanation: spec.explanation.join("\n\n"),
    terms: spec.terms,
    formulas: spec.formulas,
    real_life_examples: spec.real_life_examples,
    practice_problems: spec.practice_problems,
    checkpoint_question: fallbackMathCheckpointQuestion(data),
    has_problems: true,
  });

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

  if (/(mental|estimation|shortcut)/i.test(normalizedTitle)) {
    return makeMathLesson({
      explanation: [
        "## The Core Concept",
        "Mental math is the skill of changing a calculation into easier pieces while keeping control of the value. The main tools are rounding, compensation, splitting numbers, and scaling.",
        "The distributive rule lets you split multiplication: a × (b + c) = a × b + a × c. Compensation means if you round one number up, you subtract the extra amount later.",
        "## The Real-Life Anchor",
        "Imagine checking a grocery cart before paying. If items cost $19, $31, and $48, you can estimate $20 + $30 + $50 = $100 and immediately know whether the final bill is reasonable.",
        "## Step-by-Step Walkthrough",
        "Problem: Calculate 19 × 51 in your head.",
        "1. Change 19 into 20 - 1.",
        "2. Multiply the easy part: 20 × 51 = 1,020.",
        "3. Subtract the extra group of 51: 1,020 - 51 = 969.",
        "Answer: 19 × 51 = 969.",
        "## Practice Before Answers",
        "Try these without a calculator first. Use rounding, splitting, or compensation.",
      ],
      terms: [
        { term: "Estimation", definition: "Finding a close answer quickly to check size." },
        {
          term: "Compensation",
          definition: "Adjusting after rounding so the final answer stays correct.",
        },
        {
          term: "Distributive rule",
          definition: "Splitting multiplication across addition or subtraction.",
        },
      ],
      formulas: [
        {
          formula: "a × (b + c) = a × b + a × c",
          variables: [
            { symbol: "a", meaning: "The number multiplying the grouped terms" },
            { symbol: "b, c", meaning: "The pieces inside the group" },
          ],
          worked_example: "6 × 47 = 6 × (40 + 7) = 240 + 42 = 282.",
          explanation: "Split an awkward number into friendly parts, multiply each part, then add.",
        },
        {
          formula: "(a - 1) × b = a × b - b",
          variables: [
            { symbol: "a", meaning: "The rounded-up friendly number" },
            { symbol: "b", meaning: "The other factor" },
          ],
          worked_example: "19 × 51 = 20 × 51 - 51 = 1,020 - 51 = 969.",
          explanation: "Round up to an easy number, then remove the extra group.",
        },
      ],
      real_life_examples: [
        "Shopping: estimate $19 + $31 + $48 as about $100 before checkout.",
        "Inventory: estimate 48 boxes with 21 items each as about 50 × 20 = 1,000 items.",
      ],
      practice_problems: [
        {
          problem: "Easy: Calculate 6 × 47 using splitting.",
          steps: [
            "Split 47 into 40 + 7.",
            "Calculate 6 × 40 = 240.",
            "Calculate 6 × 7 = 42.",
            "Add: 240 + 42 = 282.",
          ],
          final_answer: "282.",
        },
        {
          problem: "Medium: Calculate 29 × 12 using compensation.",
          steps: [
            "Change 29 into 30 - 1.",
            "Calculate 30 × 12 = 360.",
            "Subtract 1 × 12 = 12.",
            "Calculate 360 - 12 = 348.",
          ],
          final_answer: "348.",
        },
        {
          problem: "Hard: Estimate 198 × 51, then calculate it exactly.",
          steps: [
            "Estimate with 200 × 50 = 10,000.",
            "Exact: 198 × 51 = 198 × (50 + 1).",
            "Calculate 198 × 50 = 9,900.",
            "Add 198: 9,900 + 198 = 10,098.",
          ],
          final_answer: "Estimate about 10,000; exact answer 10,098.",
        },
      ],
    });
  }

  if (/(algebra|unknown|variable|equation)/i.test(normalizedTitle)) {
    return makeMathLesson({
      explanation: [
        "## The Core Concept",
        "Algebra finds unknown numbers by keeping both sides of an equation balanced. A variable, such as x, stands for the number you do not know yet.",
        "The main rule is: whatever you do to one side of an equation, you must do to the other side. Use inverse operations to undo the equation step by step.",
        "## The Real-Life Anchor",
        "Imagine a gym charges a $10 sign-up fee plus $8 per class. If the total is $58, algebra tells you how many classes were taken instead of guessing.",
        "## Step-by-Step Walkthrough",
        "Problem: Solve 8x + 10 = 58.",
        "1. Subtract 10 from both sides: 8x = 48.",
        "2. Divide both sides by 8: x = 6.",
        "3. Check: 8 × 6 + 10 = 58.",
        "Answer: x = 6 classes.",
        "## Practice Before Answers",
        "Solve each equation by undoing operations in reverse order.",
      ],
      terms: [
        { term: "Variable", definition: "A symbol that represents an unknown or changing number." },
        { term: "Equation", definition: "A statement that two expressions have equal value." },
        { term: "Inverse operation", definition: "An operation that undoes another operation." },
      ],
      formulas: [
        {
          formula: "ax + b = c → x = (c - b) / a",
          variables: [
            { symbol: "a", meaning: "The multiplier attached to x" },
            { symbol: "b", meaning: "The amount added or subtracted" },
            { symbol: "c", meaning: "The total value" },
          ],
          worked_example: "3x + 6 = 24 → 3x = 18 → x = 6.",
          explanation: "Remove the added amount first, then divide by the multiplier.",
        },
      ],
      real_life_examples: [
        "Budgeting: if a phone plan costs $15 plus $5 per GB and the bill is $45, solve 15 + 5x = 45.",
        "Tickets: if 4 tickets plus a $6 fee cost $54, solve 4x + 6 = 54 to find one ticket price.",
      ],
      practice_problems: [
        {
          problem: "Easy: Solve x + 7 = 19.",
          steps: ["Subtract 7 from both sides.", "x = 19 - 7.", "x = 12."],
          final_answer: "x = 12.",
        },
        {
          problem: "Medium: Solve 5x - 4 = 31.",
          steps: ["Add 4 to both sides: 5x = 35.", "Divide by 5: x = 7.", "Check: 5 × 7 - 4 = 31."],
          final_answer: "x = 7.",
        },
        {
          problem:
            "Hard: A taxi charges $4 plus $2 per mile. The total fare is $26. How many miles was the trip?",
          steps: [
            "Write the equation: 4 + 2x = 26.",
            "Subtract 4: 2x = 22.",
            "Divide by 2: x = 11.",
          ],
          final_answer: "11 miles.",
        },
      ],
    });
  }

  if (/(geometry|area|volume|space)/i.test(normalizedTitle)) {
    return makeMathLesson({
      explanation: [
        "## The Core Concept",
        "Geometry measures shapes. Area measures flat space inside a shape, perimeter measures distance around it, and volume measures the space inside a 3D object.",
        "Always track units: area uses square units, and volume uses cubic units.",
        "## The Real-Life Anchor",
        "Imagine painting a wall or packing a box. You need area to buy enough paint and volume to know how much space fits inside the box.",
        "## Step-by-Step Walkthrough",
        "Problem: A rectangular garden is 12 meters long and 5 meters wide. Find its area and perimeter.",
        "1. Area = length × width = 12 × 5 = 60.",
        "2. Perimeter = 2 × (length + width) = 2 × (12 + 5).",
        "3. Simplify: 2 × 17 = 34.",
        "Answer: area is 60 square meters, perimeter is 34 meters.",
        "## Practice Before Answers",
        "Watch the units carefully: square units for area, cubic units for volume.",
      ],
      terms: [
        { term: "Area", definition: "The amount of flat space inside a 2D shape." },
        { term: "Perimeter", definition: "The distance around the outside of a 2D shape." },
        { term: "Volume", definition: "The amount of 3D space inside an object." },
      ],
      formulas: [
        {
          formula: "rectangle area = length × width",
          variables: [
            { symbol: "length", meaning: "The longer side of the rectangle" },
            { symbol: "width", meaning: "The shorter side of the rectangle" },
          ],
          worked_example: "Area = 12 × 5 = 60 square meters.",
          explanation: "Multiply the two side lengths to count the square units inside.",
        },
        {
          formula: "rectangular prism volume = length × width × height",
          variables: [{ symbol: "height", meaning: "How tall the prism is" }],
          worked_example: "Volume = 4 × 3 × 2 = 24 cubic units.",
          explanation: "Volume stacks layers of area upward.",
        },
      ],
      real_life_examples: [
        "Painting: calculate wall area to know how much paint to buy.",
        "Storage: calculate box volume to know whether items will fit.",
      ],
      practice_problems: [
        {
          problem: "Easy: A rectangle is 8 cm long and 3 cm wide. Find its area.",
          steps: ["Use area = length × width.", "Area = 8 × 3.", "Area = 24."],
          final_answer: "24 square centimeters.",
        },
        {
          problem: "Medium: A rectangle is 10 m long and 6 m wide. Find its perimeter.",
          steps: [
            "Use perimeter = 2 × (length + width).",
            "Perimeter = 2 × (10 + 6).",
            "Perimeter = 2 × 16 = 32.",
          ],
          final_answer: "32 meters.",
        },
        {
          problem: "Hard: A box is 5 ft long, 4 ft wide, and 3 ft tall. Find its volume.",
          steps: ["Use volume = length × width × height.", "Volume = 5 × 4 × 3.", "Volume = 60."],
          final_answer: "60 cubic feet.",
        },
      ],
    });
  }

  if (/(exponent|growth|large number)/i.test(normalizedTitle)) {
    return makeMathLesson({
      explanation: [
        "## The Core Concept",
        "An exponent tells you how many times to multiply a number by itself. For example, 2³ means 2 × 2 × 2, which equals 8.",
        "Exponents are used for repeated growth, powers of 10, scientific notation, and compound interest.",
        "## The Real-Life Anchor",
        "Imagine a video is shared by 3 people, and each person shares it with 3 more people. The number can grow very fast because multiplication repeats each round.",
        "## Step-by-Step Walkthrough",
        "Problem: A value doubles every day. It starts at 5 on day 0. What is it after 4 days?",
        "1. Doubling means multiply by 2 each day.",
        "2. After 4 days, use 5 × 2⁴.",
        "3. Calculate 2⁴ = 2 × 2 × 2 × 2 = 16.",
        "4. Multiply: 5 × 16 = 80.",
        "Answer: the value is 80.",
        "## Practice Before Answers",
        "Expand the exponent first, then multiply carefully.",
      ],
      terms: [
        { term: "Base", definition: "The number being repeatedly multiplied." },
        {
          term: "Exponent",
          definition: "The small raised number showing how many times to multiply.",
        },
        {
          term: "Exponential growth",
          definition: "Growth by repeated multiplication instead of repeated addition.",
        },
      ],
      formulas: [
        {
          formula: "aⁿ = a multiplied by itself n times",
          variables: [
            { symbol: "a", meaning: "The base" },
            { symbol: "n", meaning: "The exponent" },
          ],
          worked_example: "3⁴ = 3 × 3 × 3 × 3 = 81.",
          explanation: "The exponent controls how many copies of the base are multiplied.",
        },
        {
          formula: "new value = starting value × growth factorⁿ",
          variables: [{ symbol: "n", meaning: "The number of growth periods" }],
          worked_example: "5 × 2⁴ = 5 × 16 = 80.",
          explanation: "Repeated growth uses the same multiplier again and again.",
        },
      ],
      real_life_examples: [
        "Population growth: bacteria doubling every hour follows exponential growth.",
        "Technology: file sizes and memory often use powers of 2 or powers of 10.",
      ],
      practice_problems: [
        {
          problem: "Easy: Calculate 4³.",
          steps: ["Expand: 4³ = 4 × 4 × 4.", "Calculate 4 × 4 = 16.", "Calculate 16 × 4 = 64."],
          final_answer: "64.",
        },
        {
          problem: "Medium: A value starts at 7 and doubles for 3 rounds. What is the final value?",
          steps: ["Use 7 × 2³.", "Calculate 2³ = 8.", "Multiply 7 × 8 = 56."],
          final_answer: "56.",
        },
        {
          problem: "Hard: Write 60,000 using scientific notation.",
          steps: [
            "Move the decimal so the first number is between 1 and 10: 6.0.",
            "Count 4 decimal moves.",
            "Use 10⁴.",
          ],
          final_answer: "6 × 10⁴.",
        },
      ],
    });
  }

  if (/(probability|odds|risk)/i.test(normalizedTitle)) {
    return makeMathLesson({
      explanation: [
        "## The Core Concept",
        "Probability measures how likely something is. It is written as favorable outcomes divided by total possible outcomes.",
        "A probability of 0 means impossible, 1 means certain, and values between 0 and 1 describe uncertainty.",
        "## The Real-Life Anchor",
        "Imagine choosing a marble from a bag without looking. Probability tells you how likely each color is before you pick.",
        "## Step-by-Step Walkthrough",
        "Problem: A bag has 3 red marbles, 5 blue marbles, and 2 green marbles. What is the probability of red?",
        "1. Count favorable outcomes: 3 red marbles.",
        "2. Count total outcomes: 3 + 5 + 2 = 10 marbles.",
        "3. Write the probability: 3/10.",
        "Answer: probability of red is 3/10, or 30%.",
        "## Practice Before Answers",
        "Always count the favorable outcomes and total outcomes before calculating.",
      ],
      terms: [
        { term: "Outcome", definition: "One possible result of an event." },
        {
          term: "Favorable outcome",
          definition: "A result that matches what you are looking for.",
        },
        { term: "Probability", definition: "Favorable outcomes divided by total outcomes." },
      ],
      formulas: [
        {
          formula: "probability = favorable outcomes / total outcomes",
          variables: [
            { symbol: "favorable outcomes", meaning: "The outcomes that count as success" },
            { symbol: "total outcomes", meaning: "All possible outcomes" },
          ],
          worked_example: "3 red out of 10 total gives probability 3/10.",
          explanation: "Probability compares the target outcomes to all possible outcomes.",
        },
      ],
      real_life_examples: [
        "Weather: a 30% chance of rain means rain is possible but not more likely than no rain.",
        "Games: dice and cards use probability to measure risk and expected outcomes.",
      ],
      practice_problems: [
        {
          problem: "Easy: A coin has 2 sides. What is the probability of heads?",
          steps: ["Favorable outcomes: 1 head.", "Total outcomes: 2 sides.", "Probability = 1/2."],
          final_answer: "1/2 or 50%.",
        },
        {
          problem:
            "Medium: A die has numbers 1 to 6. What is the probability of rolling an even number?",
          steps: [
            "Even outcomes: 2, 4, 6.",
            "There are 3 favorable outcomes.",
            "Total outcomes: 6.",
            "Probability = 3/6 = 1/2.",
          ],
          final_answer: "1/2 or 50%.",
        },
        {
          problem:
            "Hard: A bag has 4 red, 6 blue, and 10 yellow tokens. What is the probability of not picking yellow?",
          steps: [
            "Not yellow means red or blue: 4 + 6 = 10.",
            "Total tokens: 4 + 6 + 10 = 20.",
            "Probability = 10/20 = 1/2.",
          ],
          final_answer: "1/2 or 50%.",
        },
      ],
    });
  }

  if (/(data|average|median|graph)/i.test(normalizedTitle)) {
    return makeMathLesson({
      explanation: [
        "## The Core Concept",
        "Data is information you can measure or count. Mean, median, and range summarize a list of numbers, but each tells a different story.",
        "The mean is the arithmetic average. The median is the middle value after sorting. The range is the largest value minus the smallest value.",
        "## The Real-Life Anchor",
        "Imagine comparing test scores. One very high or very low score can pull the mean, while the median shows the middle student more directly.",
        "## Step-by-Step Walkthrough",
        "Problem: Find the mean and median of 4, 7, 9, 10, and 20.",
        "1. Mean: add the values: 4 + 7 + 9 + 10 + 20 = 50.",
        "2. Divide by count: 50 / 5 = 10.",
        "3. Median: the list is already sorted, and the middle value is 9.",
        "Answer: mean is 10, median is 9.",
        "## Practice Before Answers",
        "Sort the data before finding the median. Add carefully before finding the mean.",
      ],
      terms: [
        { term: "Mean", definition: "The sum of values divided by the number of values." },
        { term: "Median", definition: "The middle value after the data is sorted." },
        { term: "Range", definition: "The largest value minus the smallest value." },
      ],
      formulas: [
        {
          formula: "mean = sum of values / number of values",
          variables: [
            { symbol: "sum of values", meaning: "All data values added together" },
            { symbol: "number of values", meaning: "How many data points are in the list" },
          ],
          worked_example: "For 4, 7, 9, 10, 20: mean = 50 / 5 = 10.",
          explanation: "Mean balances the whole data set into one average value.",
        },
        {
          formula: "range = largest value - smallest value",
          variables: [
            { symbol: "largest value", meaning: "The maximum data value" },
            { symbol: "smallest value", meaning: "The minimum data value" },
          ],
          worked_example: "Range = 20 - 4 = 16.",
          explanation: "Range measures spread.",
        },
      ],
      real_life_examples: [
        "Grades: mean score shows class average, while median score shows the middle result.",
        "Business: a few huge purchases can make average spending look higher than typical spending.",
      ],
      practice_problems: [
        {
          problem: "Easy: Find the mean of 2, 4, and 9.",
          steps: ["Add: 2 + 4 + 9 = 15.", "Count: 3 values.", "Divide: 15 / 3 = 5."],
          final_answer: "Mean = 5.",
        },
        {
          problem: "Medium: Find the median of 12, 5, 9, 20, and 7.",
          steps: ["Sort: 5, 7, 9, 12, 20.", "Find the middle value.", "The middle value is 9."],
          final_answer: "Median = 9.",
        },
        {
          problem: "Hard: For 6, 8, 8, 10, 18, find the mean, median, and range.",
          steps: [
            "Mean: 6 + 8 + 8 + 10 + 18 = 50, then 50 / 5 = 10.",
            "Median: middle value is 8.",
            "Range: 18 - 6 = 12.",
          ],
          final_answer: "Mean = 10, median = 8, range = 12.",
        },
      ],
    });
  }

  if (/(logic|truth|table|argument)/i.test(normalizedTitle)) {
    return makeMathLesson({
      explanation: [
        "## The Core Concept",
        "Logic studies whether statements are true or false and how statements combine. A truth table lists every possible true/false case so you can check a rule without guessing.",
        "For AND, the combined statement is true only when both parts are true. For OR, the combined statement is true when at least one part is true.",
        "## The Real-Life Anchor",
        "Imagine an app discount rule: a customer gets free shipping if the order is over $50 AND the account is verified. Both conditions must be true.",
        "## Step-by-Step Walkthrough",
        "Problem: A discount applies if price > 50 AND coupon = yes. Does it apply when price = 60 and coupon = no?",
        "1. Check condition A: price > 50 is true because 60 > 50.",
        "2. Check condition B: coupon = yes is false because coupon = no.",
        "3. AND needs both true, but one condition is false.",
        "Answer: the discount does not apply.",
        "## Practice Before Answers",
        "Evaluate each condition separately first, then apply AND or OR.",
      ],
      terms: [
        { term: "Statement", definition: "A sentence or condition that can be true or false." },
        {
          term: "AND",
          definition: "A logical connector that is true only when both parts are true.",
        },
        {
          term: "OR",
          definition: "A logical connector that is true when at least one part is true.",
        },
      ],
      formulas: [
        {
          formula: "A AND B is true only if A = true and B = true",
          variables: [
            { symbol: "A", meaning: "The first condition" },
            { symbol: "B", meaning: "The second condition" },
          ],
          worked_example: "60 > 50 is true, coupon = yes is false, so true AND false = false.",
          explanation: "AND is strict because every condition must pass.",
        },
        {
          formula: "A OR B is true if at least one condition is true",
          variables: [{ symbol: "A, B", meaning: "Two logical conditions" }],
          worked_example: "age > 18 is true OR member = yes is false gives true.",
          explanation: "OR passes when at least one condition passes.",
        },
      ],
      real_life_examples: [
        "Programming: login works if email is correct AND password is correct.",
        "Rules: entry is allowed if age is over 18 OR a guardian is present.",
      ],
      practice_problems: [
        {
          problem: "Easy: A = true and B = false. What is A AND B?",
          steps: ["AND requires both values to be true.", "B is false.", "So A AND B is false."],
          final_answer: "False.",
        },
        {
          problem: "Medium: A = false and B = true. What is A OR B?",
          steps: ["OR requires at least one true value.", "B is true.", "So A OR B is true."],
          final_answer: "True.",
        },
        {
          problem:
            "Hard: A store gives a discount if total > 100 OR member = yes. Total is 80 and member = yes. Does the discount apply?",
          steps: [
            "Check total > 100: 80 > 100 is false.",
            "Check member = yes: true.",
            "OR needs at least one true condition.",
          ],
          final_answer: "Yes, the discount applies.",
        },
      ],
    });
  }

  if (/(financial|interest|loan|inflation)/i.test(normalizedTitle)) {
    return makeMathLesson({
      explanation: [
        "## The Core Concept",
        "Financial math uses percentages to measure money changing over time. Interest is money paid for borrowing or earned for saving. Inflation means prices rise, so the same money buys less.",
        "Simple interest grows only on the original amount. Compound interest grows on the original amount plus previous interest.",
        "## The Real-Life Anchor",
        "Imagine putting $500 in a savings account at 6% annual interest. Financial math tells you how much extra money you earn and whether inflation reduces its real value.",
        "## Step-by-Step Walkthrough",
        "Problem: Find the simple interest on $500 at 6% for 2 years.",
        "1. Convert 6% to 0.06.",
        "2. Use interest = principal × rate × time.",
        "3. Calculate 500 × 0.06 × 2 = 60.",
        "Answer: the interest is $60, so the final amount is $560.",
        "## Practice Before Answers",
        "Convert percentages to decimals before multiplying.",
      ],
      terms: [
        { term: "Principal", definition: "The starting amount of money." },
        { term: "Interest rate", definition: "The percent charged or earned over a period." },
        { term: "Inflation", definition: "A rise in prices that reduces buying power." },
      ],
      formulas: [
        {
          formula: "simple interest = principal × rate × time",
          variables: [
            { symbol: "principal", meaning: "Starting money amount" },
            { symbol: "rate", meaning: "Interest rate as a decimal" },
            { symbol: "time", meaning: "Number of time periods" },
          ],
          worked_example: "500 × 0.06 × 2 = 60.",
          explanation: "Simple interest applies the rate to the original amount only.",
        },
        {
          formula: "final amount = principal × (1 + rate)ⁿ",
          variables: [{ symbol: "n", meaning: "Number of compounding periods" }],
          worked_example: "100 × (1 + 0.10)² = 100 × 1.21 = 121.",
          explanation: "Compound interest applies growth repeatedly.",
        },
      ],
      real_life_examples: [
        "Loans: a higher interest rate means borrowing costs more.",
        "Savings: compound interest helps money grow faster over longer periods.",
      ],
      practice_problems: [
        {
          problem: "Easy: What is 10% simple interest on $200 for 1 year?",
          steps: ["Convert 10% to 0.10.", "Use 200 × 0.10 × 1.", "Calculate 20."],
          final_answer: "$20 interest.",
        },
        {
          problem: "Medium: Find the final amount for $300 at 5% simple interest for 2 years.",
          steps: ["Interest = 300 × 0.05 × 2.", "Interest = 30.", "Final amount = 300 + 30."],
          final_answer: "$330.",
        },
        {
          problem:
            "Hard: $100 grows by 10% each year for 2 years. What is the compound final amount?",
          steps: [
            "Use 100 × (1 + 0.10)².",
            "Calculate 1.10² = 1.21.",
            "Calculate 100 × 1.21 = 121.",
          ],
          final_answer: "$121.",
        },
      ],
    });
  }

  if (/(problem|framework|strategy|unfamiliar)/i.test(normalizedTitle)) {
    return makeMathLesson({
      explanation: [
        "## The Core Concept",
        "Problem-solving frameworks help you turn an unfamiliar math problem into clear moves. You identify what is known, define the unknown, choose a rule, solve, and check.",
        "A strong framework prevents random guessing because every step has a job.",
        "## The Real-Life Anchor",
        "Imagine planning a school event with a fixed budget. You need to combine prices, quantities, and constraints without losing track of what the question asks.",
        "## Step-by-Step Walkthrough",
        "Problem: You have $120. Tickets cost $15 each, and snacks cost $30 total. How many tickets can you buy?",
        "1. Subtract the fixed snack cost: 120 - 30 = 90.",
        "2. Divide the remaining budget by ticket price: 90 / 15 = 6.",
        "3. Check: 6 tickets cost 6 × 15 = 90, plus $30 snacks gives $120.",
        "Answer: you can buy 6 tickets.",
        "## Practice Before Answers",
        "For each problem, write what is known, what is unknown, and which operation connects them.",
      ],
      terms: [
        { term: "Known value", definition: "A number or condition given directly in the problem." },
        { term: "Unknown value", definition: "The value the problem asks you to find." },
        { term: "Constraint", definition: "A limit or rule that the answer must satisfy." },
      ],
      formulas: [
        {
          formula: "remaining amount = total amount - fixed cost",
          variables: [
            { symbol: "total amount", meaning: "The full amount available" },
            { symbol: "fixed cost", meaning: "A cost that must be paid first" },
          ],
          worked_example: "120 - 30 = 90.",
          explanation: "Remove fixed costs before dividing the rest into equal parts.",
        },
        {
          formula: "number of items = remaining amount / cost per item",
          variables: [{ symbol: "cost per item", meaning: "The price of one repeated item" }],
          worked_example: "90 / 15 = 6 tickets.",
          explanation: "Division tells how many equal-cost items fit into the remaining amount.",
        },
      ],
      real_life_examples: [
        "Event planning: subtract venue cost before deciding how many guests fit the food budget.",
        "Shopping: subtract tax or delivery fee before calculating how many items you can buy.",
      ],
      practice_problems: [
        {
          problem:
            "Easy: You have $50. A delivery fee is $5. Each notebook costs $9. How many notebooks can you buy?",
          steps: ["Subtract the fee: 50 - 5 = 45.", "Divide by notebook cost: 45 / 9 = 5."],
          final_answer: "5 notebooks.",
        },
        {
          problem:
            "Medium: A class has $200. Bus rental costs $80, and each museum ticket costs $12. How many tickets can they buy?",
          steps: ["Subtract bus rental: 200 - 80 = 120.", "Divide by ticket cost: 120 / 12 = 10."],
          final_answer: "10 tickets.",
        },
        {
          problem:
            "Hard: You have $500. Equipment costs $140, and each participant costs $18. What is the maximum number of participants?",
          steps: [
            "Subtract equipment cost: 500 - 140 = 360.",
            "Divide by participant cost: 360 / 18 = 20.",
            "Check: 20 × 18 + 140 = 500.",
          ],
          final_answer: "20 participants.",
        },
      ],
    });
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
  if (!explanation.includes("practice before answers")) return true;
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
- Every math lesson must match the practical quality and structure of Lesson 1: direct concept explanation, actual rules/formulas, a real-world anchor, a solved numerical walkthrough, and 3 numerical practice problems. Do this for lesson ${data.lessonNumber}, not only for Lesson 1.
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
- Each math practice problem must be tied to this lesson's exact subtopic. For example, a probability lesson should ask probability problems, a geometry lesson should ask area/volume/perimeter problems, and an algebra lesson should ask equation-solving problems.
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
