-- PulseIQ — Supabase Database Schema
-- Run this in your Supabase SQL editor to create all required tables.
-- RLS (Row Level Security) is enabled on all tables so users can only see their own data.

-- ────────────────────────────────────────────────────────────────────────────
-- profiles (extends Supabase auth.users)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  company_name TEXT,
  industry TEXT,
  role TEXT,
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own profile"
  ON profiles FOR ALL USING (auth.uid() = id);

-- ────────────────────────────────────────────────────────────────────────────
-- data_files
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  row_count INTEGER,
  column_mapping JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE data_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own files"
  ON data_files FOR ALL USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- inventory_items
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT,
  category TEXT,
  warehouse_name TEXT,
  current_stock INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 0,
  daily_avg_demand FLOAT DEFAULT 0,
  days_left FLOAT,
  status TEXT CHECK (status IN ('optimal', 'low_stock', 'stockout', 'overstock')) DEFAULT 'optimal',
  abc_category TEXT CHECK (abc_category IN ('A', 'B', 'C')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own inventory"
  ON inventory_items FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_user_status ON inventory_items(user_id, status);

-- ────────────────────────────────────────────────────────────────────────────
-- warehouses
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  total_skus INTEGER DEFAULT 0,
  stockouts INTEGER DEFAULT 0,
  fill_rate FLOAT DEFAULT 100,
  status TEXT CHECK (status IN ('good', 'warning', 'critical')) DEFAULT 'good',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own warehouses"
  ON warehouses FOR ALL USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- alerts
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')) NOT NULL,
  message TEXT NOT NULL,
  sku TEXT,
  warehouse TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own alerts"
  ON alerts FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_resolved ON alerts(user_id, is_resolved);

-- ────────────────────────────────────────────────────────────────────────────
-- contracts
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contract_name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  value FLOAT,
  status TEXT CHECK (status IN ('active', 'pending', 'expired', 'expiring_soon', 'cancelled')) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own contracts"
  ON contracts FOR ALL USING (auth.uid() = created_by);

-- ────────────────────────────────────────────────────────────────────────────
-- demand_history  (populated by data upload processing)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demand_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  sku TEXT,
  product_name TEXT,
  units INTEGER DEFAULT 0,
  forecast INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE demand_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own demand history"
  ON demand_history FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_demand_user_date ON demand_history(user_id, date);

-- ────────────────────────────────────────────────────────────────────────────
-- chat_sessions
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own chat sessions"
  ON chat_sessions FOR ALL USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- chat_messages
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own chat messages"
  ON chat_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
        AND chat_sessions.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- user_logins (optional — for analytics)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  company_name TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_logins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own login records"
  ON user_logins FOR SELECT USING (auth.uid() = user_id);
