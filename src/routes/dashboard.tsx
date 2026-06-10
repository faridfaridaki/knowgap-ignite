import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  TrendingUp,
  GraduationCap,
  AlertTriangle,
  Clock,
  RotateCw,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { FullScreenLoader } from "@/components/FullScreenLoader";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { loadHistory, formatDate, type HistorySession } from "@/lib/history";
import { fetchConversationsForUser } from "@/lib/history-db";
import { formatScore } from "@/lib/learning-state";

const INITIAL_SECTION_ITEMS = 4;
const SECTION_INCREMENT = 2;
const MAX_VISIBLE_COURSES = 8;
const MAX_VISIBLE_COMPACT_SECTION = 6;

interface DashboardRow extends HistorySession {
  courseLessonsTotal: number;
  courseLessonsDone: number;
  hasSavedCourse: boolean;
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — KnowGap" },
      { name: "description", content: "Your KnowGap learning dashboard." },
    ],
  }),
  component: DashboardRoute,
});

function DashboardRoute() {
  const { t } = useT();
  return (
    <AuthGuard loadingTitle={t("loadingDashboard")} loadingSubtitle={t("loadingDashboardSub")}>
      <DashboardPage />
    </AuthGuard>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<DashboardRow[]>([]);
  const [displayName, setDisplayName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [visibleCoursesCount, setVisibleCoursesCount] = useState(INITIAL_SECTION_ITEMS);
  const [visibleActivityCount, setVisibleActivityCount] = useState(INITIAL_SECTION_ITEMS);
  const [visibleFocusCount, setVisibleFocusCount] = useState(INITIAL_SECTION_ITEMS);

  // Load profile name
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      setDisplayName((data?.display_name as string) || user.email?.split("@")[0] || "");
    })();
  }, [user]);

  // Load sessions + raw course data for progress
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      if (user) {
        const rows = await fetchConversationsForUser(user.id);
        if (cancelled) return;
        setSessions(
          rows.map((r) => {
            const lessons = Array.isArray(r.course?.lessons) ? r.course.lessons.length : 0;
            return {
              ...r,
              courseLessonsTotal: lessons || 10,
              courseLessonsDone: lessons || 10,
              hasSavedCourse: lessons > 0 || Boolean(r.flashcards?.length),
            };
          }),
        );
      } else {
        const rows = loadHistory();
        if (!cancelled) {
          setSessions(
            rows.map((r) => {
              const lessons = Array.isArray(r.course?.lessons) ? r.course.lessons.length : 0;
              return {
                ...r,
                courseLessonsTotal: lessons || 10,
                courseLessonsDone: lessons || 10,
                hasSavedCourse: lessons > 0 || Boolean(r.flashcards?.length),
              };
            }),
          );
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    setVisibleCoursesCount(INITIAL_SECTION_ITEMS);
    setVisibleActivityCount(INITIAL_SECTION_ITEMS);
    setVisibleFocusCount(INITIAL_SECTION_ITEMS);
  }, [sessions.length]);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [sessions],
  );

  const stats = useMemo(() => {
    const completed = sessions.filter((s) => s.finalTest).length;
    const lessonsDone = sessions.reduce((acc, s) => acc + s.courseLessonsDone, 0);
    const improvements = sessions
      .map((s) => s.improvement)
      .filter((v): v is number => typeof v === "number");
    const avgImprovement =
      improvements.length > 0
        ? Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length)
        : 0;
    return { completed, lessonsDone, avgImprovement };
  }, [sessions]);

  const knowledgeGaps = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      for (const g of s.knowledgeGaps ?? []) {
        const key = g.question.slice(0, 120);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([question, count]) => ({ question, count }));
  }, [sessions]);

  const suggestedTopics = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of sortedSessions) {
      for (const tp of s.suggestedTopics ?? []) {
        if (!seen.has(tp) && !sortedSessions.some((sx) => sx.topic === tp)) {
          seen.add(tp);
          out.push(tp);
          if (out.length >= 4) break;
        }
      }
      if (out.length >= 4) break;
    }
    return out;
  }, [sortedSessions]);

  const recentActivity = useMemo(() => {
    type Activity = { date: string; kind: "scored" | "started"; session: DashboardRow };
    const list: Activity[] = [];
    for (const s of sortedSessions) {
      if (s.finalTest) list.push({ date: s.date, kind: "scored", session: s });
      else list.push({ date: s.date, kind: "started", session: s });
    }
    return list
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, MAX_VISIBLE_COMPACT_SECTION);
  }, [sortedSessions]);

  const visibleCoursesLimit = Math.min(sortedSessions.length, MAX_VISIBLE_COURSES);
  const visibleCourses = sortedSessions.slice(0, visibleCoursesCount);
  const canShowMoreCourses = visibleCoursesCount < visibleCoursesLimit;
  const visibleRecentActivity = recentActivity.slice(0, visibleActivityCount);
  const canShowMoreActivity =
    visibleActivityCount < Math.min(recentActivity.length, MAX_VISIBLE_COMPACT_SECTION);
  const visibleKnowledgeGaps = knowledgeGaps.slice(0, visibleFocusCount);
  const canShowMoreFocus =
    visibleFocusCount < Math.min(knowledgeGaps.length, MAX_VISIBLE_COMPACT_SECTION);

  const showMoreCourses = () => {
    setVisibleCoursesCount((count) => Math.min(count + SECTION_INCREMENT, visibleCoursesLimit));
  };

  const showMoreActivity = () => {
    setVisibleActivityCount((count) =>
      Math.min(count + SECTION_INCREMENT, MAX_VISIBLE_COMPACT_SECTION),
    );
  };

  const showMoreFocus = () => {
    setVisibleFocusCount((count) =>
      Math.min(count + SECTION_INCREMENT, MAX_VISIBLE_COMPACT_SECTION),
    );
  };

  const startTopic = (topic: string) => {
    try {
      sessionStorage.removeItem("knowgap:state");
      sessionStorage.setItem("knowgap:topic", topic);
    } catch {}
    navigate({ to: "/pretest" });
  };

  if (loading) {
    return <FullScreenLoader title={t("loadingDashboard")} subtitle={t("loadingDashboardSub")} />;
  }

  return (
    <main className="min-h-screen w-full bg-background px-6 py-10 relative animate-fade-in">
      <AppHeader />
      <div className="mx-auto w-full max-w-[1100px]">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          {t("welcomeBack")}
          {displayName ? `, ${displayName}` : ""}
        </h1>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            icon={<GraduationCap size={18} className="text-[#7C6AF7]" />}
            label={t("coursesCompleted")}
            value={stats.completed}
          />
          <StatCard
            icon={<BookOpen size={18} className="text-[#4FC4CF]" />}
            label={t("lessonsDone")}
            value={stats.lessonsDone}
          />
          <StatCard
            icon={<TrendingUp size={18} className="text-emerald-300" />}
            label={t("avgImprovement")}
            value={`${stats.avgImprovement > 0 ? "+" : ""}${stats.avgImprovement}%`}
          />
        </div>

        {/* My Courses */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground mb-4">{t("myCourses")}</h2>
          {sortedSessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-border p-8 text-center">
              <p className="text-sm text-muted-foreground">{t("noCoursesYet")}</p>
              <Link
                to="/"
                className="mt-4 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                style={{ backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)" }}
              >
                {t("analyzeBtn")}
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {visibleCourses.map((s) => {
                  const preTotal = s.preTest?.total ?? s.preTest?.questions.length ?? 0;
                  const finalTotal = s.finalTest?.total ?? s.finalTest?.questions.length ?? 0;
                  const finalPct = finalTotal
                    ? Math.round(((s.finalTest?.score ?? 0) / finalTotal) * 100)
                    : 0;
                  const progressPct = s.courseLessonsTotal
                    ? Math.round((s.courseLessonsDone / s.courseLessonsTotal) * 100)
                    : 0;
                  return (
                    <div
                      key={s.id}
                      className="rounded-2xl border border-surface-border bg-surface/60 backdrop-blur-sm p-5 transition-all hover:border-[#7C6AF7]/40"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="truncate text-base font-semibold text-foreground">
                          {s.topic}
                        </h3>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(s.date)}
                        </span>
                      </div>

                      {(preTotal > 0 || finalTotal > 0) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          {preTotal > 0 && (
                            <span className="rounded-full border border-surface-border bg-background/40 px-2.5 py-1 text-foreground">
                              {t("preTest")} {formatScore(s.preTest!.score)}/{preTotal}
                            </span>
                          )}
                          <ArrowRight size={12} className="text-muted-foreground" />
                          {finalTotal > 0 && (
                            <span className="rounded-full border border-[#7C6AF7]/40 bg-[#7C6AF7]/10 px-2.5 py-1 text-[#7C6AF7] font-medium">
                              {t("finalTest")} {formatScore(s.finalTest!.score)}/{finalTotal} (
                              {finalPct}%)
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                          <span>{t("progress")}</span>
                          <span className="tabular-nums">
                            {s.courseLessonsDone}/{s.courseLessonsTotal}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-background overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${progressPct}%`,
                              backgroundImage: "linear-gradient(90deg, #7C6AF7, #4FC4CF)",
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <Link
                          to="/saved-course/$id"
                          params={{ id: s.id }}
                          className={`text-center rounded-lg px-3 py-2 text-xs font-semibold text-white ${
                            s.hasSavedCourse ? "" : "pointer-events-none opacity-50"
                          }`}
                          style={{
                            backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)",
                          }}
                        >
                          {t("viewCourse")}
                        </Link>
                        <button
                          type="button"
                          onClick={() => startTopic(s.topic)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-background/40 px-3 py-2 text-xs font-medium text-foreground hover:bg-background/60"
                        >
                          <RotateCw size={12} /> {t("retakeCourse")}
                        </button>
                      </div>
                      <Link
                        to="/final-analysis/$id"
                        params={{ id: s.id }}
                        className="mt-2 inline-flex text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        {t("viewFullAnalysis")}
                      </Link>
                    </div>
                  );
                })}
              </div>
              {canShowMoreCourses && (
                <ViewMoreButton label={t("viewMore")} onClick={showMoreCourses} />
              )}
            </>
          )}
        </section>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-foreground mb-4">{t("recentActivity")}</h2>
            <ul className="space-y-2">
              {visibleRecentActivity.map((a, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface/40 p-3"
                >
                  <Clock size={14} className="mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 text-sm text-foreground">
                    {a.kind === "scored" && a.session.finalTest
                      ? t("activityScored", {
                          score: formatScore(a.session.finalTest.score),
                          total: a.session.finalTest.total ?? a.session.finalTest.questions.length,
                          topic: a.session.topic,
                        })
                      : t("activityStarted", { topic: a.session.topic })}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(a.date)}
                  </span>
                </li>
              ))}
            </ul>
            {canShowMoreActivity && (
              <ViewMoreButton label={t("viewMore")} onClick={showMoreActivity} />
            )}
          </section>
        )}

        {/* Knowledge Gaps */}
        {knowledgeGaps.length > 0 && (
          <section className="mt-10 rounded-2xl border border-amber-400/30 bg-amber-400/[0.04] p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="mt-0.5 text-amber-300 shrink-0" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">{t("focusAreas")}</h2>
                <p className="text-xs text-muted-foreground mt-1">{t("focusAreasSub")}</p>
                <ul className="mt-4 space-y-2">
                  {visibleKnowledgeGaps.map((g, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-red-500/25 bg-red-500/[0.05] px-3 py-2 text-sm text-foreground flex items-center justify-between gap-3"
                    >
                      <span className="flex-1">{g.question}</span>
                      {g.count > 1 && (
                        <span className="shrink-0 rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                          ×{g.count}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {canShowMoreFocus && (
                  <ViewMoreButton label={t("viewMore")} onClick={showMoreFocus} />
                )}
              </div>
            </div>
          </section>
        )}

        {/* Suggested topics */}
        {suggestedTopics.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={18} className="text-[#4FC4CF]" />
              <h2 className="text-lg font-semibold text-foreground">{t("suggestedForYou")}</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {suggestedTopics.map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => startTopic(tp)}
                  className="rounded-xl border border-surface-border bg-background/40 p-4 text-left text-sm font-medium text-foreground hover:border-[#7C6AF7]/50 hover:bg-[#7C6AF7]/5 transition-colors"
                >
                  {tp}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function ViewMoreButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="mt-4 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        className="rounded-lg border border-surface-border bg-surface px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface/70"
      >
        {label}
      </button>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface/60 backdrop-blur-sm p-5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-2 text-3xl font-bold text-foreground tabular-nums">{value}</div>
    </div>
  );
}
