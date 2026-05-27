-- Protein Folding Explorer — Supabase schema
-- Run in Supabase Dashboard → SQL Editor → New query → Run

-- ---------------------------------------------------------------------------
-- Profiles (user preferences and metadata)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name TEXT,
  theme TEXT DEFAULT 'light',
  bio TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User profile data including preferences and metadata';

CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON public.profiles (user_id);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function and trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'display_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Projects (organize predictions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.projects IS 'User projects to organize predictions';

CREATE INDEX IF NOT EXISTS idx_projects_user_id
  ON public.projects (user_id);

CREATE INDEX IF NOT EXISTS idx_projects_user_created
  ON public.projects (user_id, created_at DESC);

-- Enable RLS on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own projects" ON public.projects;
CREATE POLICY "Users read own projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own projects" ON public.projects;
CREATE POLICY "Users insert own projects"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own projects" ON public.projects;
CREATE POLICY "Users update own projects"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own projects" ON public.projects;
CREATE POLICY "Users delete own projects"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Predictions (updated: per-user structure history with project support)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.predictions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  project_id TEXT REFERENCES public.projects (id) ON DELETE SET NULL,
  sequence TEXT NOT NULL,
  length INTEGER NOT NULL CHECK (length > 0),
  structure_info JSONB NOT NULL,
  coordinates JSONB NOT NULL,
  binding_pockets JSONB NOT NULL,
  model_source TEXT NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  notes TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.predictions IS 'Protein structure predictions with project organization and sharing support';

CREATE INDEX IF NOT EXISTS idx_predictions_user_created
  ON public.predictions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_predictions_user_id
  ON public.predictions (user_id);

CREATE INDEX IF NOT EXISTS idx_predictions_project_id
  ON public.predictions (project_id);

CREATE INDEX IF NOT EXISTS idx_predictions_is_public
  ON public.predictions (is_public)
  WHERE is_public = TRUE;

-- Enable RLS on predictions
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own predictions" ON public.predictions;
CREATE POLICY "Users read own predictions"
  ON public.predictions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone read public predictions" ON public.predictions;
CREATE POLICY "Anyone read public predictions"
  ON public.predictions
  FOR SELECT
  TO anon
  USING (is_public = TRUE);

DROP POLICY IF EXISTS "Authenticated read public predictions" ON public.predictions;
CREATE POLICY "Authenticated read public predictions"
  ON public.predictions
  FOR SELECT
  TO authenticated
  USING (is_public = TRUE OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own predictions" ON public.predictions;
CREATE POLICY "Users insert own predictions"
  ON public.predictions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own predictions" ON public.predictions;
CREATE POLICY "Users update own predictions"
  ON public.predictions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own predictions" ON public.predictions;
CREATE POLICY "Users delete own predictions"
  ON public.predictions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Views for lightweight data access
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.prediction_history AS
SELECT
  id,
  user_id,
  project_id,
  sequence,
  length,
  structure_info,
  model_source,
  is_public,
  notes,
  tags,
  created_at,
  updated_at
FROM public.predictions;

GRANT SELECT ON public.prediction_history TO authenticated, anon;

-- View for public predictions only
CREATE OR REPLACE VIEW public.public_predictions AS
SELECT
  id,
  user_id,
  project_id,
  sequence,
  length,
  structure_info,
  model_source,
  notes,
  tags,
  created_at
FROM public.predictions
WHERE is_public = TRUE;

GRANT SELECT ON public.public_predictions TO authenticated, anon;
