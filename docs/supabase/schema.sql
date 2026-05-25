-- Protein Folding Explorer — Supabase schema
-- Run in Supabase Dashboard → SQL Editor → New query → Run

-- ---------------------------------------------------------------------------
-- Predictions (per-user structure history)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.predictions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  sequence TEXT NOT NULL,
  length INTEGER NOT NULL CHECK (length > 0),
  structure_info JSONB NOT NULL,
  coordinates JSONB NOT NULL,
  binding_pockets JSONB NOT NULL,
  model_source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.predictions IS 'Protein structure predictions per authenticated user';

CREATE INDEX IF NOT EXISTS idx_predictions_user_created
  ON public.predictions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_predictions_user_id
  ON public.predictions (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security (direct client access via anon key + user JWT)
-- Backend uses service_role and must filter by user_id in application code.
-- ---------------------------------------------------------------------------
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own predictions" ON public.predictions;
CREATE POLICY "Users read own predictions"
  ON public.predictions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

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
-- Optional: view for lightweight history lists (metadata only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.prediction_history AS
SELECT
  id,
  user_id,
  sequence,
  length,
  structure_info,
  model_source,
  created_at
FROM public.predictions;

GRANT SELECT ON public.prediction_history TO authenticated;
