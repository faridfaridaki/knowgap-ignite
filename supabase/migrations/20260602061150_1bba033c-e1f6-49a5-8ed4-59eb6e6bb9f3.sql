ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS pre_test_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pre_test_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pre_test_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_test_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS final_test_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS final_test_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lesson_content jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS flashcards jsonb NOT NULL DEFAULT '[]'::jsonb;