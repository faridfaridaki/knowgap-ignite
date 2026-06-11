import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lock, CheckCircle2, ChevronLeft, ChevronRight, PartyPopper, BookOpen } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { FullScreenLoader } from "@/components/FullScreenLoader";
import { AiErrorState } from "@/components/AiErrorState";
import { MarkdownText } from "@/components/MarkdownText";
import {
  generateCourse,
  generateCourseLesson,
  generateLessonCheckpoint,
} from "@/lib/learning.functions";
import {
  COURSE_LESSON_FORMAT_VERSION,
  loadState,
  patchState,
  isAnswerCorrect,
} from "@/lib/learning-state";
import type {
  Course,
  CourseLesson,
  CoursePracticeProblem,
  LearningState,
} from "@/lib/learning-state";
import { useT } from "@/lib/i18n";
import { friendlyAiError } from "@/lib/ai-error";
import { normalizeMathText } from "@/lib/math-format";

export const Route = createFileRoute("/course")({
  component: CourseRoute,
});

function CourseRoute() {
  const { t } = useT();
  return (
    <AuthGuard preserveTopicForAuth loadingTitle={t("pleaseWait")}>
      <CoursePage />
    </AuthGuard>
  );
}

function isPracticalLessonReady(lesson: CourseLesson | undefined): boolean {
  return Boolean(
    lesson &&
    lesson.explanation.trim().length > 0 &&
    lesson.format_version === COURSE_LESSON_FORMAT_VERSION,
  );
}

