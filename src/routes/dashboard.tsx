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
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { loadHistory, formatDate, type HistorySession } from "@/lib/history";
import { fetchConversationsForUser } from "@/lib/history-db";
import { formatScore } from "@/lib/learning-state";

interface DashboardRow extends HistorySession {
  courseLessonsTotal: number;
  courseLessonsDone: number;
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — KnowGap" },
      { name: "description", content: "Your KnowGap learning dashboard." },
    ],
  }),
  component: () => (
    <AuthGuard>
      <DashboardPage />
    </AuthGuard>
  ),
});

function DashboardPage() {
  const { user } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<DashboardRow[]>([]);
  const [displayName, setDisplayName] = useState<string>("");
  const [loading, setLoading] = useState(true);

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
    void (async () => {
      if (user) {
        // Fetch the standard session list plus course_content for progress
        const { data, error } = await supabase
          .from("conversations")
          .select("id, course_content")
          .eq("user_id", user.id);
        const courseMap = new Map<string, { total: number; done: number }>();
        if (!error && data) {
          for (const row of data as Array<{ id: string; course_content: any }>) {
            const lessons = Array.isArray(row.course_content?.lessons)
              ? row.course_content.lessons.length
              : 0;
            // Assume all lessons completed if a final analysis was saved.
            courseMap.set(row.id, { total: lessons || 10, done: lessons || 10 });
          }
        }
        const rows = await fetchConversationsForUser(user.id);
        if (cancelled) return;
        setSessions(
          rows.map((r) => {
            const c = courseMap.get(r.id);
            return {
              ...r,
              courseLessonsTotal: c?.total ?? 10,
              courseLessonsDone: c?.done ?? 10,
            };
          }),
        );
      } else {
        const rows = loadHistory();
        if (!cancelled) {
          setSessions(
            rows.map((r) => ({ ...r, courseLessonsTotal: 10, courseLessonsDone: 10 })),
          );
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

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
    for (const s of sessions) {
      for (const tp of s.suggestedTopics ?? []) {
        if (!seen.has(tp) && !sessions.some((sx) => sx.topic === tp)) {
          seen.add(tp);
          out.push(tp);
          if (out.length >= 4) break;
        }
      }
      if (out.length >= 4) break;
    }
    return out;
  }, [sessions]);

  const recentActivity = useMemo(() => {
    type Activity = { date: string; kind: "scored" | "started"; session: DashboardRow };
    const list: Activity[] = [];
    for (const s of sessions) {
      if (s.finalTest) list.push({ date: s.date, kind: "scored", session: s });
      else list.push({ date: s.date, kind: "started", session: s });
    }
    return list.sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 8);
  }, [sessions]);

  const startTopic = (topic: string) => {
    try {
      sessionStorage.removeItem("knowgap:state");
      sessionStorage.setItem("knowgap:topic", topic);
    } catch {}
    navigate({ to: "/pretest" });
  };

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
          {loading ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : sessions.length === 0 ? (
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
            <div className="grid gap-4 sm:grid-cols-2">
              {sessions.map((s) => {
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

                    <div className="mt-4 flex gap-2">
                      <Link
                        to="/final-analysis/$id"
                        params={{ id: s.id }}
                        className="flex-1 text-center rounded-lg px-3 py-2 text-xs font-semibold text-white"
                        style={{
                          backgroundImage: "linear-gradient(135deg, #7C6AF7, #5B4FD4)",
                        }}
                      >
                        {t("viewFullAnalysis")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => startTopic(s.topic)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-background/40 px-3 py-2 text-xs font-medium text-foreground hover:bg-background/60"
                      >
                        <RotateCw size={12} /> {t("retakeCourse")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-foreground mb-4">{t("recentActivity")}</h2>
            <ul className="space-y-2">
              {recentActivity.map((a, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface/40 p-3"
                >
                  <Clock size={14} className="mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 text-sm text-foreground">
                    {a.kind === "scored" && a.session.finalTest
                      ? t("activityScored", {
                          score: formatScore(a.session.finalTest.score),
                          total:
                            a.session.finalTest.total ?? a.session.finalTest.questions.length,
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
                  {knowledgeGaps.map((g, i) => (
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
