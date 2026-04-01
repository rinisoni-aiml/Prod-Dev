-- ============================================================================
-- Migration 002: FMCG sample data cache
-- Stores pre-computed ML results for the "Load Sample Data" feature.
-- Run this in Supabase SQL Editor if you have an EXISTING database.
-- (The full schema.sql should be updated separately for fresh installs.)
-- ============================================================================

-- 1. Create the sample cache table (system-level, no user_id column)
CREATE TABLE IF NOT EXISTS fmcg_sample_cache (
  run_id           TEXT PRIMARY KEY,
  demand_data      JSONB,   -- array of {date, sku, units, forecast?} rows (no user_id)
  inventory_result JSONB,   -- {by_sku: [...], by_warehouse: [...], summary: {...}}
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS (backend uses service role key which bypasses RLS automatically)
ALTER TABLE fmcg_sample_cache ENABLE ROW LEVEL SECURITY;
-- No user-facing SELECT policy — all access is via service role key in the backend
