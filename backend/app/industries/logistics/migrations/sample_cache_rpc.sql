-- ─── Logistics Sample Cache RPC ───────────────────────────────────────────────
-- Run this ONCE in Supabase Dashboard → SQL Editor.
-- After running, call POST /api/logistics/v1/upload/admin/init-sample-cache
-- (once) to populate the system user's rows from the bundled Excel files.
-- Subsequent calls to POST /api/logistics/v1/upload/sample will use this RPC
-- to copy data server-side in ~2 seconds for every new user.
--
-- System user ID: 00000000-0000-0000-0000-000000000000

CREATE OR REPLACE FUNCTION lg_copy_sample_to_user(p_uid TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sys CONSTANT TEXT := '00000000-0000-0000-0000-000000000000';
BEGIN

  -- 1. Routes
  INSERT INTO lg_routes (
    user_id, route_id, origin_city, origin_state,
    destination_city, destination_state, distance_km
  )
  SELECT p_uid, route_id, origin_city, origin_state,
         destination_city, destination_state, distance_km
  FROM lg_routes WHERE user_id = v_sys
  ON CONFLICT (user_id, route_id) DO NOTHING;

  -- 2. Vendors
  INSERT INTO lg_vendors (
    user_id, vendor_id, vendor_name, vendor_status,
    contract_start_date, contract_end_date
  )
  SELECT p_uid, vendor_id, vendor_name, vendor_status,
         contract_start_date, contract_end_date
  FROM lg_vendors WHERE user_id = v_sys
  ON CONFLICT (user_id, vendor_id) DO NOTHING;

  -- 3. Drivers
  INSERT INTO lg_drivers (
    user_id, driver_id, driver_name, license_number,
    license_expiry_date, driver_status
  )
  SELECT p_uid, driver_id, driver_name, license_number,
         license_expiry_date, driver_status
  FROM lg_drivers WHERE user_id = v_sys
  ON CONFLICT (user_id, driver_id) DO NOTHING;

  -- 4. Trucks
  INSERT INTO lg_trucks (
    user_id, truck_id, truck_number, insurance_expiry_date,
    fitness_expiry_date, registration_expiry_date, vehicle_type,
    truck_capacity_weight, truck_capacity_volume, truck_status
  )
  SELECT p_uid, truck_id, truck_number, insurance_expiry_date,
         fitness_expiry_date, registration_expiry_date, vehicle_type,
         truck_capacity_weight, truck_capacity_volume, truck_status
  FROM lg_trucks WHERE user_id = v_sys
  ON CONFLICT (user_id, truck_id) DO NOTHING;

  -- 5. Shipments
  INSERT INTO lg_shipments (
    user_id, shipment_id, route_id, origin_city, origin_state,
    origin_pincode, destination_city, destination_state, destination_pincode,
    shipment_value, currency_code, dispatch_datetime, delivery_deadline,
    actual_delivery_datetime, vendor_id, vendor_name, driver_id,
    truck_id, shipment_status
  )
  SELECT p_uid, shipment_id, route_id, origin_city, origin_state,
         origin_pincode, destination_city, destination_state, destination_pincode,
         shipment_value, currency_code, dispatch_datetime, delivery_deadline,
         actual_delivery_datetime, vendor_id, vendor_name, driver_id,
         truck_id, shipment_status
  FROM lg_shipments WHERE user_id = v_sys
  ON CONFLICT (user_id, shipment_id) DO NOTHING;

  -- 6. Vendor Performance Metrics
  INSERT INTO lg_vendor_performance_metrics (
    user_id, vendor_id, calculation_date, total_shipments,
    on_time_shipments, delayed_shipments, claim_count,
    on_time_percentage, delay_rate_percentage, claim_ratio_percentage,
    performance_window
  )
  SELECT p_uid, vendor_id, calculation_date, total_shipments,
         on_time_shipments, delayed_shipments, claim_count,
         on_time_percentage, delay_rate_percentage, claim_ratio_percentage,
         performance_window
  FROM lg_vendor_performance_metrics WHERE user_id = v_sys
  ON CONFLICT (user_id, vendor_id, calculation_date, performance_window) DO NOTHING;

  -- 7. Driver Incidents
  INSERT INTO lg_driver_incidents (
    user_id, incident_id, driver_id, incident_type,
    incident_severity, incident_date, shipment_id
  )
  SELECT p_uid, incident_id, driver_id, incident_type,
         incident_severity, incident_date, shipment_id
  FROM lg_driver_incidents WHERE user_id = v_sys
  ON CONFLICT (user_id, incident_id) DO NOTHING;

  -- 8. Shipment Financials
  INSERT INTO lg_shipment_financials (
    user_id, shipment_id, declared_value,
    insurance_coverage_value, expected_margin
  )
  SELECT p_uid, shipment_id, declared_value,
         insurance_coverage_value, expected_margin
  FROM lg_shipment_financials WHERE user_id = v_sys
  ON CONFLICT (user_id, shipment_id) DO NOTHING;

  -- 9. Shipment Cost Planning Actuals
  INSERT INTO lg_shipment_cost_planning_actuals (
    user_id, shipment_id, planned_transport_cost, planned_rate_per_km,
    planned_no_of_trucks, actual_transport_cost, actual_rate_per_km,
    actual_no_of_trucks, distance_km, detention_cost, penalty_cost,
    fuel_surcharge_cost, toll_cost, total_actual_cost,
    cost_variance, cost_variance_percentage
  )
  SELECT p_uid, shipment_id, planned_transport_cost, planned_rate_per_km,
         planned_no_of_trucks, actual_transport_cost, actual_rate_per_km,
         actual_no_of_trucks, distance_km, detention_cost, penalty_cost,
         fuel_surcharge_cost, toll_cost, total_actual_cost,
         cost_variance, cost_variance_percentage
  FROM lg_shipment_cost_planning_actuals WHERE user_id = v_sys
  ON CONFLICT (user_id, shipment_id) DO NOTHING;

  -- 10. Market Freight Intelligence
  INSERT INTO lg_market_freight_intelligence (
    user_id, route_id, vehicle_type, date,
    average_market_rate_per_km, high_market_rate_per_km,
    low_market_rate_per_km, volatility_index, capacity_shortage_index
  )
  SELECT p_uid, route_id, vehicle_type, date,
         average_market_rate_per_km, high_market_rate_per_km,
         low_market_rate_per_km, volatility_index, capacity_shortage_index
  FROM lg_market_freight_intelligence WHERE user_id = v_sys
  ON CONFLICT (user_id, route_id, vehicle_type, date) DO NOTHING;

  -- 11. Shipment Risk Snapshots
  INSERT INTO lg_shipment_risk_snapshots (
    user_id, shipment_id, compliance_risk_score, vendor_risk_score,
    operational_risk_score, financial_exposure_score, overall_risk_score,
    risk_category, alert_generated, alert_severity, alert_type,
    explanation, recommendation, category
  )
  SELECT p_uid, shipment_id, compliance_risk_score, vendor_risk_score,
         operational_risk_score, financial_exposure_score, overall_risk_score,
         risk_category, alert_generated, alert_severity, alert_type,
         explanation, recommendation, category
  FROM lg_shipment_risk_snapshots WHERE user_id = v_sys
  ON CONFLICT (user_id, shipment_id) DO NOTHING;

  -- 12. Risk Weight Configuration
  INSERT INTO lg_risk_weight_configuration (
    user_id, config_id, compliance_weight, vendor_weight,
    operational_weight, financial_weight, effective_from, effective_to
  )
  SELECT p_uid, config_id, compliance_weight, vendor_weight,
         operational_weight, financial_weight, effective_from, effective_to
  FROM lg_risk_weight_configuration WHERE user_id = v_sys
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'uid', p_uid);
END;
$$;
