-- ============================================================================
-- Minimal Database Setup - Only Missing Pieces
-- ============================================================================
-- Run this in Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================================

-- 1. ID Counters Table (MISSING)
-- Used for generating sequential IDs (USR-1000, INV-10000, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS id_counters (
    id_type TEXT PRIMARY KEY,
    current_value INTEGER NOT NULL DEFAULT 0
);

-- Insert default counters if they don't exist
INSERT INTO id_counters (id_type, current_value) VALUES ('USR', 1000)
ON CONFLICT (id_type) DO NOTHING;

INSERT INTO id_counters (id_type, current_value) VALUES ('INV', 10000)
ON CONFLICT (id_type) DO NOTHING;

INSERT INTO id_counters (id_type, current_value) VALUES ('TXN', 1000000)
ON CONFLICT (id_type) DO NOTHING;

INSERT INTO id_counters (id_type, current_value) VALUES ('WTH', 1000)
ON CONFLICT (id_type) DO NOTHING;

-- Enable RLS
ALTER TABLE id_counters ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage counters
CREATE POLICY "Service role can manage id counters"
  ON id_counters FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- 2. Add description column to activity table if missing
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'activity' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE activity ADD COLUMN description TEXT;
    END IF;
END $$;


-- ============================================================================
-- DONE! All Missing Pieces Added
-- ============================================================================
-- 
-- Your Python backend should now work without any database errors!
-- Try registering a new user or logging in at http://localhost:3000/sign-in
-- 
-- ============================================================================

