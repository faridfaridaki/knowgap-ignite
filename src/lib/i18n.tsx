import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ru";

const STORAGE_KEY = "knowgap:lang";

const dict = {
  en: {
    // Header / nav
    signIn: "Sign In",
    signOut: "Sign out",
    dashboard: "Dashboard",
    home: "Home",
    back: "Back",
    backToDashboard: "← Back to Dashboard",
    homeConfirmTitle: "Go to home?",
    homeConfirmBody: "Are you sure you want to go home? Your current progress will be saved.",
    yesGoHome: "Yes, go home",
    cancel: "Cancel",
    legendCorrect: "Correct (1 pt)",
    legendHint: "Correct with hint (0.5 pt)",
    legendWrong: "Wrong (0 pt)",
    hintUsedShort: "Hint used",

    // Landing
    badge: "AI-Powered Learning",
    landingTitle1: "Learn anything.",
    landingTitle2: "Really understand it.",
    landingSubtitle:
      "Paste your notes or enter a topic. KnowGap finds what you're missing and teaches you through a personalized course.",
    landingPlaceholder: "e.g. 'The French Revolution' or paste your study notes here...",
    analyzeBtn: "Analyze My Understanding →",
    chip1: "Finds your blind spots",
    chip2: "Teaches a full course",
    chip3: "Adapts to your understanding",

    // Pre-test
    stage1: "Stage 1 · Pre-Test",
    preTestTitle: "Let's see what you already know",
    generatingPreTest: "Generating your personalized test...",
    generatingPreTestSub: "Crafting 5 questions tailored to this topic.",

    // Pre-test results
    stage2: "Stage 2 · Results",
    youGot: "You got",
    outOf: "out of",
    correct: "correct",
    dontWorry: "Don't worry — that's exactly what we're going to fix.",
    startLearning: "Start Learning →",
    yourAnswer: "Your answer:",
    correctLabel: "Correct:",

    // Course
    stage3: "Stage 3 · Course",
    buildingCourse: "Building your 10-lesson course...",
    buildingCourseSub: "This usually takes 5-10 seconds.",
    lessons: "Lessons",
    lesson: "Lesson",
    of: "of",
    completed: "completed",
    lessonsCompleted: "lessons completed",
    explanation: "Explanation",
    keyTerms: "Key Terms",
    formulas: "Formulas",
    realLifeExamples: "Real-Life Examples",
    practiceProblems: "Practice Problems",
    problem: "Problem",
    showAnswer: "Show Answer",
    hideAnswer: "Hide Answer",
    finalAnswer: "Final answer",
    stepByStep: "Step-by-step solution",
    previousLesson: "Previous Lesson",
    nextLesson: "Next Lesson",
    markComplete: "Mark as Complete",
    completedBtn: "Completed",
    lessonCheckpoint: "Lesson Checkpoint",
    checkpointIntro: "Answer this correctly to unlock the next lesson.",
    checkAnswer: "Check Answer",
    correctCheckpoint: "Correct — next lesson unlocked.",
    wrongCheckpoint: "Not quite. Here's a new question on the same lesson.",
    generatingNewQuestion: "Generating another question...",
    chooseAnswer: "Choose an answer first.",
    courseCompleteCta: "Course Complete! Take Final Test →",
    takeFinalTest: "Take Final Test →",

    // Final test
    stage5: "Stage 5 · Final Test",
    finalTestTitle: "Show what you learned",
    buildingFinalTest: "Building your final test...",
    buildingFinalTestSub: "Designing new questions on the same concepts.",
    submitFinalTest: "Submit Final Test",
    submitTest: "Submit Test",

    // Quiz player
    question: "Question",
    previous: "← Previous",
    next: "Next →",
    useHint: "Use Hint",
    hintUsedNote: "Hint used — correct answer worth 0.5 points",
    selectAnswerFirst: "Select an answer to continue",

    // Final analysis
    stage6: "Stage 6 · Final Analysis",
    yourReport: "Your learning report",
    scoreComparison: "Score Comparison",
    preTest: "Pre-Test",
    finalTest: "Final Test",
    conceptByConcept: "Concept-by-concept",
    conceptByConceptSub: "How you performed on each question across both tests.",
    needMoreWork: "Areas that need more work",
    noGaps: "No remaining gaps on this test — well done.",
    suggestedNext: "Suggested next topics",
    savingSession: "Saving session…",
    savedCloud: "✓ Saved to your account",
    savedLocal: "Saved locally (sign in to sync)",
    studyGaps: "Study these gaps",
    startNewTopic: "Start a new topic",
    viewDashboard: "View dashboard",
    restartTopic: "Restart this topic →",

    // Dashboard
    welcomeBack: "Welcome back",
    coursesCompleted: "Courses completed",
    lessonsDone: "Lessons done",
    avgImprovement: "Avg. improvement",
    myCourses: "My Courses",
    viewFullAnalysis: "View Full Analysis",
    retakeCourse: "Retake Course",
    recentActivity: "Recent Activity",
    focusAreas: "Focus areas",
    focusAreasSub: "Concepts you've gotten wrong across sessions.",
    suggestedForYou: "Suggested topics",
    noCoursesYet: "No courses yet. Start one below.",
    progress: "Progress",

    // Auth
    welcomeBackTitle: "Welcome back",
    createAccount: "Create your account",
    signInSub: "Sign in to save your learning sessions.",
    signUpSub: "Sign up to save and revisit your learning sessions.",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password",
    pleaseWait: "Please wait…",
    signUp: "Sign Up",
    newHere: "New here?",
    haveAccount: "Already have an account?",
    createAccountLink: "Create an account",
    signInInstead: "Sign in instead",
    continueWithGoogle: "Continue with Google",
    orDivider: "or",
    checkEmail: "Check your email to confirm your account, then sign in.",

    // Recent activity events
    activityCompletedLesson: "Completed lesson {n} of {topic}",
    activityScored: "Scored {score}/{total} on Final Test — {topic}",
    activityStarted: "Started learning {topic}",
  },
  ru: {
    signIn: "Войти",
    signOut: "Выйти",
    dashboard: "Панель",
    home: "Главная",
    back: "Назад",
    backToDashboard: "← На панель",
    homeConfirmTitle: "Вернуться на главную?",
    homeConfirmBody: "Точно вернуться на главную? Текущий прогресс будет сохранён.",
    yesGoHome: "Да, на главную",
    cancel: "Отмена",
    legendCorrect: "Верно (1 балл)",
    legendHint: "Верно с подсказкой (0.5 балла)",
    legendWrong: "Неверно (0 баллов)",
    hintUsedShort: "Использована подсказка",

    badge: "Обучение с ИИ",
    landingTitle1: "Изучи что угодно.",
    landingTitle2: "По-настоящему пойми это.",
    landingSubtitle:
      "Вставь конспект или введи тему. KnowGap найдёт пробелы и проведёт тебя через персональный курс.",
    landingPlaceholder: "Например: «Французская революция» или вставь свои заметки...",
    analyzeBtn: "Проанализировать мои знания →",
    chip1: "Находит пробелы",
    chip2: "Создаёт полный курс",
    chip3: "Подстраивается под тебя",

    stage1: "Этап 1 · Предварительный тест",
    preTestTitle: "Давай посмотрим, что ты уже знаешь",
    generatingPreTest: "Создаём твой персональный тест...",
    generatingPreTestSub: "Подбираем 5 вопросов по этой теме.",

    stage2: "Этап 2 · Результаты",
    youGot: "Ты ответил",
    outOf: "из",
    correct: "правильно",
    dontWorry: "Не волнуйся — мы это исправим.",
    startLearning: "Начать обучение →",
    yourAnswer: "Твой ответ:",
    correctLabel: "Правильно:",

    stage3: "Этап 3 · Курс",
    buildingCourse: "Создаём курс из 10 уроков...",
    buildingCourseSub: "Обычно занимает 5-10 секунд.",
    lessons: "Уроки",
    lesson: "Урок",
    of: "из",
    completed: "пройдено",
    lessonsCompleted: "уроков пройдено",
    explanation: "Объяснение",
    keyTerms: "Ключевые термины",
    formulas: "Формулы",
    realLifeExamples: "Примеры из жизни",
    practiceProblems: "Практические задачи",
    problem: "Задача",
    showAnswer: "Показать ответ",
    hideAnswer: "Скрыть ответ",
    finalAnswer: "Итоговый ответ",
    stepByStep: "Пошаговое решение",
    previousLesson: "Предыдущий урок",
    nextLesson: "Следующий урок",
    markComplete: "Отметить пройденным",
    completedBtn: "Пройдено",
    lessonCheckpoint: "Проверка урока",
    checkpointIntro: "Ответь правильно, чтобы открыть следующий урок.",
    checkAnswer: "Проверить ответ",
    correctCheckpoint: "Правильно — следующий урок открыт.",
    wrongCheckpoint: "Пока нет. Вот новый вопрос по этому же уроку.",
    generatingNewQuestion: "Создаём новый вопрос...",
    chooseAnswer: "Сначала выбери ответ.",
    courseCompleteCta: "Курс завершён! К финальному тесту →",
    takeFinalTest: "Финальный тест →",

    stage5: "Этап 5 · Финальный тест",
    finalTestTitle: "Покажи, чему научился",
    buildingFinalTest: "Готовим финальный тест...",
    buildingFinalTestSub: "Составляем новые вопросы по тем же темам.",
    submitFinalTest: "Отправить финальный тест",
    submitTest: "Отправить тест",

    question: "Вопрос",
    previous: "← Назад",
    next: "Далее →",
    useHint: "Подсказка",
    hintUsedNote: "Подсказка использована — правильный ответ даёт 0.5 балла",
    selectAnswerFirst: "Выбери ответ, чтобы продолжить",

    stage6: "Этап 6 · Финальный анализ",
    yourReport: "Твой отчёт обучения",
    scoreComparison: "Сравнение результатов",
    preTest: "Предтест",
    finalTest: "Финальный тест",
    conceptByConcept: "По концепциям",
    conceptByConceptSub: "Как ты справился с каждым вопросом в обоих тестах.",
    needMoreWork: "Что требует ещё работы",
    noGaps: "Пробелов больше нет — отлично!",
    suggestedNext: "Что изучить дальше",
    savingSession: "Сохраняем сессию…",
    savedCloud: "✓ Сохранено в аккаунте",
    savedLocal: "Сохранено локально (войди, чтобы синхронизировать)",
    studyGaps: "Проработать пробелы",
    startNewTopic: "Новая тема",
    viewDashboard: "Открыть панель",
    restartTopic: "Пройти заново →",

    welcomeBack: "С возвращением",
    coursesCompleted: "Курсов пройдено",
    lessonsDone: "Уроков сделано",
    avgImprovement: "Средний прогресс",
    myCourses: "Мои курсы",
    viewFullAnalysis: "Полный анализ",
    retakeCourse: "Пройти заново",
    recentActivity: "Недавняя активность",
    focusAreas: "Слабые места",
    focusAreasSub: "Концепции, которые ты часто путаешь.",
    suggestedForYou: "Рекомендуемые темы",
    noCoursesYet: "Пока нет курсов. Начни первый ниже.",
    progress: "Прогресс",

    welcomeBackTitle: "С возвращением",
    createAccount: "Создать аккаунт",
    signInSub: "Войди, чтобы сохранять свои сессии обучения.",
    signUpSub: "Зарегистрируйся, чтобы сохранять и возвращаться к сессиям.",
    emailPlaceholder: "Эл. почта",
    passwordPlaceholder: "Пароль",
    pleaseWait: "Подожди…",
    signUp: "Зарегистрироваться",
    newHere: "Впервые здесь?",
    haveAccount: "Уже есть аккаунт?",
    createAccountLink: "Создать аккаунт",
    signInInstead: "Войти",
    continueWithGoogle: "Войти через Google",
    orDivider: "или",
    checkEmail: "Проверь почту, чтобы подтвердить аккаунт.",

    activityCompletedLesson: "Пройден урок {n} — {topic}",
    activityScored: "Результат {score}/{total} в финальном тесте — {topic}",
    activityStarted: "Начато изучение темы {topic}",
  },
} as const;

export type TKey = keyof typeof dict.en;

const I18nContext = createContext<{
  lang: Lang;
  hydrated: boolean;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}>({ lang: "en", hydrated: false, setLang: () => {}, t: (k) => String(k) });

function detectLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ru" || saved === "en") return saved;
  } catch {}
  try {
    const nav = navigator.language?.toLowerCase() ?? "";
    if (nav.startsWith("ru")) return "ru";
  } catch {}
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLangState(detectLang());
    setHydrated(true);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  };

  const t = (key: TKey, vars?: Record<string, string | number>): string => {
    let out: string = (dict[lang] as Record<string, string>)[key] ?? dict.en[key] ?? String(key);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return out;
  };

  return (
    <I18nContext.Provider value={{ lang, hydrated, setLang, t }}>{children}</I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}

export function getStoredLang(): Lang {
  return detectLang();
}

export function languageName(lang: Lang): string {
  return lang === "ru" ? "Russian" : "English";
}
