import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Layers, RotateCw } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { MarkdownText } from "@/components/MarkdownText";
import { useAuth } from "@/hooks/use-auth";
import { fetchConversation } from "@/lib/history-db";
import { formatDate, getSession, type HistoryFlashcard, type HistorySession } from "@/lib/history";
import type { CourseLesson } from "@/lib/learning-state";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/saved-course/$id")({
  head: () => ({
    meta: [
      { title: "Saved Course — KnowGap" },
      { name: "description", content: "Review saved KnowGap lessons and flashcards." },
    ],
  }),
  component: () => (
    <AuthGuard>
      <SavedCoursePage />
    </AuthGuard>
  ),
});

function SavedCoursePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useT();
  const [session, setSession] = useState<HistorySession | null | undefined>(undefined);
  const [activeLesson, setActiveLesson] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (user) {
        const row = await fetchConversation(user.id, id);
        if (cancelled) return;
        if (row) {
          setSession(row);
          return;
        }
      }
      if (!cancelled) setSession(getSession(id) ?? null);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  const lessons = useMemo(() => session?.course?.lessons ?? [], [session]);
  const flashcards = session?.flashcards ?? [];
  const lesson = lessons.find((item) => item.lesson_number === activeLesson) ?? lessons[0];
  const hasSavedContent = lessons.length > 0 || flashcards.length > 0;

  useEffect(() => {
    if (lesson) setActiveLesson(lesson.lesson_number);
  }, [lesson]);

  const retakeCourse = () => {
    if (!session) return;
    try {
      sessionStorage.removeItem("knowgap:state");
      sessionStorage.setItem("knowgap:topic", session.topic);
    } catch {}
    navigate({ to: "/pretest" });
  };

  if (session === undefined) {
    return (
      <main className="min-h-screen w-full bg-background px-6 py-10">
        <AppHeader />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (session === null) {
    return (
      <main className="min-h-screen w-full bg-background px-6 py-10">
        <AppHeader />
        <div className="mx-auto w-full max-w-[720px]">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} /> {t("backToDashboard")}
          </Link>
          <p className="mt-8 text-sm text-foreground">Session not found.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-background px-4 pb-10 pt-24 animate-fade-in sm:px-6 sm:py-10">
      <AppHeader />
      <div className="mx-auto w-full max-w-[1180px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} /> {t("backToDashboard")}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/final-analysis/$id"
              params={{ id: session.id }}
              className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs font-medium text-foreground hover:bg-surface/70"
            >
              {t("viewAnalysis")}
            </Link>
            <button
              type="button"
              onClick={retakeCourse}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-background/40 px-3 py-2 text-xs font-medium text-foreground hover:bg-background/60"
            >
              <RotateCw size={12} /> {t("retakeCourse")}
            </button>
          </div>
        </div>

        <header className="mt-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7C6AF7]/40 bg-[#7C6AF7]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#7C6AF7]">
            <BookOpen size={12} /> {t("savedCourse")}
          </span>
          <h1 className="mt-3 text-2xl font-bold leading-tight text-foreground sm:text-4xl">
            {session.topic}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{formatDate(session.date)}</p>
        </header>

        {!hasSavedContent ? (
          <div className="mt-8 rounded-2xl border border-dashed border-surface-border p-8 text-center">
            <p className="text-sm text-muted-foreground">{t("noSavedCourse")}</p>
            <button
              type="button"
              onClick={retakeCourse}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }}
            >
              <RotateCw size={14} /> {t("retakeCourse")}
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[300px_1fr]">
            {lessons.length > 0 && (
              <aside className="rounded-2xl border border-surface-border bg-surface p-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
                <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("savedLessons")}
                </div>
                <ul className="space-y-1.5">
                  {lessons.map((item) => {
                    const active = item.lesson_number === lesson?.lesson_number;
                    return (
                      <li key={item.lesson_number}>
                        <button
                          type="button"
                          onClick={() => setActiveLesson(item.lesson_number)}
                          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                            active
                              ? "border-[#7C6AF7]/40 bg-[#7C6AF7]/15"
                              : "border-transparent hover:bg-background/40"
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              active
                                ? "bg-[#7C6AF7] text-white"
                                : "bg-surface-border text-muted-foreground"
                            }`}
                          >
                            {item.lesson_number}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                              {t("lesson")} {item.lesson_number}
                            </span>
                            <span className="block truncate text-sm font-medium text-foreground">
                              {item.title}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </aside>
            )}

            <div className="min-w-0 space-y-6">
              {lesson && <SavedLesson lesson={lesson} />}
              {flashcards.length > 0 && <SavedFlashcards cards={flashcards} />}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function SavedLesson({ lesson }: { lesson: CourseLesson }) {
  const { t } = useT();
  return (
    <article className="rounded-2xl border border-surface-border bg-surface p-5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] sm:p-8">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("lesson")} {lesson.lesson_number}
      </div>
      <h2 className="mt-2 text-2xl font-bold leading-tight text-foreground">{lesson.title}</h2>

      <Section title={t("explanation")}>
        <MarkdownText
          text={lesson.explanation}
          className="prose-readable text-[15px] leading-[1.75] text-foreground"
        />
      </Section>

      {lesson.terms.length > 0 && (
        <Section title={t("keyTerms")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {lesson.terms.map((term, index) => (
              <div
                key={index}
                className="rounded-xl border border-surface-border bg-background/40 p-4"
              >
                <div className="text-sm font-semibold text-[#7C6AF7]">{term.term}</div>
                <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {term.definition}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {lesson.formulas.length > 0 && (
        <Section title={t("formulas")}>
          <div className="space-y-3">
            {lesson.formulas.map((formula, index) => (
              <div
                key={index}
                className="rounded-xl border border-surface-border bg-background/40 p-4"
              >
                <div className="overflow-x-auto rounded-lg bg-background/60 p-3 font-mono text-sm text-foreground">
                  {formula.formula}
                </div>
                {formula.explanation && (
                  <MarkdownText
                    text={formula.explanation}
                    className="mt-3 text-sm leading-relaxed text-muted-foreground"
                  />
                )}
                {formula.worked_example && (
                  <MarkdownText
                    text={formula.worked_example}
                    className="mt-3 text-sm leading-relaxed text-foreground"
                  />
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {lesson.real_life_examples.length > 0 && (
        <Section title={t("realLifeExamples")}>
          <ul className="space-y-2">
            {lesson.real_life_examples.map((example, index) => (
              <li
                key={index}
                className="rounded-xl border border-surface-border bg-background/40 p-4 text-sm leading-relaxed text-foreground"
              >
                {example}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {lesson.practice_problems.length > 0 && (
        <Section title={t("practiceProblems")}>
          <div className="space-y-3">
            {lesson.practice_problems.map((problem, index) => (
              <div
                key={index}
                className="rounded-xl border border-surface-border bg-background/40 p-4"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("problem")} {index + 1}
                </div>
                <MarkdownText
                  text={problem.problem}
                  className="mt-2 text-sm leading-relaxed text-foreground"
                />
                {problem.steps.length > 0 && (
                  <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                    {problem.steps.map((step, stepIndex) => (
                      <li key={stepIndex}>{step}</li>
                    ))}
                  </ol>
                )}
                {problem.final_answer && (
                  <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.05] p-3 text-sm text-emerald-200">
                    {problem.final_answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </article>
  );
}

function SavedFlashcards({ cards }: { cards: HistoryFlashcard[] }) {
  const { t } = useT();
  return (
    <section className="rounded-2xl border border-surface-border bg-surface p-5 sm:p-8">
      <div className="flex items-center gap-2">
        <Layers size={16} className="text-[#4FC4CF]" />
        <h2 className="text-lg font-semibold text-foreground">{t("savedFlashcards")}</h2>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {cards.map((card, index) => (
          <div
            key={`${card.term}-${index}`}
            className="rounded-xl border border-surface-border bg-background/40 p-4"
          >
            <div className="text-base font-semibold text-[#7C6AF7]">{card.term}</div>
            <div className="mt-2 space-y-3">
              <FlashcardLine
                label="Simple Definition"
                value={card.simple_definition || card.definition}
              />
              <FlashcardLine label="Expanded Explanation" value={card.expanded_explanation} />
              <FlashcardLine label="How it Works" value={card.how_it_works} />
              <FlashcardLine label="Example" value={card.example} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FlashcardLine({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null;
  return (
    <section>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <MarkdownText text={value} className="mt-1 text-sm leading-relaxed text-foreground" />
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