function CoursePage() {
  const navigate = useNavigate();
  const { t, lang, hydrated } = useT();
  const generate = useServerFn(generateCourse);
  const generateOneLesson = useServerFn(generateCourseLesson);
  const generateCheckpoint = useServerFn(generateLessonCheckpoint);
  const [state, setState] = useState<LearningState | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [currentLesson, setCurrentLesson] = useState(1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lessonLoading, setLessonLoading] = useState<number | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const generationInFlight = useRef(false);
  const lessonRequests = useRef<Set<number>>(new Set());

  // Refs mirror latest values so callbacks stay stable and don't recreate
  // (which previously caused an infinite useEffect loop).
  const courseRef = useRef<Course | null>(null);
  const stateRef = useRef<LearningState | null>(null);
  const sessionLangRef = useRef(lang);
  const wrongQuestionsRef = useRef<string[]>([]);

  useEffect(() => {
    courseRef.current = course;
  }, [course]);
  useEffect(() => {
    stateRef.current = state;
    wrongQuestionsRef.current = state
      ? state.preTestQuestions
          .filter((q, i) => !isAnswerCorrect(q, state.preTestAnswers[i] ?? ""))
          .map((q) => q.question)
      : [];
  }, [state]);
  useEffect(() => {
    if (state?.language) sessionLangRef.current = state.language;
  }, [state?.language]);

  // Stable: reads everything from refs.
  const loadLesson = useCallback(
    (n: number, courseOverride?: Course, topicOverride?: string) => {
      const activeCourse = courseOverride ?? courseRef.current;
      const topic = topicOverride ?? stateRef.current?.topic;
      if (!activeCourse || !topic) return;
      const target = activeCourse.lessons.find((l) => l.lesson_number === n);
      if (!target) return;
      if (isPracticalLessonReady(target)) return;
      if (lessonRequests.current.has(n)) return;
      lessonRequests.current.add(n);
      setLessonLoading((cur) => cur ?? n);
      setLessonError(null);
      const titles = activeCourse.lessons.map((l) => l.title);
      generateOneLesson({
        data: {
          topic,
          lessonNumber: n,
          lessonTitle: target.title,
          allTitles: titles,
          wrongQuestions: wrongQuestionsRef.current,
          language: sessionLangRef.current,
        },
      })
        .then((res) => {
          if (res.error || !res.lesson) {
            setLessonError(res.error ?? friendlyAiError(new Error("Lesson failed")));
            return;
          }
          setCourse((prev) => {
            if (!prev) return prev;
            const lessons = prev.lessons.map((l) => (l.lesson_number === n ? res.lesson! : l));
            const next = { ...prev, lessons };
            patchState({ course: next });
            return next;
          });
        })
        .catch((e) => {
          setLessonError(friendlyAiError(e));
        })
        .finally(() => {
          lessonRequests.current.delete(n);
          setLessonLoading((cur) => (cur === n ? null : cur));
        });
    },
    [generateOneLesson],
  );

  const loadCourse = useCallback(() => {
    if (!hydrated) return;
    setError(null);
    const s = loadState();
    if (!s || s.preTestQuestions.length === 0) {
      navigate({ to: "/" });
      return;
    }
    setState(s);
    sessionLangRef.current = s.language;
    const savedCompleted = s.completedLessons ?? [];
    const practicalCompleted = s.course?.lessons?.length
      ? savedCompleted.filter((lessonNumber) =>
          isPracticalLessonReady(s.course?.lessons.find((l) => l.lesson_number === lessonNumber)),
        )
      : savedCompleted;
    setCompleted(practicalCompleted);
    if (practicalCompleted.length !== savedCompleted.length) {
      patchState({ completedLessons: practicalCompleted });
    }
    const startAt = s.currentLesson || 1;
    setCurrentLesson(startAt);
    if (s.course && s.course.lessons?.length) {
      setCourse(s.course);
      const target = s.course.lessons.find((l) => l.lesson_number === startAt);
      if (!isPracticalLessonReady(target)) {
        loadLesson(startAt, s.course, s.topic);
      }
      return;
    }
    if (generationInFlight.current) return;
    generationInFlight.current = true;
    setCourse(null);
    const wrong = s.preTestQuestions
      .filter((q, i) => !isAnswerCorrect(q, s.preTestAnswers[i] ?? ""))
      .map((q) => q.question);
    generate({ data: { topic: s.topic, wrongQuestions: wrong, language: s.language } })
      .then((res) => {
        if (res.error || !res.course) {
          setError(res.error ?? friendlyAiError(new Error("AI response unavailable")));
          return;
        }
        patchState({ course: res.course });
        setCourse(res.course);
        loadLesson(startAt, res.course, s.topic);
      })
      .catch((e) => {
        setError(friendlyAiError(e));
      })
      .finally(() => {
        generationInFlight.current = false;
      });
  }, [navigate, hydrated, generate, loadLesson]);

  // Run once on hydration. Do NOT depend on loadCourse — that caused the
  // previous "Maximum update depth exceeded" loop.
  useEffect(() => {
    if (!hydrated) return;
    loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const lessons = useMemo(() => course?.lessons ?? [], [course]);
  const lesson: CourseLesson | undefined = useMemo(
    () => lessons.find((l) => l.lesson_number === currentLesson),
    [lessons, currentLesson],
  );

  const isUnlocked = (n: number) => n === 1 || completed.includes(n - 1);
  const isDone = (n: number) => completed.includes(n);
  const allDone = lessons.length > 0 && lessons.every((l) => completed.includes(l.lesson_number));

  const openLesson = (n: number) => {
    if (!isUnlocked(n)) return;
    setCurrentLesson(n);
    patchState({ currentLesson: n });
    loadLesson(n);
  };

  const markComplete = () => {
    if (!lesson) return;
    const next = completed.includes(lesson.lesson_number)
      ? completed
      : [...completed, lesson.lesson_number].sort((a, b) => a - b);
    setCompleted(next);
    const nextLesson = Math.min(lesson.lesson_number + 1, lessons.length);
    patchState({ completedLessons: next, currentLesson: nextLesson });
    if (lesson.lesson_number < lessons.length) {
      setCurrentLesson(nextLesson);
      loadLesson(nextLesson);
    }
  };

  const refreshCheckpoint = useCallback(
    async (targetLesson: CourseLesson) => {
      const topic = stateRef.current?.topic;
      if (!topic) return targetLesson.checkpoint_question;
      const res = await generateCheckpoint({
        data: {
          topic,
          lessonNumber: targetLesson.lesson_number,
          lessonTitle: targetLesson.title,
          explanation: targetLesson.explanation,
          terms: targetLesson.terms,
          language: sessionLangRef.current,
        },
      });
      const question = res.question;
      setCourse((prev) => {
        if (!prev) return prev;
        const lessons = prev.lessons.map((l) =>
          l.lesson_number === targetLesson.lesson_number
            ? { ...l, checkpoint_question: question }
            : l,
        );
        const next = { ...prev, lessons };
        patchState({ course: next });
        return next;
      });
      return question;
    },
    [generateCheckpoint],
  );

  const lessonReady = isPracticalLessonReady(lesson);
  const isLessonLoading = !!lesson && !lessonReady && lessonLoading === lesson.lesson_number;

  if (error) {
    return <AiErrorState message={error} onRetry={loadCourse} />;
  }

  if (!state || !course) {
    return <FullScreenLoader title={t("buildingCourse")} subtitle={t("buildingCourseSub")} />;
  }

  return (
    <main className="min-h-screen w-full bg-background relative animate-fade-in">
      <AppHeader />
      <div className="mx-auto w-full max-w-[1240px] px-4 pb-8 pt-24 sm:px-6 sm:py-8 lg:box-border lg:flex lg:h-screen lg:flex-col lg:overflow-hidden">
        <header className="mb-6 lg:shrink-0">
          <span className="inline-flex items-center rounded-full border border-[#7C6AF7]/40 bg-[#7C6AF7]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#7C6AF7]">
            {t("stage3")}
          </span>
          <h1 className="mt-3 text-xl font-bold leading-tight text-foreground sm:text-3xl">
            {course.course_title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {completed.length} {t("of")} {lessons.length} {t("lessonsCompleted")}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[300px_1fr] lg:gap-6">
          <aside className="rounded-2xl border border-surface-border bg-surface p-3 lg:min-h-0 lg:self-stretch lg:overflow-y-auto">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-2 flex items-center gap-2">
              <BookOpen size={13} /> {t("lessons")}
            </div>
            <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-1.5 lg:overflow-visible lg:px-0 lg:pb-0">
              {lessons.map((l) => {
                const unlocked = isUnlocked(l.lesson_number);
                const done = isDone(l.lesson_number);
                const active = currentLesson === l.lesson_number;
                return (
                  <li key={l.lesson_number} className="min-w-[220px] lg:min-w-0">
                    <button
                      type="button"
                      onClick={() => openLesson(l.lesson_number)}
                      disabled={!unlocked}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors lg:py-2.5 ${
                        active
                          ? "bg-[#7C6AF7]/15 border border-[#7C6AF7]/40"
                          : unlocked
                            ? "hover:bg-surface/70 border border-transparent"
                            : "opacity-50 cursor-not-allowed border border-transparent"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          done
                            ? "bg-emerald-500/20 text-emerald-300"
                            : active
                              ? "bg-[#7C6AF7] text-white"
                              : "bg-surface-border text-muted-foreground"
                        }`}
                      >
                        {done ? (
                          <CheckCircle2 size={15} />
                        ) : !unlocked ? (
                          <Lock size={13} />
                        ) : (
                          l.lesson_number
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {t("lesson")} {l.lesson_number}
                        </div>
                        <div className="truncate text-sm font-medium text-foreground">
                          {l.title}
                        </div>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {allDone && (
              <button
                type="button"
                onClick={() => navigate({ to: "/flashcards" })}
                className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
                style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }}
              >
                {t("practiceFlashcards")} →
              </button>
            )}
          </aside>

          <section className="lg:min-h-0 lg:overflow-y-auto lg:pr-2">
            {lesson ? (
              lessonReady ? (
                <LessonView
                  lesson={lesson}
                  total={lessons.length}
                  onPrev={() => openLesson(lesson.lesson_number - 1)}
                  onNext={() => openLesson(lesson.lesson_number + 1)}
                  onComplete={markComplete}
                  onRefreshCheckpoint={refreshCheckpoint}
                  isCompleted={isDone(lesson.lesson_number)}
                  allDone={allDone}
                  onFinalTest={() => navigate({ to: "/flashcards" })}
                />
              ) : lessonError ? (
                <div className="rounded-2xl border border-surface-border bg-surface p-6 text-center">
                  <p className="text-sm text-foreground">{lessonError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setLessonError(null);
                      loadLesson(lesson.lesson_number);
                    }}
                    className="mt-4 inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/90"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-surface-border bg-surface p-10 text-center animate-pulse">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("lesson")} {lesson.lesson_number}
                  </div>
                  <h2 className="mt-2 text-2xl font-bold text-foreground">{lesson.title}</h2>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {isLessonLoading ? t("buildingCourse") : t("preparingLesson")}
                  </p>
                </div>
              )
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function LessonView({
  lesson,
  total,
  onPrev,
  onNext,
  onComplete,
  onRefreshCheckpoint,
  isCompleted,
  allDone,
  onFinalTest,
}: {
  lesson: CourseLesson;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onComplete: () => void;
  onRefreshCheckpoint: (lesson: CourseLesson) => Promise<unknown>;
  isCompleted: boolean;
  allDone: boolean;
  onFinalTest: () => void;
}) {
  const { t } = useT();
  const isLast = lesson.lesson_number === total;
  const isFirst = lesson.lesson_number === 1;

  return (
    <article className="rounded-2xl border border-surface-border bg-surface p-4 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] animate-fade-in sm:p-9">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span className="uppercase tracking-wider font-semibold">
          {t("lesson")} {lesson.lesson_number} {t("of")} {total}
        </span>
        <span className="tabular-nums">{Math.round((lesson.lesson_number / total) * 100)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-background overflow-hidden mb-6">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${(lesson.lesson_number / total) * 100}%`,
            backgroundImage: "linear-gradient(90deg, #7C6AF7, #4FC4CF)",
          }}
        />
      </div>

      <h2 className="text-xl font-bold leading-tight text-foreground sm:text-3xl">
        {normalizeMathText(lesson.title)}
      </h2>

      <Section title={t("explanation")}>
        <MarkdownText
          text={lesson.explanation}
          className="prose-readable text-[15px] leading-[1.75] text-foreground sm:text-[15.5px]"
        />
      </Section>

      {lesson.terms.length > 0 && (
        <Section title={t("keyTerms")}>
          <div className="grid sm:grid-cols-2 gap-3">
            {lesson.terms.map((tm, i) => (
              <div key={i} className="rounded-xl border border-surface-border bg-background/40 p-4">
                <div className="text-sm font-semibold text-[#7C6AF7]">
                  {normalizeMathText(tm.term)}
                </div>
                <div className="mt-1 text-sm text-foreground leading-relaxed">
                  {normalizeMathText(tm.definition)}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {lesson.formulas.length > 0 && (
        <Section title={t("formulas")}>
          <div className="space-y-4">
            {lesson.formulas.map((f, i) => (
              <div
                key={i}
                className="rounded-xl border border-[#4FC4CF]/30 bg-[#4FC4CF]/[0.06] p-4"
              >
                <div className="overflow-x-auto rounded-lg bg-background/50 p-3 font-mono text-sm text-foreground sm:text-base">
                  {normalizeMathText(f.formula)}
                </div>
                {f.variables && f.variables.length > 0 && (
                  <div className="mt-3 grid gap-1.5">
                    {f.variables.map((v, j) => (
                      <div key={j} className="text-sm">
                        <span className="font-mono font-semibold text-[#4FC4CF]">
                          {normalizeMathText(v.symbol)}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          — {normalizeMathText(v.meaning)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <MarkdownText
                  text={f.explanation}
                  className="mt-3 text-sm leading-relaxed text-muted-foreground"
                />
                {f.worked_example && (
                  <MarkdownText
                    text={f.worked_example}
                    className="mt-3 rounded-lg border border-surface-border bg-background/50 p-3 text-sm leading-relaxed text-foreground"
                  />
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {lesson.real_life_examples.length > 0 && (
        <Section title={t("realLifeExamples")}>
          <div className="space-y-3">
            {lesson.real_life_examples.map((ex, i) => (
              <div
                key={i}
                className="rounded-xl border border-[#7C6AF7]/30 p-4 text-[15px] text-foreground leading-relaxed"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, rgba(124,106,247,0.14) 0%, rgba(79,196,207,0.08) 100%)",
                }}
              >
                {normalizeMathText(ex)}
              </div>
            ))}
          </div>
        </Section>
      )}

      {lesson.has_problems && lesson.practice_problems.length > 0 && (
        <Section title={t("practiceProblems")}>
          <div className="space-y-4">
            {lesson.practice_problems.map((p, i) => (
              <PracticeProblem key={i} index={i + 1} problem={p} />
            ))}
          </div>
        </Section>
      )}

      <LessonCheckpoint
        lesson={lesson}
        isCompleted={isCompleted}
        onComplete={onComplete}
        onRefreshCheckpoint={onRefreshCheckpoint}
      />

      <div className="mt-8 flex flex-col items-stretch justify-between gap-3 sm:mt-10 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onPrev}
          disabled={isFirst}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-background/40 px-4 py-3 text-sm font-medium text-foreground hover:bg-background/60 disabled:cursor-not-allowed disabled:opacity-40 sm:py-2.5"
        >
          <ChevronLeft size={16} /> {t("previousLesson")}
        </button>

        <button
          type="button"
          disabled
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed sm:py-2.5 ${
            isCompleted ? "bg-emerald-600" : "opacity-70"
          }`}
          style={
            isCompleted
              ? undefined
              : { backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }
          }
        >
          <CheckCircle2 size={16} />
          {isCompleted ? t("completedBtn") : t("lessonCheckpoint")}
        </button>

        {isLast && allDone ? (
          <button
            type="button"
            onClick={onFinalTest}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-3 text-sm font-semibold text-white sm:py-2.5"
            style={{ backgroundImage: "linear-gradient(135deg, #10b981, #059669)" }}
          >
            <PartyPopper size={16} /> {t("practiceFlashcards")} →
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={isLast || !isCompleted}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-background/40 px-5 py-3 text-sm font-medium text-foreground hover:bg-background/60 disabled:cursor-not-allowed disabled:opacity-40 sm:py-2.5"
          >
            {t("nextLesson")} <ChevronRight size={16} />
          </button>
        )}
      </div>
    </article>
  );
}

function LessonCheckpoint({
  lesson,
  isCompleted,
  onComplete,
  onRefreshCheckpoint,
}: {
  lesson: CourseLesson;
  isCompleted: boolean;
  onComplete: () => void;
  onRefreshCheckpoint: (lesson: CourseLesson) => Promise<unknown>;
}) {
  const { t } = useT();
  const question = lesson.checkpoint_question;
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"neutral" | "ok" | "wrong">("neutral");
  const [loading, setLoading] = useState(false);
  const requestedMissingQuestion = useRef(false);

  useEffect(() => {
    setSelected("");
    setMessage(null);
    setTone("neutral");
    setLoading(false);
    requestedMissingQuestion.current = false;
  }, [lesson.lesson_number, question?.question]);

  useEffect(() => {
    if (question || isCompleted || requestedMissingQuestion.current) return;
    requestedMissingQuestion.current = true;
    let cancelled = false;
    setLoading(true);
    onRefreshCheckpoint(lesson).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isCompleted, lesson, onRefreshCheckpoint, question]);

  if (!question) {
    return (
      <Section title={t("lessonCheckpoint")}>
        <div className="rounded-xl border border-surface-border bg-background/40 p-4">
          <p className="text-sm text-muted-foreground">{t("checkpointIntro")}</p>
          <p className="mt-3 text-xs text-muted-foreground">{t("generatingNewQuestion")}</p>
        </div>
      </Section>
    );
  }

  const checkAnswer = async () => {
    if (isCompleted) return;
    if (!selected) {
      setTone("wrong");
      setMessage(t("chooseAnswer"));
      return;
    }
    if (isAnswerCorrect(question, selected)) {
      setTone("ok");
      setMessage(t("correctCheckpoint"));
      onComplete();
      return;
    }
    setTone("wrong");
    setMessage(t("wrongCheckpoint"));
    setSelected("");
    setLoading(true);
    try {
      await onRefreshCheckpoint(lesson);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section title={t("lessonCheckpoint")}>
      <div className="rounded-xl border border-[#7C6AF7]/30 bg-[#7C6AF7]/[0.06] p-4">
        <p className="text-xs font-medium text-muted-foreground">{t("checkpointIntro")}</p>
        <MarkdownText
          text={question.question}
          className="mt-3 text-[15px] font-semibold leading-relaxed text-foreground"
        />
        <div className="mt-4 grid gap-2">
          {(question.options ?? []).map((option) => {
            const active = selected === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  if (isCompleted || loading) return;
                  setSelected(option);
                  setMessage(null);
                  setTone("neutral");
                }}
                disabled={isCompleted || loading}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                  active
                    ? "border-[#7C6AF7] bg-[#7C6AF7]/20 text-foreground"
                    : "border-surface-border bg-background/40 text-foreground hover:border-[#7C6AF7]/50"
                }`}
              >
                {normalizeMathText(option)}
              </button>
            );
          })}
        </div>
        {message && (
          <p
            className={`mt-3 text-sm font-medium ${
              tone === "ok"
                ? "text-emerald-300"
                : tone === "wrong"
                  ? "text-amber-300"
                  : "text-muted-foreground"
            }`}
          >
            {message}
          </p>
        )}
        {loading && (
          <p className="mt-2 text-xs text-muted-foreground">{t("generatingNewQuestion")}</p>
        )}
        {isCompleted && question.explanation && (
          <MarkdownText
            text={question.explanation}
            className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] p-3 text-sm leading-relaxed text-foreground"
          />
        )}
        {!isCompleted && (
          <button
            type="button"
            onClick={checkAnswer}
            disabled={loading}
            className="mt-4 inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }}
          >
            {t("checkAnswer")}
          </button>
        )}
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function PracticeProblem({ index, problem }: { index: number; problem: CoursePracticeProblem }) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  // back-compat: if no steps array, derive from legacy fields
  const steps =
    problem.steps && problem.steps.length > 0
      ? problem.steps
      : problem.solution_steps
        ? problem.solution_steps.split(/\n+/).filter(Boolean)
        : [];
  const finalAnswer = problem.final_answer || problem.answer || "";
  return (
    <div className="rounded-xl border border-surface-border bg-background/40 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {t("problem")} {index}
      </div>
      <MarkdownText
        text={problem.problem}
        className="text-[15px] leading-relaxed text-foreground"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="mt-3 text-xs font-medium text-[#7C6AF7] hover:underline"
      >
        {show ? t("hideAnswer") : t("showAnswer")}
      </button>
      {show && (
        <div className="mt-3 space-y-3">
          {steps.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {t("stepByStep")}
              </div>
              <ol className="space-y-2">
                {steps.map((step, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-lg border border-surface-border bg-background/60 p-3 text-sm text-foreground leading-relaxed"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7C6AF7]/20 text-[11px] font-bold text-[#7C6AF7]">
                      {i + 1}
                    </span>
                    <MarkdownText
                      text={step.replace(/^\s*step\s*\d+[:.)\s-]*/i, "")}
                      className="flex-1 text-sm leading-relaxed"
                    />
                  </li>
                ))}
              </ol>
            </div>
          )}
          {finalAnswer && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/[0.12] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 mb-1">
                {t("finalAnswer")}
              </div>
              <MarkdownText
                text={finalAnswer}
                className="text-base font-semibold text-foreground"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
