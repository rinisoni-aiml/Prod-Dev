"""
Database module: SQLAlchemy engine, session management, connection pooling.
All DDL (CREATE TABLE) is managed here via create_all().

Production-safe: schema reset is DISABLED in non-development environments.
DATABASE_URL is optional — if not set, DB features are gracefully unavailable.
"""
from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from typing import Generator, Optional

from dotenv import load_dotenv
import pandas as pd
from sqlalchemy import (
    BigInteger, Boolean, Column, Date, DateTime, Enum, ForeignKey,
    Integer, Numeric, String, Text, create_engine, text, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import QueuePool
import uuid

load_dotenv()
logger = logging.getLogger(__name__)

# ─── Environment Detection ─────────────────────────────────────────────────────

APP_ENV = os.getenv("APP_ENV", "production").strip().lower()
IS_DEVELOPMENT = APP_ENV == "development"

DATABASE_URL = os.getenv("DATABASE_URL")
_DB_AVAILABLE = bool(DATABASE_URL)

logger.info(f"Starting in APP_ENV={APP_ENV!r} | Schema reset: {'ENABLED' if IS_DEVELOPMENT else 'DISABLED'}")

if not _DB_AVAILABLE:
    logger.warning("DATABASE_URL not set — logistics database features will be unavailable")


# ─── ORM Base ─────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


# ─── ORM Models ───────────────────────────────────────────────────────────────

class Route(Base):
    __tablename__ = "routes"
    route_id = Column(Integer, primary_key=True)
    origin_city = Column(String(100), nullable=False)
    origin_state = Column(String(100), nullable=False)
    destination_city = Column(String(100), nullable=False)
    destination_state = Column(String(100), nullable=False)
    distance_km = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))


class Vendor(Base):
    __tablename__ = "vendors"
    vendor_id = Column(String(100), primary_key=True)
    vendor_name = Column(String(255), nullable=False)
    vendor_status = Column(
        Enum("ACTIVE", "SUSPENDED", "BLACKLISTED", name="vendor_status_enum"),
        default="ACTIVE"
    )
    contract_start_date = Column(Date, nullable=True)
    contract_end_date = Column(Date, nullable=True)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))


class VendorPerformanceMetric(Base):
    __tablename__ = "vendor_performance_metrics"
    vendor_id = Column(String(100), ForeignKey("vendors.vendor_id"), primary_key=True)
    calculation_date = Column(Date, primary_key=True)
    total_shipments = Column(Integer, nullable=True)
    on_time_shipments = Column(Integer, nullable=True)
    delayed_shipments = Column(Integer, nullable=True)
    claim_count = Column(Integer, nullable=True)
    on_time_percentage = Column(Numeric(5, 2), nullable=True)
    delay_rate_percentage = Column(Numeric(5, 2), nullable=True)
    claim_ratio_percentage = Column(Numeric(5, 2), nullable=True)
    performance_window = Column(
        Enum("30D", "90D", "LIFETIME", name="perf_window_enum"), primary_key=True
    )


class Driver(Base):
    __tablename__ = "drivers"
    driver_id = Column(String(100), primary_key=True)
    driver_name = Column(String(255), nullable=False)
    license_number = Column(String(50), nullable=False)
    license_expiry_date = Column(Date, nullable=True)
    driver_status = Column(
        Enum("ACTIVE", "SUSPENDED", "INACTIVE", name="driver_status_enum"),
        default="ACTIVE"
    )
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))


class Truck(Base):
    __tablename__ = "trucks"
    truck_id = Column(String(100), primary_key=True)
    truck_number = Column(String(50), unique=True, nullable=False)
    insurance_expiry_date = Column(Date, nullable=True)
    fitness_expiry_date = Column(Date, nullable=True)
    registration_expiry_date = Column(Date, nullable=True)
    vehicle_type = Column(String(50), nullable=True)
    truck_capacity_weight = Column(Numeric(10, 2), nullable=True)
    truck_capacity_volume = Column(Numeric(10, 2), nullable=True)
    truck_status = Column(
        Enum("ACTIVE", "IN_MAINTENANCE", "INACTIVE", name="truck_status_enum"),
        default="ACTIVE"
    )
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))


