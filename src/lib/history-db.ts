import { supabase } from "@/integrations/supabase/client";
import type {
  HistorySession,
  HistorySubtopic,
  HistoryMessage,
  HistoryQuizQuestion,
  HistoryLessonConcept,
  HistoryFlashcard,
  HistoryKnowledgeGap,
} from "@/lib/history";
import type { Course } from "@/lib/learning-state";

interface ConversationRow {
  id: string;
  topic: string;
  created_at: string;
  subtopics: HistorySubtopic[] | null;
  messages: HistoryMessage[] | null;
  questions_count: number | null;
  duration_minutes: number | null;
  pre_test_questions: HistoryQuizQuestion[] | null;
  pre_test_answers: string[] | null;
  pre_test_score: number | string | null;
  pre_test_total: number | null;
  final_test_questions: HistoryQuizQuestion[] | null;
  final_test_answers: string[] | null;
  final_test_score: number | string | null;
  final_test_total: number | null;
  lesson_content: HistoryLessonConcept[] | null;
  course_content: Course | null;
  flashcards: HistoryFlashcard[] | null;
  improvement: number | null;
  knowledge_gaps: HistoryKnowledgeGap[] | null;
  suggested_topics: string[] | null;
}

const SELECT_COLS =
  "id, topic, created_at, subtopics, messages, questions_count, duration_minutes, pre_test_questions, pre_test_answers, pre_test_score, pre_test_total, final_test_questions, final_test_answers, final_test_score, final_test_total, lesson_content, course_content, flashcards, improvement, knowledge_gaps, suggested_topics";

function numOrZero(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function rowToSession(row: ConversationRow): HistorySession {
  const preQs = Array.isArray(row.pre_test_questions) ? row.pre_test_questions : [];
  const finalQs = Array.isArray(row.final_test_questions) ? row.final_test_questions : [];
  return {
    id: row.id,
    topic: row.topic,
    date: row.created_at,
    subtopics: Array.isArray(row.subtopics) ? row.subtopics : [],
    messages: Array.isArray(row.messages) ? row.messages : [],
    stats: {
      questionsAnswered: row.questions_count ?? 0,
      durationMinutes: row.duration_minutes ?? 0,
    },
    preTest: preQs.length
      ? {
          questions: preQs,
          answers: Array.isArray(row.pre_test_answers) ? row.pre_test_answers : [],
          score: numOrZero(row.pre_test_score),
          total: row.pre_test_total ?? preQs.length,
        }
      : undefined,
    finalTest: finalQs.length
      ? {
          questions: finalQs,
          answers: Array.isArray(row.final_test_answers) ? row.final_test_answers : [],
          score: numOrZero(row.final_test_score),
          total: row.final_test_total ?? finalQs.length,
        }
      : undefined,
    lesson: Array.isArray(row.lesson_content) ? row.lesson_content : [],
    course:
      row.course_content &&
      typeof row.course_content === "object" &&
      Array.isArray(row.course_content.lessons)
        ? row.course_content
        : null,
    flashcards: Array.isArray(row.flashcards) ? row.flashcards : [],
    improvement: row.improvement ?? undefined,
    knowledgeGaps: Array.isArray(row.knowledge_gaps) ? row.knowledge_gaps : [],
    suggestedTopics: Array.isArray(row.suggested_topics) ? row.suggested_topics : [],
  };
}

export async function fetchConversationsForUser(userId: string): Promise<HistorySession[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchConversationsForUser failed:", error);
    return [];
  }
  return (data ?? []).map((r) => rowToSession(r as unknown as ConversationRow));
}

export async function fetchConversation(
  userId: string,
  id: string,
): Promise<HistorySession | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("fetchConversation failed:", error);
    return null;
  }
  return data ? rowToSession(data as unknown as ConversationRow) : null;
}

export async function saveConversation(
  userId: string,
  session: Omit<HistorySession, "id" | "date">,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("conversations").insert({
    user_id: userId,
    topic: session.topic,
    subtopics: session.subtopics as unknown as never,
    messages: session.messages as unknown as never,
    questions_count: session.stats.questionsAnswered,
    duration_minutes: session.stats.durationMinutes,
  });
  if (error) {
    console.error("saveConversation failed:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
