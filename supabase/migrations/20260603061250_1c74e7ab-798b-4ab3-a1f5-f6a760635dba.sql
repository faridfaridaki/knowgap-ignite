ALTER TABLE public.conversations
  ALTER COLUMN pre_test_score TYPE numeric(5,1) USING pre_test_score::numeric,
  ALTER COLUMN final_test_score TYPE numeric(5,1) USING final_test_score::numeric;

ALTER TABLE public.conversations
  ALTER COLUMN pre_test_score SET DEFAULT 0,
  ALTER COLUMN final_test_score SET DEFAULT 0;