class Shipment(Base):
    __tablename__ = "shipments"
    shipment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id = Column(Integer, ForeignKey("routes.route_id"), nullable=True)
    origin_city = Column(String(100), nullable=False)
    origin_state = Column(String(100), nullable=False)
    origin_pincode = Column(String(20), nullable=True)
    destination_city = Column(String(100), nullable=False)
    destination_state = Column(String(100), nullable=False)
    destination_pincode = Column(String(20), nullable=True)
    shipment_value = Column(Numeric(15, 2), nullable=False)
    currency_code = Column(String(10), default="INR")
    dispatch_datetime = Column(DateTime, nullable=False)
    delivery_deadline = Column(DateTime, nullable=False)
    actual_delivery_datetime = Column(DateTime, nullable=True)
    vendor_id = Column(String(100), ForeignKey("vendors.vendor_id"), nullable=True)
    driver_id = Column(String(100), ForeignKey("drivers.driver_id"), nullable=True)
    truck_id = Column(String(100), ForeignKey("trucks.truck_id"), nullable=True)
    shipment_status = Column(
        Enum("CREATED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "DELAYED", "CANCELLED",
             name="shipment_status_enum"),
        default="CREATED"
    )
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))


class DriverIncident(Base):
    __tablename__ = "driver_incidents"
    incident_id = Column(String(100), primary_key=True)
    driver_id = Column(String(100), ForeignKey("drivers.driver_id"), nullable=True)
    incident_type = Column(String(100), nullable=True)
    incident_severity = Column(
        Enum("LOW", "MEDIUM", "HIGH", name="incident_severity_enum"), nullable=True
    )
    incident_date = Column(Date, nullable=True)
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.shipment_id"), nullable=True)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))


class ShipmentFinancial(Base):
    __tablename__ = "shipment_financials"
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.shipment_id"), primary_key=True)
    declared_value = Column(Numeric(15, 2), nullable=True)
    insurance_coverage_value = Column(Numeric(15, 2), nullable=True)
    expected_margin = Column(Numeric(15, 2), nullable=True)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))


class ShipmentRiskSnapshot(Base):
    __tablename__ = "shipment_risk_snapshots"
    risk_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.shipment_id"), nullable=False)
    compliance_risk_score = Column(Numeric(5, 2), nullable=True)
    vendor_risk_score = Column(Numeric(5, 2), nullable=True)
    operational_risk_score = Column(Numeric(5, 2), nullable=True)
    financial_exposure_score = Column(Numeric(5, 2), nullable=True)
    overall_risk_score = Column(Numeric(5, 2), nullable=True)
    risk_category = Column(Enum("LOW", "MEDIUM", "HIGH", name="risk_category_enum"), nullable=True)
    alert_generated = Column(Boolean, default=False)
    alert_type = Column(String(100), nullable=True)
    estimated_financial_impact = Column(Numeric(15, 2), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    calculated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    model_version = Column(String(20), default="v1.0")


class RiskWeightConfiguration(Base):
    __tablename__ = "risk_weight_configuration"
    config_id = Column(String(100), primary_key=True)
    compliance_weight = Column(Numeric(5, 2), default=25.00)
    vendor_weight = Column(Numeric(5, 2), default=25.00)
    operational_weight = Column(Numeric(5, 2), default=25.00)
    financial_weight = Column(Numeric(5, 2), default=25.00)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)


