
-- Add session detail columns to conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS subtopics jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS questions_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 0;

-- Auto-create profile on signup using the existing handle_new_user() function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
