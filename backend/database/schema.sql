-- PulseIQ — Supabase Database Schema
-- Run this in your Supabase SQL editor to create all required tables.
-- Safe to re-run: drops all tables first, then recreates from scratch.
-- RLS (Row Level Security) is enabled on all tables.

-- ────────────────────────────────────────────────────────────────────────────
-- Drop all tables (order matters for FK constraints)
-- ────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS optimization_runs CASCADE;
DROP TABLE IF EXISTS user_logins CASCADE;
DROP TABLE IF EXISTS demand_history CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS data_files CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- profiles (extends Supabase auth.users)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE profiles (
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
CREATE TABLE data_files (
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
CREATE TABLE inventory_items (
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
CREATE INDEX idx_inventory_user_status ON inventory_items(user_id, status);

-- ────────────────────────────────────────────────────────────────────────────
-- warehouses
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE warehouses (
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
CREATE TABLE alerts (
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
CREATE INDEX idx_alerts_user_resolved ON alerts(user_id, is_resolved);

-- ────────────────────────────────────────────────────────────────────────────
-- contracts
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE contracts (
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
-- demand_history  (populated by forecast pipeline)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE demand_history (
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
CREATE INDEX idx_demand_user_date ON demand_history(user_id, date);

-- ────────────────────────────────────────────────────────────────────────────
-- chat_sessions
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE chat_sessions (
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
CREATE TABLE chat_messages (
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
-- optimization_runs: stores the latest full inventory optimization result per user
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE optimization_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  file_id TEXT,
  params JSONB,
  summary JSONB,
  by_sku JSONB,
  by_warehouse JSONB,
  has_warehouse_data BOOLEAN DEFAULT FALSE,
  has_stock_data BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE optimization_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own optimization runs"
  ON optimization_runs FOR ALL USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- user_logins (optional — for analytics)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE user_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  company_name TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_logins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own login records"
  ON user_logins FOR SELECT USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- LOGISTICS INDUSTRY TABLES (lg_ prefix, all scoped by user_id)
-- Run after initial schema creation, or include in initial run.
-- ────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS lg_shipment_risk_snapshots CASCADE;
DROP TABLE IF EXISTS lg_market_freight_intelligence CASCADE;
DROP TABLE IF EXISTS lg_shipment_cost_planning_actuals CASCADE;
DROP TABLE IF EXISTS lg_shipment_financials CASCADE;
DROP TABLE IF EXISTS lg_driver_incidents CASCADE;
DROP TABLE IF EXISTS lg_vendor_performance_metrics CASCADE;
DROP TABLE IF EXISTS lg_shipments CASCADE;
DROP TABLE IF EXISTS lg_trucks CASCADE;
DROP TABLE IF EXISTS lg_drivers CASCADE;
DROP TABLE IF EXISTS lg_vendors CASCADE;
DROP TABLE IF EXISTS lg_routes CASCADE;
DROP TABLE IF EXISTS lg_risk_weight_configuration CASCADE;
DROP TABLE IF EXISTS lg_chat_messages CASCADE;

-- lg_routes
CREATE TABLE lg_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id INTEGER,
  origin_city TEXT,
  origin_state TEXT,
  destination_city TEXT,
  destination_state TEXT,
  distance_km NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, route_id)
);
ALTER TABLE lg_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lg_routes" ON lg_routes FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_lg_routes_user ON lg_routes(user_id);

-- lg_vendors
CREATE TABLE lg_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id TEXT,
  vendor_name TEXT,
  vendor_status TEXT DEFAULT 'ACTIVE',
  contract_start_date DATE,
  contract_end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, vendor_id)
);
ALTER TABLE lg_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lg_vendors" ON lg_vendors FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_lg_vendors_user ON lg_vendors(user_id);

-- lg_drivers
CREATE TABLE lg_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id TEXT,
  driver_name TEXT,
  license_number TEXT,
  license_expiry_date DATE,
  driver_status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, driver_id)
);
ALTER TABLE lg_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lg_drivers" ON lg_drivers FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_lg_drivers_user ON lg_drivers(user_id);

-- lg_trucks
CREATE TABLE lg_trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  truck_id TEXT,
  truck_number TEXT,
  insurance_expiry_date DATE,
  fitness_expiry_date DATE,
  registration_expiry_date DATE,
  vehicle_type TEXT,
  truck_capacity_weight NUMERIC(10,2),
  truck_capacity_volume NUMERIC(10,2),
  truck_status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, truck_id)
);
ALTER TABLE lg_trucks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lg_trucks" ON lg_trucks FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_lg_trucks_user ON lg_trucks(user_id);

-- lg_shipments
CREATE TABLE lg_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shipment_id TEXT,
  route_id INTEGER,
  origin_city TEXT,
  origin_state TEXT,
  origin_pincode TEXT,
  destination_city TEXT,
  destination_state TEXT,
  destination_pincode TEXT,
  shipment_value NUMERIC(15,2),
  currency_code TEXT DEFAULT 'INR',
  dispatch_datetime TIMESTAMPTZ,
  delivery_deadline TIMESTAMPTZ,
  actual_delivery_datetime TIMESTAMPTZ,
  vendor_id TEXT,
  vendor_name TEXT,
  driver_id TEXT,
  truck_id TEXT,
  shipment_status TEXT DEFAULT 'CREATED',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, shipment_id)
);
ALTER TABLE lg_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lg_shipments" ON lg_shipments FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_lg_shipments_user ON lg_shipments(user_id);
CREATE INDEX idx_lg_shipments_status ON lg_shipments(user_id, shipment_status);