class ShipmentCostPlanningActual(Base):
    __tablename__ = "shipment_cost_planning_actuals"
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.shipment_id"), primary_key=True)
    planned_transport_cost = Column(Numeric(15, 2), nullable=True)
    planned_rate_per_km = Column(Numeric(10, 2), nullable=True)
    planned_no_of_trucks = Column(Integer, nullable=True)
    actual_transport_cost = Column(Numeric(15, 2), nullable=True)
    actual_rate_per_km = Column(Numeric(10, 2), nullable=True)
    actual_no_of_trucks = Column(Integer, nullable=True)
    distance_km = Column(Numeric(10, 2), nullable=True)
    detention_cost = Column(Numeric(15, 2), default=0, nullable=True)
    penalty_cost = Column(Numeric(15, 2), default=0, nullable=True)
    fuel_surcharge_cost = Column(Numeric(15, 2), default=0, nullable=True)
    toll_cost = Column(Numeric(15, 2), default=0, nullable=True)
    loading_unloading_cost = Column(Numeric(15, 2), default=0, nullable=True)
    other_additional_cost = Column(Numeric(15, 2), default=0, nullable=True)
    total_additional_cost = Column(Numeric(15, 2), nullable=True)
    total_actual_cost = Column(Numeric(15, 2), nullable=True)
    cost_variance = Column(Numeric(15, 2), nullable=True)
    cost_variance_percentage = Column(Numeric(6, 2), nullable=True)
    market_avg_rate_per_km = Column(Numeric(10, 2), nullable=True)
    market_volatility_index = Column(Numeric(5, 2), nullable=True)
    market_capacity_shortage_index = Column(Numeric(5, 2), nullable=True)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))


class MarketFreightIntelligence(Base):
    __tablename__ = "market_freight_intelligence"
    route_id = Column(Integer, ForeignKey("routes.route_id"), primary_key=True)
    vehicle_type = Column(String(50), primary_key=True)
    date = Column(Date, primary_key=True)
    average_market_rate_per_km = Column(Numeric(10, 2), nullable=True)
    high_market_rate_per_km = Column(Numeric(10, 2), nullable=True)
    low_market_rate_per_km = Column(Numeric(10, 2), nullable=True)
    volatility_index = Column(Numeric(5, 2), nullable=True)
    capacity_shortage_index = Column(Numeric(5, 2), nullable=True)


class MasterSummary(Base):
    __tablename__ = "master_summary"
    master_id = Column(BigInteger, primary_key=True, autoincrement=True)
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.shipment_id"), unique=True, nullable=False)
    vendor_id = Column(String(100), ForeignKey("vendors.vendor_id"), nullable=True)
    driver_id = Column(String(100), ForeignKey("drivers.driver_id"), nullable=True)
    truck_id = Column(String(100), ForeignKey("trucks.truck_id"), nullable=True)
    route_id = Column(Integer, ForeignKey("routes.route_id"), nullable=True)
    overall_risk_score = Column(Numeric(5, 2), nullable=True)
    financial_exposure = Column(Numeric(15, 2), nullable=True)
    operational_delay_prob = Column(Numeric(5, 2), nullable=True)
    vendor_on_time_pct = Column(Numeric(5, 2), nullable=True)
    incident_count = Column(Integer, default=0)
    cost_variance = Column(Numeric(15, 2), nullable=True)
    market_volatility = Column(Numeric(5, 2), nullable=True)
    summary_insights = Column(Text, nullable=True)
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (
        Index("ix_master_summary_vendor_id", "vendor_id"),
        Index("ix_master_summary_driver_id", "driver_id"),
        Index("ix_master_summary_truck_id", "truck_id"),
        Index("ix_master_summary_route_id", "route_id"),
    )


