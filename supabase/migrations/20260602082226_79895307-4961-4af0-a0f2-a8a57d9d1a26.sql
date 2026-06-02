ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS pre_test_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_test_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS improvement integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS knowledge_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS suggested_topics jsonb NOT NULL DEFAULT '[]'::jsonb;