-- lg_vendor_performance_metrics
CREATE TABLE lg_vendor_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id TEXT,
  calculation_date DATE,
  total_shipments INTEGER,
  on_time_shipments INTEGER,
  delayed_shipments INTEGER,
  claim_count INTEGER,
  on_time_percentage NUMERIC(5,2),
  delay_rate_percentage NUMERIC(5,2),
  claim_ratio_percentage NUMERIC(5,2),
  performance_window TEXT DEFAULT '30D',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, vendor_id, calculation_date, performance_window)
);
ALTER TABLE lg_vendor_performance_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lg_vendor_performance_metrics" ON lg_vendor_performance_metrics FOR ALL USING (auth.uid() = user_id);

-- lg_driver_incidents
CREATE TABLE lg_driver_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  incident_id TEXT,
  driver_id TEXT,
  incident_type TEXT,
  incident_severity TEXT DEFAULT 'LOW',
  incident_date DATE,
  shipment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, incident_id)
);
ALTER TABLE lg_driver_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lg_driver_incidents" ON lg_driver_incidents FOR ALL USING (auth.uid() = user_id);

-- lg_shipment_financials
CREATE TABLE lg_shipment_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shipment_id TEXT,
  declared_value NUMERIC(15,2),
  insurance_coverage_value NUMERIC(15,2),
  expected_margin NUMERIC(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, shipment_id)
);
ALTER TABLE lg_shipment_financials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lg_shipment_financials" ON lg_shipment_financials FOR ALL USING (auth.uid() = user_id);

-- lg_shipment_cost_planning_actuals
CREATE TABLE lg_shipment_cost_planning_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shipment_id TEXT,
  planned_transport_cost NUMERIC(15,2),
  planned_rate_per_km NUMERIC(10,2),
  planned_no_of_trucks INTEGER,
  actual_transport_cost NUMERIC(15,2),
  actual_rate_per_km NUMERIC(10,2),
  actual_no_of_trucks INTEGER,
  distance_km NUMERIC(10,2),
  detention_cost NUMERIC(15,2) DEFAULT 0,
  penalty_cost NUMERIC(15,2) DEFAULT 0,
  fuel_surcharge_cost NUMERIC(15,2) DEFAULT 0,
  toll_cost NUMERIC(15,2) DEFAULT 0,
  loading_unloading_cost NUMERIC(15,2) DEFAULT 0,
  other_additional_cost NUMERIC(15,2) DEFAULT 0,
  total_additional_cost NUMERIC(15,2),
  total_actual_cost NUMERIC(15,2),
  cost_variance NUMERIC(15,2),
  cost_variance_percentage NUMERIC(6,2),
  market_avg_rate_per_km NUMERIC(10,2),
  market_volatility_index NUMERIC(5,2),
  market_capacity_shortage_index NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, shipment_id)
);
ALTER TABLE lg_shipment_cost_planning_actuals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lg_shipment_cost_planning_actuals" ON lg_shipment_cost_planning_actuals FOR ALL USING (auth.uid() = user_id);

-- lg_market_freight_intelligence
CREATE TABLE lg_market_freight_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id INTEGER,
  vehicle_type TEXT,
  date DATE,
  average_market_rate_per_km NUMERIC(10,2),
  high_market_rate_per_km NUMERIC(10,2),
  low_market_rate_per_km NUMERIC(10,2),
  volatility_index NUMERIC(5,2),
  capacity_shortage_index NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, route_id, vehicle_type, date)
);
ALTER TABLE lg_market_freight_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lg_market_freight_intelligence" ON lg_market_freight_intelligence FOR ALL USING (auth.uid() = user_id);

-- lg_shipment_risk_snapshots
CREATE TABLE lg_shipment_risk_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shipment_id TEXT,
  compliance_risk_score NUMERIC(5,2),
  vendor_risk_score NUMERIC(5,2),
  operational_risk_score NUMERIC(5,2),
  financial_exposure_score NUMERIC(5,2),
  overall_risk_score NUMERIC(5,2),
  risk_category TEXT DEFAULT 'LOW',
  alert_generated BOOLEAN DEFAULT FALSE,
  alert_severity TEXT DEFAULT 'low',
  alert_type TEXT,
  explanation TEXT,
  recommendation TEXT,
  category TEXT,
  estimated_financial_impact NUMERIC(15,2),
  resolved_at TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  model_version TEXT DEFAULT 'v1.0',
  UNIQUE(user_id, shipment_id)
);
ALTER TABLE lg_shipment_risk_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lg_shipment_risk_snapshots" ON lg_shipment_risk_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_lg_risk_snapshots_user ON lg_shipment_risk_snapshots(user_id);
CREATE INDEX idx_lg_risk_snapshots_severity ON lg_shipment_risk_snapshots(user_id, alert_severity);

-- lg_risk_weight_configuration
CREATE TABLE lg_risk_weight_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config_id TEXT,
  compliance_weight NUMERIC(5,2) DEFAULT 25.00,
  vendor_weight NUMERIC(5,2) DEFAULT 25.00,
  operational_weight NUMERIC(5,2) DEFAULT 25.00,
  financial_weight NUMERIC(5,2) DEFAULT 25.00,
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE lg_risk_weight_configuration ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lg_risk_weight_configuration" ON lg_risk_weight_configuration FOR ALL USING (auth.uid() = user_id);

-- lg_chat_messages (Logistics AI assistant chat history)
CREATE TABLE IF NOT EXISTS lg_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE lg_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lg_chat_messages" ON lg_chat_messages FOR ALL USING (auth.uid() = user_id);