# ─── Chat History ──────────────────────────────────────────────────────────────

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id          = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id  = Column(String(64),  nullable=False, index=True)
    role        = Column(String(16),  nullable=False)   # "user" | "assistant"
    content     = Column(Text,        nullable=False)
    created_at  = Column(DateTime,    server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (
        Index("ix_chat_messages_session_created", "session_id", "created_at"),
    )

# ─── Engine & Session ──────────────────────────────────────────────────────────

def create_db_engine():
    """
    Create a SQLAlchemy engine tuned for Neon/Vercel Postgres.

    Key changes vs original:
    - Removed `options: -c statement_timeout` — not supported on pooled Neon connections.
    - Reduced pool_size / max_overflow to match Neon's connection limits.
    - pool_pre_ping=True keeps stale connections from being reused.
    """
    return create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=5,           # Neon free tier supports ~10 connections max
        max_overflow=10,       # Burst headroom; total cap = pool_size + max_overflow
        pool_pre_ping=True,    # Drop broken connections before handing them out
        pool_recycle=300,      # Recycle every 5 min — Neon drops idle connections
        echo=False,
        connect_args={
            "connect_timeout": 30,
            # DO NOT add "options": "-c statement_timeout=..."
            # Neon pooled connections reject SET commands at connect time.
        }
    )


if _DB_AVAILABLE:
    engine = create_db_engine()
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
else:
    engine = None
    SessionLocal = None


# ─── Schema Reset (DEV ONLY) ──────────────────────────────────────────────────

def _check_and_reset_schema() -> None:
    """
    Detects and fixes a stale schema (e.g. wrong column types from an old migration).

    SAFETY GUARD: This function does NOTHING outside of APP_ENV=development.
    Calling DROP SCHEMA in production would permanently destroy all data.
    """
    if not IS_DEVELOPMENT:
        logger.info("Schema reset skipped — APP_ENV=%r (only runs in development)", APP_ENV)
        return

    try:
        with SessionLocal() as session:
            sentinels = [
                ("vendors",   "vendor_id",   "character varying"),
                ("drivers",   "driver_id",   "character varying"),
                ("trucks",    "truck_id",    "character varying"),
                ("shipments", "shipment_id", "uuid"),
            ]
            stale_cols = []
            for tbl, col, expected in sentinels:
                actual = session.execute(text("""
                    SELECT data_type FROM information_schema.columns
                    WHERE table_name = :tbl AND column_name = :col
                """), {"tbl": tbl, "col": col}).scalar()
                if actual is not None and actual != expected:
                    stale_cols.append(f"{tbl}.{col}={actual!r} (expected {expected!r})")

            if not stale_cols:
                logger.info("Schema sentinel check passed — no reset needed.")
                return

            logger.warning("Stale schema detected: %s — resetting (dev only).", stale_cols)

            session.execute(text("DROP SCHEMA public CASCADE"))
            session.execute(text("CREATE SCHEMA public"))
            session.execute(text("GRANT ALL ON SCHEMA public TO PUBLIC"))

            for enum_name in [
                "vendor_status_enum", "perf_window_enum", "driver_status_enum",
                "truck_status_enum", "shipment_status_enum", "incident_severity_enum",
                "risk_category_enum",
            ]:
                try:
                    session.execute(text(f"DROP TYPE IF EXISTS {enum_name} CASCADE"))
                except Exception:
                    pass

            session.commit()
            logger.info("Dev schema reset complete. create_all() will rebuild tables.")

    except Exception as exc:
        logger.error("Schema reset failed: %s", exc)
        raise


# ─── Database Initialisation ──────────────────────────────────────────────────

def init_db() -> None:
    """
    Initialize the database safely:
      1. In development only: detect & reset stale schema.
      2. Create any missing tables (idempotent — safe to run on every startup).
      3. Seed default risk weight configuration if the table is empty.
    """
    if not _DB_AVAILABLE:
        logger.warning("init_db skipped — DATABASE_URL not set")
        return

    try:
        # STEP 1 — schema migration guard (no-op in production)
        _check_and_reset_schema()

        # STEP 2 — create tables that don't yet exist (never drops existing ones)
        Base.metadata.create_all(bind=engine)
        logger.info("Tables created/verified successfully.")

        # STEP 3 — seed default risk weights
        with get_session_with_commit() as session:
            count = session.execute(
                text("SELECT COUNT(*) FROM risk_weight_configuration")
            ).scalar()
            if count == 0:
                from datetime import date
                session.execute(
                    text("""
                        INSERT INTO risk_weight_configuration
                            (config_id, compliance_weight, vendor_weight,
                             operational_weight, financial_weight, effective_from)
                        VALUES (:config_id, 25.0, 25.0, 25.0, 25.0, :d)
                    """),
                    {"config_id": "1", "d": date.today()}
                )
                logger.info("Default risk weights seeded.")
            else:
                logger.info("Risk weight configuration already present — skipping seed.")

        logger.info("Database initialised successfully (APP_ENV=%r).", APP_ENV)

    except Exception as exc:
        logger.error("Database initialisation failed: %s", exc)
        raise


