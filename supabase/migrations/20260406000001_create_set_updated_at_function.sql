-- Auto-update updated_at columns
CREATE OR REPLACE FUNCTION moatfinder_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
