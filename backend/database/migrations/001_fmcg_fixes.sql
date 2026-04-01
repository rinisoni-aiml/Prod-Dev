-- ============================================================================
-- Migration 001: FMCG fixes
-- Run this in Supabase SQL Editor if you have an EXISTING database.
-- (The full schema.sql already includes these — only run this if you're
--  upgrading an existing installation without wiping tables.)
-- ============================================================================

-- 1. Allow inventory_items.current_stock to be NULL
--    (Previously DEFAULT 0 implied no NULL, but DEFAULT doesn't block NULLs.
--     This is informational — no ALTER needed since column is already nullable.)

-- 2. Add indexes missing from original schema
CREATE INDEX IF NOT EXISTS idx_inventory_user_id   ON inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_user_id  ON warehouses(user_id);
CREATE INDEX IF NOT EXISTS idx_data_files_user_id  ON data_files(user_id);
CREATE INDEX IF NOT EXISTS idx_demand_user_sku     ON demand_history(user_id, sku);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);

-- 3. Ensure demand_history.forecast column exists
--    (some older installs may be missing it — safe to run multiple times)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'demand_history' AND column_name = 'forecast'
  ) THEN
    ALTER TABLE demand_history ADD COLUMN forecast INTEGER;
  END IF;
END $$;

-- 4. Ensure optimization_runs table exists with correct schema
CREATE TABLE IF NOT EXISTS optimization_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  file_id           TEXT,
  params            JSONB,
  summary           JSONB,
  by_sku            JSONB,
  by_warehouse      JSONB,
  has_warehouse_data BOOLEAN DEFAULT FALSE,
  has_stock_data    BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE optimization_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'optimization_runs'
      AND policyname = 'Users can manage own optimization runs'
  ) THEN
    CREATE POLICY "Users can manage own optimization runs"
      ON optimization_runs FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Ensure chat_messages RLS policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_messages'
      AND policyname = 'Users can manage own chat messages'
  ) THEN
    CREATE POLICY "Users can manage own chat messages"
      ON chat_messages FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM chat_sessions
          WHERE chat_sessions.id = chat_messages.session_id
            AND chat_sessions.user_id = auth.uid()
        )
      );
  END IF;
END $$;