# ─── Session Helpers ──────────────────────────────────────────────────────────

@contextmanager
def get_session() -> Generator[Session, None, None]:
    """Yields a session. Caller is responsible for commit/rollback."""
    if not _DB_AVAILABLE or SessionLocal is None:
        raise RuntimeError("Logistics database not configured. Set DATABASE_URL.")
    session = SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def get_session_with_commit() -> Generator[Session, None, None]:
    """Yields a session that auto-commits on success and rolls back on error."""
    if not _DB_AVAILABLE or SessionLocal is None:
        raise RuntimeError("Logistics database not configured. Set DATABASE_URL.")
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db_session() -> Generator[Session, None, None]:
    """Dependency injector for FastAPI routes."""
    from fastapi import HTTPException
    if not _DB_AVAILABLE or SessionLocal is None:
        raise HTTPException(status_code=503, detail="Logistics database not configured. Set DATABASE_URL.")
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# ─── Query Helpers ────────────────────────────────────────────────────────────

def fetch_dataframe(sql: str, params: Optional[dict] = None) -> "pd.DataFrame":
    """Execute parameterised SQL and return the result as a DataFrame."""
    if not _DB_AVAILABLE or SessionLocal is None:
        logger.warning("fetch_dataframe skipped — DATABASE_URL not set")
        return pd.DataFrame()
    import pandas as pd
    try:
        with SessionLocal() as session:
            result = session.execute(text(sql), params or {})
            rows = result.fetchall()
            cols = list(result.keys())
            return pd.DataFrame(rows, columns=cols)
    except Exception as exc:
        logger.error("fetch_dataframe failed: %s", exc)
        return pd.DataFrame()


def get_dashboard_kpis() -> dict:
    """Return high-level KPIs from master_summary and shipments."""
    if not _DB_AVAILABLE or SessionLocal is None:
        logger.warning("get_dashboard_kpis skipped — DATABASE_URL not set")
        return {
            "total_shipments": 0,
            "avg_risk_score": 0.0,
            "avg_on_time_pct": 0.0,
            "total_financial_exposure": 0.0,
            "avg_cost_variance": 0.0,
            "total_incidents": 0,
        }
    try:
        with SessionLocal() as session:
            row = session.execute(text("""
                SELECT
                    (SELECT COUNT(*) FROM shipments)                                    AS total_shipments,
                    (SELECT COALESCE(AVG(overall_risk_score),    0) FROM master_summary) AS avg_risk_score,
                    (SELECT COALESCE(AVG(vendor_on_time_pct),    0) FROM master_summary) AS avg_on_time_pct,
                    (SELECT COALESCE(SUM(financial_exposure),    0) FROM master_summary) AS total_financial_exposure,
                    (SELECT COALESCE(AVG(cost_variance),         0) FROM master_summary) AS avg_cost_variance,
                    (SELECT COUNT(*) FROM driver_incidents)                              AS total_incidents
            """)).fetchone()
            if row:
                return dict(zip(row._fields, row))
    except Exception as exc:
        logger.error("get_dashboard_kpis failed: %s", exc)
    return {
        "total_shipments": 0,
        "avg_risk_score": 0.0,
        "avg_on_time_pct": 0.0,
        "total_financial_exposure": 0.0,
        "avg_cost_variance": 0.0,
        "total_incidents": 0,
    }


# End of db.py
