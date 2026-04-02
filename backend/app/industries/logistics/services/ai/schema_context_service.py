"""
Schema context for text-to-SQL LLM.
Adapted from logistics-ai-main: table names updated to lg_* with user_id scoping.
All business logic definitions and join patterns preserved exactly.
"""
import logging

logger = logging.getLogger(__name__)

# NOTE: All tables are prefixed lg_* and have a user_id column for row-level security.
# When generating SQL, ALWAYS filter by user_id = :user_id in every query.

SCHEMA_CONTEXT = """
=====================================================
LOGISTICS PLATFORM — DATABASE SCHEMA (lg_* tables)
=====================================================
IMPORTANT: Every table has a user_id column. ALL queries MUST include WHERE user_id = :user_id

TABLE: lg_shipments (PRIMARY TABLE)
  user_id             UUID (REQUIRED filter)
  shipment_id         UUID PRIMARY KEY
  route_id            FK -> lg_routes.route_id
  origin_city         VARCHAR
  origin_state        VARCHAR
  origin_pincode      VARCHAR
  destination_city    VARCHAR
  destination_state   VARCHAR
  destination_pincode VARCHAR
  shipment_value      NUMERIC  -- monetary value of goods
  currency_code       VARCHAR
  dispatch_datetime   TIMESTAMP
  delivery_deadline   TIMESTAMP
  actual_delivery_datetime TIMESTAMP  -- NULL if not yet delivered
  vendor_id           FK -> lg_vendors.vendor_id
  driver_id           FK -> lg_drivers.driver_id
  truck_id            FK -> lg_trucks.truck_id
  shipment_status     VARCHAR  -- CREATED | DISPATCHED | IN_TRANSIT | DELIVERED | DELAYED | CANCELLED
  created_at          TIMESTAMP

TABLE: lg_vendors
  user_id             UUID (REQUIRED filter)
  vendor_id           VARCHAR PRIMARY KEY
  vendor_name         VARCHAR
  vendor_status       VARCHAR  -- ACTIVE | SUSPENDED | BLACKLISTED
  contract_start_date DATE
  contract_end_date   DATE
  !! IMPORTANT: This table has NO performance columns. Use lg_vendor_performance_metrics.

TABLE: lg_vendor_performance_metrics
  user_id                 UUID (REQUIRED filter)
  vendor_id               FK -> lg_vendors.vendor_id
  calculation_date        DATE
  performance_window      VARCHAR  -- '30D' | '90D' | 'LIFETIME'
  PRIMARY KEY: (user_id, vendor_id, calculation_date, performance_window)
  total_shipments         INTEGER
  on_time_shipments       INTEGER
  delayed_shipments       INTEGER
  claim_count             INTEGER
  on_time_percentage      NUMERIC  -- 0 to 100
  delay_rate_percentage   NUMERIC  -- 0 to 100
  claim_ratio_percentage  NUMERIC  -- 0 to 100
  !! NOTE: Always filter performance_window = '30D' unless user specifies otherwise.

TABLE: lg_drivers
  user_id             UUID (REQUIRED filter)
  driver_id           VARCHAR PRIMARY KEY
  driver_name         VARCHAR
  license_number      VARCHAR
  license_expiry_date DATE
  driver_status       VARCHAR  -- ACTIVE | SUSPENDED | INACTIVE
  !! IMPORTANT: This table has NO incident columns. Use lg_driver_incidents.

TABLE: lg_driver_incidents
  user_id             UUID (REQUIRED filter)
  incident_id         VARCHAR PRIMARY KEY
  driver_id           FK -> lg_drivers.driver_id
  shipment_id         FK -> lg_shipments.shipment_id (NULLABLE)
  incident_type       VARCHAR
  incident_severity   VARCHAR  -- LOW | MEDIUM | HIGH
  incident_date       DATE

TABLE: lg_trucks
  user_id                   UUID (REQUIRED filter)
  truck_id                  VARCHAR PRIMARY KEY
  truck_number              VARCHAR UNIQUE
  insurance_expiry_date     DATE
  fitness_expiry_date       DATE
  registration_expiry_date  DATE
  vehicle_type              VARCHAR  -- 20FT | 32FT | TRAILER | CONTAINER | LCV | MXL
  truck_capacity_weight     NUMERIC
  truck_capacity_volume     NUMERIC
  truck_status              VARCHAR  -- ACTIVE | IN_MAINTENANCE | INACTIVE

TABLE: lg_shipment_financials
  user_id                   UUID (REQUIRED filter)
  shipment_id               UUID PRIMARY KEY, FK -> lg_shipments.shipment_id
  declared_value            NUMERIC
  insurance_coverage_value  NUMERIC
  expected_margin           NUMERIC

TABLE: lg_shipment_risk_snapshots
  user_id                   UUID (REQUIRED filter)
  shipment_id               UUID PRIMARY KEY, FK -> lg_shipments.shipment_id
  compliance_risk_score     NUMERIC  -- 0 to 100
  vendor_risk_score         NUMERIC  -- 0 to 100
  operational_risk_score    NUMERIC  -- 0 to 100
  financial_exposure_score  NUMERIC  -- 0 to 100
  overall_risk_score        NUMERIC  -- 0 to 100
  risk_category             VARCHAR  -- LOW | MEDIUM | HIGH
  alert_generated           BOOLEAN
  alert_type                VARCHAR
  estimated_financial_impact NUMERIC
  calculated_at             TIMESTAMP
  model_version             VARCHAR
  !! HIGH = overall_risk_score >= 80 OR risk_category = 'HIGH'
  !! MEDIUM = overall_risk_score >= 60 AND < 80
  !! LOW = overall_risk_score < 60

TABLE: lg_risk_weight_configuration
  user_id             UUID (REQUIRED filter)
  compliance_weight   NUMERIC
  vendor_weight       NUMERIC
  operational_weight  NUMERIC
  financial_weight    NUMERIC
  effective_from      DATE
  effective_to        DATE  -- NULL means this row is currently active

TABLE: lg_shipment_cost_planning_actuals
  user_id                        UUID (REQUIRED filter)
  shipment_id                    UUID PRIMARY KEY
  planned_transport_cost         NUMERIC
  actual_transport_cost          NUMERIC
  distance_km                    NUMERIC
  detention_cost                 NUMERIC
  penalty_cost                   NUMERIC
  cost_variance                  NUMERIC  -- actual minus planned
  cost_variance_percentage       NUMERIC
  market_volatility_index        NUMERIC  -- 0 to 100
  market_capacity_shortage_index NUMERIC  -- 0 to 100

TABLE: lg_market_freight_intelligence
  user_id                     UUID (REQUIRED filter)
  route_id                    FK -> lg_routes.route_id
  vehicle_type                VARCHAR
  date                        DATE
  PRIMARY KEY: (user_id, route_id, vehicle_type, date)
  average_market_rate_per_km  NUMERIC
  volatility_index            NUMERIC  -- 0 to 100
  capacity_shortage_index     NUMERIC  -- 0 to 100

TABLE: lg_routes
  user_id             UUID (REQUIRED filter)
  route_id            VARCHAR PRIMARY KEY
  origin_city         VARCHAR
  origin_state        VARCHAR
  destination_city    VARCHAR
  destination_state   VARCHAR
  distance_km         NUMERIC

=====================================================
BUSINESS LOGIC DEFINITIONS
=====================================================

EXPIRED DOCUMENT:     expiry_date < CURRENT_DATE
EXPIRING SOON:        expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'

HIGH RISK VENDOR:     delay_rate_percentage > 30 in lg_vendor_performance_metrics (performance_window = '30D')
LOW PERFORMING VENDOR: on_time_percentage < 70

HIGH RISK SHIPMENT:   risk_category = 'HIGH' in lg_shipment_risk_snapshots (score >= 80)
MEDIUM RISK SHIPMENT: risk_category = 'MEDIUM' (score >= 60)

COST OVERRUN:         actual_transport_cost > planned_transport_cost
DELAYED SHIPMENT:     shipment_status = 'DELAYED'

=====================================================
JOIN PATTERNS
=====================================================

-- shipments + vendor name:
FROM lg_shipments s
JOIN lg_vendors v ON s.vendor_id = v.vendor_id AND v.user_id = :user_id
WHERE s.user_id = :user_id

-- shipments + vendor performance:
FROM lg_shipments s
JOIN lg_vendor_performance_metrics vpm ON vpm.vendor_id = s.vendor_id AND vpm.performance_window = '30D' AND vpm.user_id = :user_id
WHERE s.user_id = :user_id

-- shipments + risk scores:
FROM lg_shipments s
JOIN lg_shipment_risk_snapshots srs ON srs.shipment_id = s.shipment_id AND srs.user_id = :user_id
WHERE s.user_id = :user_id

-- drivers + incidents:
FROM lg_drivers d
JOIN lg_driver_incidents di ON di.driver_id = d.driver_id AND di.user_id = :user_id
WHERE d.user_id = :user_id

-- trucks compliance:
FROM lg_trucks t
WHERE t.user_id = :user_id

-- routes + market intelligence:
FROM lg_routes r
JOIN lg_market_freight_intelligence mfi ON mfi.route_id = r.route_id AND mfi.user_id = :user_id
WHERE r.user_id = :user_id
"""
