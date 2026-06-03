import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Lock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  BookOpen,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { FullScreenLoader } from "@/components/FullScreenLoader";
import { AiErrorState } from "@/components/AiErrorState";
import { generateCourse } from "@/lib/learning.functions";
import { loadState, patchState, isAnswerCorrect } from "@/lib/learning-state";
import type {
  Course,
  CourseLesson,
  CoursePracticeProblem,
  LearningState,
} from "@/lib/learning-state";
import { useT } from "@/lib/i18n";
import { friendlyAiError } from "@/lib/ai-error";

export const Route = createFileRoute("/course")({
  component: CoursePage,
});

function CoursePage() {
  const navigate = useNavigate();
  const { t, lang, hydrated } = useT();
  const generate = useServerFn(generateCourse);
  const [state, setState] = useState<LearningState | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [currentLesson, setCurrentLesson] = useState(1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadCourse = useCallback(() => {
    if (!hydrated) return;
    setError(null);
    setCourse(null);
    const s = loadState();
    if (!s || s.preTestQuestions.length === 0) {
      navigate({ to: "/" });
      return;
    }
    setState(s);
    setCompleted(s.completedLessons ?? []);
    setCurrentLesson(s.currentLesson || 1);
    if (s.course && s.course.lessons?.length) {
      setCourse(s.course);
      return;
    }
    const wrong = s.preTestQuestions
      .filter((q, i) => !isAnswerCorrect(q, s.preTestAnswers[i] ?? ""))
      .map((q) => q.question);
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setError(friendlyAiError(new Error("AI service is busy")));
    }, 30000);
    generate({ data: { topic: s.topic, wrongQuestions: wrong, language: lang } })
      .then((res) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        if (res.error || !res.course) {
          setError(res.error ?? friendlyAiError(new Error("AI response unavailable")));
          return;
        }
        patchState({ course: res.course });
        setCourse(res.course);
      })
      .catch((e) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setError(friendlyAiError(e));
      });
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [navigate, lang, hydrated]);

  useEffect(() => loadCourse(), [loadCourse]);

  const lessons = course?.lessons ?? [];
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
    }
  };

  if (error) {
    return <AiErrorState message={error} onRetry={loadCourse} />;
  }

  if (!state || !course) {
    return <FullScreenLoader title={t("buildingCourse")} subtitle={t("buildingCourseSub")} />;
  }

  return (
    <main className="min-h-screen w-full bg-background relative animate-fade-in">
      <AppHeader />
      <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 py-8">
        <header className="mb-6">
          <span className="inline-flex items-center rounded-full border border-[#7C6AF7]/40 bg-[#7C6AF7]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#7C6AF7]">
            {t("stage3")}
          </span>
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-foreground">
            {course.course_title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {completed.length} {t("of")} {lessons.length} {t("lessonsCompleted")}
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          <aside className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-auto rounded-2xl border border-surface-border bg-surface p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-2 flex items-center gap-2">
              <BookOpen size={13} /> {t("lessons")}
            </div>
            <ul className="space-y-1.5">
              {lessons.map((l) => {
                const unlocked = isUnlocked(l.lesson_number);
                const done = isDone(l.lesson_number);
                const active = currentLesson === l.lesson_number;
                return (
                  <li key={l.lesson_number}>
                    <button
                      type="button"
                      onClick={() => openLesson(l.lesson_number)}
                      disabled={!unlocked}
                      className={`w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-3 transition-colors ${
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
                        <div className="text-sm font-medium text-foreground truncate">
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
                Practice Flashcards →
              </button>
            )}
          </aside>

          <section>
            {lesson ? (
              <LessonView
                lesson={lesson}
                total={lessons.length}
                onPrev={() => openLesson(lesson.lesson_number - 1)}
                onNext={() => openLesson(lesson.lesson_number + 1)}
                onComplete={markComplete}
                isCompleted={isDone(lesson.lesson_number)}
                allDone={allDone}
                onFinalTest={() => navigate({ to: "/final-test" })}
              />
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
  isCompleted,
  allDone,
  onFinalTest,
}: {
  lesson: CourseLesson;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onComplete: () => void;
  isCompleted: boolean;
  allDone: boolean;
  onFinalTest: () => void;
}) {
  const { t } = useT();
  const isLast = lesson.lesson_number === total;
  const isFirst = lesson.lesson_number === 1;

  return (
    <article className="rounded-2xl border border-surface-border bg-surface p-6 sm:p-9 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] animate-fade-in">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span className="uppercase tracking-wider font-semibold">
          {t("lesson")} {lesson.lesson_number} {t("of")} {total}
        </span>
        <span className="tabular-nums">
          {Math.round((lesson.lesson_number / total) * 100)}%
        </span>
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

      <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
        {lesson.title}
      </h2>

      <Section title={t("explanation")}>
        <div className="prose-readable space-y-4 text-[15.5px] leading-[1.75] text-foreground">
          {lesson.explanation.split(/\n{2,}/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </Section>

      {lesson.terms.length > 0 && (
        <Section title={t("keyTerms")}>
          <div className="grid sm:grid-cols-2 gap-3">
            {lesson.terms.map((tm, i) => (
              <div key={i} className="rounded-xl border border-surface-border bg-background/40 p-4">
                <div className="text-sm font-semibold text-[#7C6AF7]">{tm.term}</div>
                <div className="mt-1 text-sm text-foreground leading-relaxed">{tm.definition}</div>
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
                <div className="rounded-lg bg-background/50 p-3 font-mono text-base text-foreground">
                  {f.formula}
                </div>
                {f.variables && f.variables.length > 0 && (
                  <div className="mt-3 grid gap-1.5">
                    {f.variables.map((v, j) => (
                      <div key={j} className="text-sm">
                        <span className="font-mono font-semibold text-[#4FC4CF]">{v.symbol}</span>
                        <span className="text-muted-foreground"> — {v.meaning}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {f.explanation}
                </p>
                {f.worked_example && (
                  <div className="mt-3 rounded-lg border border-surface-border bg-background/50 p-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {f.worked_example}
                  </div>
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
                {ex}
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

      <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={isFirst}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-background/40 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-background/60 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} /> {t("previousLesson")}
        </button>

        <button
          type="button"
          onClick={onComplete}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold text-white ${
            isCompleted ? "bg-emerald-600 hover:bg-emerald-600/90" : ""
          }`}
          style={
            isCompleted
              ? undefined
              : { backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }
          }
        >
          <CheckCircle2 size={16} />
          {isCompleted ? t("completedBtn") : t("markComplete")}
        </button>

        {isLast && allDone ? (
          <button
            type="button"
            onClick={onFinalTest}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundImage: "linear-gradient(135deg, #10b981, #059669)" }}
          >
            <PartyPopper size={16} /> {t("courseCompleteCta")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={isLast}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-medium text-foreground border border-surface-border bg-background/40 hover:bg-background/60 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("nextLesson")} <ChevronRight size={16} />
          </button>
        )}
      </div>
    </article>
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
      <p className="text-[15px] text-foreground leading-relaxed">{problem.problem}</p>
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
                    <span className="flex-1 whitespace-pre-wrap">
                      {step.replace(/^\s*step\s*\d+[:.)\s-]*/i, "")}
                    </span>
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
              <div className="text-base font-semibold text-foreground">{finalAnswer}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
