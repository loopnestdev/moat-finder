-- ============================================================
-- Auto-create moat.users row on first OAuth / email login
-- Run this in the coredb Supabase Dashboard → SQL Editor
-- Safe to re-run: uses CREATE OR REPLACE + DROP IF EXISTS.
-- ============================================================

-- ── Trigger function ─────────────────────────────────────────
-- Fires after a new row is inserted into auth.users (i.e. first
-- sign-up / first OAuth login). Creates the corresponding
-- moat.users profile with role='pending'.
-- Admins must manually UPDATE role='admin' or 'approved' via
-- the Supabase dashboard or admin API.
CREATE OR REPLACE FUNCTION moat.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- runs as the definer (postgres), not the caller
SET search_path = moat    -- prevents search_path injection
AS $$
BEGIN
  INSERT INTO moat.users (id, email, display_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotent — no-op if row already exists
  RETURN NEW;
END;
$$;

-- ── Trigger on auth.users ─────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION moat.handle_new_auth_user();
