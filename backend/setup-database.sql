-- ============================================================================
-- Robert Ventures InvestorDesk - Database Setup
-- ============================================================================
-- Run this SQL in Supabase SQL Editor to create all required tables
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================================

-- 1. ID Counters Table
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


-- 2. Pending Users Table
-- For temporary user registration storage (before email verification)
-- ============================================================================
CREATE TABLE IF NOT EXISTS pending_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  hashed_password TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pending_users_email ON pending_users(email);
CREATE INDEX IF NOT EXISTS idx_pending_users_created_at ON pending_users(created_at);

-- Enable RLS
ALTER TABLE pending_users ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage pending users
CREATE POLICY "Service role can manage pending users"
  ON pending_users FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- 3. Fix Activity Table (add missing 'description' column if needed)
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
-- DONE! All Required Tables Created
-- ============================================================================
-- 
-- Next Steps:
-- 1. Your Python backend should now work without database errors
-- 2. Try registering a new user at http://localhost:3000
-- 3. Check the Python backend logs to verify no more database errors
-- 
-- ============================================================================

