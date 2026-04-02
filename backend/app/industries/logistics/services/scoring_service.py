"""
Dynamic Risk Scoring Engine — adapted for Supabase lg_* tables.
All pure scoring functions are copied exactly from logistics-ai-main (formulas, thresholds, weights).
DB access adapted to use Supabase client with user_id scoping.
"""
from __future__ import annotations

import logging
import math
from datetime import date, datetime, timezone
from typing import Optional, Union

from app.industries.logistics.config.risk_config import (
    ALERT_THRESHOLDS,
    CONFIDENCE_BY_SOURCE,
    DEFAULT_RISK_WEIGHTS,
    DEFAULT_VENDOR_METRICS,
    RISK_THRESHOLDS,
    SCORING_WEIGHTS,
)
from app.shared.utils.supabase_client import supabase

logger = logging.getLogger(__name__)

MODEL_VERSION = "v1.0"


# ─── Utility ──────────────────────────────────────────────────────────────────

def safe_div(numerator: float, denominator: float, default: float = 0.0) -> float:
    if denominator == 0 or denominator is None:
        return default
    return numerator / denominator


def normalize(value: float, min_val: float, max_val: float) -> float:
    """Normalized_Score = ((Actual - Min) / (Max - Min)) * 100"""
    if max_val == min_val:
        return 0.0
    return max(0.0, min(100.0, ((value - min_val) / (max_val - min_val)) * 100))


def expiry_risk(expiry_date: Optional[date]) -> float:
    """Time-decay expiry risk: 100 if expired, else 100 * exp(-days_left/30)"""
    if expiry_date is None:
        return 100.0
    if isinstance(expiry_date, str):
        try:
            expiry_date = date.fromisoformat(expiry_date[:10])
        except Exception:
            return 100.0
    days_left = (expiry_date - date.today()).days
    if days_left <= 0:
        return 100.0
    return min(100.0, 100.0 * math.exp(-days_left / 30.0))


# ─── Individual Score Components ──────────────────────────────────────────────

def compute_compliance_risk(
    license_expiry: Optional[date],
    insurance_expiry: Optional[date],
    fitness_expiry: Optional[date],
    registration_expiry: Optional[date],
) -> float:
    """Weighted average of expiry risks."""
    scores = [
        expiry_risk(license_expiry) * 0.30,
        expiry_risk(insurance_expiry) * 0.30,
        expiry_risk(fitness_expiry) * 0.20,
        expiry_risk(registration_expiry) * 0.20,
    ]
    return min(100.0, sum(scores))


def compute_vendor_risk(
    on_time_pct_30d: float,
    delivery_time_std: float,
    max_std_in_system: float = 100.0,
) -> float:
    """Trend-based vendor risk."""
    on_time_risk = max(0.0, 100.0 - on_time_pct_30d)
    stability_risk = normalize(delivery_time_std, 0, max_std_in_system)
    return min(100.0, on_time_risk * 0.6 + stability_risk * 0.4)


def compute_operational_risk(
    delayed_trips: int,
    total_trips: int,
    remaining_days: float,
    total_transit_days: float,
) -> float:
    """Probability-based operational risk."""
    delay_prob = safe_div(delayed_trips, total_trips) * 100
    time_pressure = (1.0 - safe_div(remaining_days, max(total_transit_days, 1))) * 100
    time_pressure = max(0.0, min(100.0, time_pressure))
    return min(100.0, delay_prob * 0.70 + time_pressure * 0.30)


def compute_incident_risk(
    driver_incidents: int,
    max_incidents_in_system: int,
) -> float:
    """Benchmarking-based incident risk."""
    if max_incidents_in_system <= 0:
        return 0.0
    return min(100.0, safe_div(driver_incidents, max_incidents_in_system) * 100)


def compute_financial_exposure_score(
    shipment_value: float,
    insurance_coverage: float,
    cost_variance_pct: float,
) -> float:
    """Financial exposure normalized risk."""
    coverage_gap = max(0.0, (shipment_value - insurance_coverage))
    coverage_risk = normalize(coverage_gap, 0, max(shipment_value, 1))
    variance_risk = min(100.0, abs(cost_variance_pct))
    return min(100.0, coverage_risk * 0.6 + variance_risk * 0.4)


def compute_overall_risk(
    compliance: float,
    vendor: float,
    operational: float,
    financial: float,
    weights: Optional[dict] = None,
) -> float:
    """Weighted overall risk with probabilistic conversion."""
    if weights is None:
        weights = {"compliance": 25, "vendor": 25, "operational": 25, "financial": 25}
    total_w = sum(weights.values()) or 100
    weighted = (
        compliance * weights.get("compliance", 25) +
        vendor * weights.get("vendor", 25) +
        operational * weights.get("operational", 25) +
        financial * weights.get("financial", 25)
    ) / total_w
    return min(100.0, weighted)


def risk_category(score: float) -> str:
    if score >= float(RISK_THRESHOLDS.get("HIGH", 80.0)):
        return "HIGH"
    elif score >= float(RISK_THRESHOLDS.get("MEDIUM", 60.0)):
        return "MEDIUM"
    return "LOW"


def prob_loss(overall_score: float) -> float:
    """Probabilistic loss: 1 / (1 + exp(-score/10))"""
    return 1.0 / (1.0 + math.exp(-overall_score / 10.0))


def compute_margin_risk(actual_margin: float, planned_margin: float) -> float:
    if planned_margin == 0:
        return 0.0
    return min(100.0, max(-100.0, (1.0 - safe_div(actual_margin, planned_margin)) * 100.0))


def compute_escalation_probability(
    delay_prob: float,
    market_volatility: float,
    capacity_shortage: float,
) -> float:
    return min(100.0, delay_prob * 0.4 + market_volatility * 0.3 + capacity_shortage * 0.3)


def compute_supply_chain_resilience(
    disruption_events_last_year: int,
    total_events: int,
) -> float:
    if total_events == 0:
        return 100.0
    return max(0.0, (1.0 - safe_div(disruption_events_last_year, total_events)) * 100.0)


def compute_environmental_risk(
    distance_km: float,
    vehicle_type: str,
    max_emission_in_fleet: float = 5000.0,
) -> float:
    vehicle_factors = {
        "LCV": 1.0, "HCV": 1.3, "20FT": 1.2, "32FT": 1.4,
        "TRAILER": 1.5, "CONTAINER": 1.6,
    }
    factor = vehicle_factors.get(vehicle_type.upper() if vehicle_type else "", 1.2)
    estimated_emission = distance_km * factor
    return normalize(estimated_emission, 0, max_emission_in_fleet)


def compute_geopolitical_risk(
    volatility_index: float,
    capacity_shortage_index: float,
    high_risk_states: Optional[list] = None,
    route_states: Optional[list] = None,
) -> float:
    base = volatility_index * 0.5 + capacity_shortage_index * 0.5
    if high_risk_states and route_states:
        overlap = any(s in high_risk_states for s in route_states)
        if overlap:
            base = min(100.0, base * 1.25)
    return min(100.0, base)


# ─── Vendor Metric Source Precedence ──────────────────────────────────────────

def _fetch_vendor_metrics_with_source(uid: str, vendor_id: Optional[str]) -> tuple:
    """Fetch vendor metrics with source priority: 30D -> 90D -> LIFETIME -> fallback."""
    if not vendor_id:
        return (
            float(DEFAULT_VENDOR_METRICS.get("otp", 75.0)),
            float(DEFAULT_VENDOR_METRICS.get("delay_rate", 20.0)),
            float(DEFAULT_VENDOR_METRICS.get("claim_ratio", 5.0)),
            "fallback",
        )
    for window in ("30D", "90D", "LIFETIME"):
        try:
            resp = (
                supabase.table("lg_vendor_performance_metrics")
                .select("on_time_percentage, delay_rate_percentage, claim_ratio_percentage")
                .eq("user_id", uid)
                .eq("vendor_id", vendor_id)
                .eq("performance_window", window)
                .order("calculation_date", desc=True)
                .limit(1)
                .execute()
            )
            row = (resp.data or [None])[0]
            if row:
                otp = float(row.get("on_time_percentage") or DEFAULT_VENDOR_METRICS.get("otp", 75.0))
                delay_rate = float(row.get("delay_rate_percentage") or DEFAULT_VENDOR_METRICS.get("delay_rate", 20.0))
                claim_ratio = float(row.get("claim_ratio_percentage") or DEFAULT_VENDOR_METRICS.get("claim_ratio", 5.0))
                return otp, delay_rate, claim_ratio, window
        except Exception:
            pass
    return (
        float(DEFAULT_VENDOR_METRICS.get("otp", 75.0)),
        float(DEFAULT_VENDOR_METRICS.get("delay_rate", 20.0)),
        float(DEFAULT_VENDOR_METRICS.get("claim_ratio", 5.0)),
        "fallback",
    )


def _compute_vendor_component_risk(on_time_pct: float, delay_rate: float, claim_ratio: float) -> tuple:
    otp_weight = float(SCORING_WEIGHTS.get("otp", 0.4))
    delay_weight = float(SCORING_WEIGHTS.get("delay", 0.3))
    claim_weight = float(SCORING_WEIGHTS.get("claims", 0.3))

    otp_risk = max(0.0, min(100.0, 100.0 - on_time_pct))
    delay_risk = max(0.0, min(100.0, delay_rate))
    claim_risk = max(0.0, min(100.0, claim_ratio))

    score = min(
        100.0,
        (otp_risk * otp_weight) + (delay_risk * delay_weight) + (claim_risk * claim_weight),
    )
    components = {
        "otp_score": round(otp_risk, 2),
        "delay_score": round(delay_risk, 2),
        "claim_score": round(claim_risk, 2),
    }
    return round(score, 2), components


def get_risk_weights(uid: str) -> dict:
    """Fetch active risk weights from lg_risk_weight_configuration."""
    try:
        resp = (
            supabase.table("lg_risk_weight_configuration")
            .select("compliance_weight, vendor_weight, operational_weight, financial_weight")
            .eq("user_id", uid)
            .is_("effective_to", "null")
            .order("effective_from", desc=True)
            .limit(1)
            .execute()
        )
        row = (resp.data or [None])[0]
        if row:
            return {
                "compliance": float(row.get("compliance_weight", 25)),
                "vendor": float(row.get("vendor_weight", 25)),
                "operational": float(row.get("operational_weight", 25)),
                "financial": float(row.get("financial_weight", 25)),
            }
    except Exception as exc:
        logger.error("Failed to fetch risk weights: %s", exc)
    return {
        "compliance": float(DEFAULT_RISK_WEIGHTS.get("compliance", 25.0)),
        "vendor": float(DEFAULT_RISK_WEIGHTS.get("vendor", 25.0)),
        "operational": float(DEFAULT_RISK_WEIGHTS.get("operational", 25.0)),
        "financial": float(DEFAULT_RISK_WEIGHTS.get("financial", 25.0)),
    }


# ─── Core Scoring (Supabase-Aware) ────────────────────────────────────────────

def compute_and_store_risk_snapshot(shipment_id: str, uid: str) -> Optional[dict]:
    """
    Compute all risk scores for a shipment and upsert into lg_shipment_risk_snapshots.
    Reads all data from Supabase lg_* tables filtered by user_id.
    """
    try:
        logger.info("Risk scoring started for shipment_id=%s uid=%s", shipment_id, uid)

        # Fetch shipment
        ship_resp = (
            supabase.table("lg_shipments")
            .select("*")
            .eq("user_id", uid)
            .eq("shipment_id", shipment_id)
            .limit(1)
            .execute()
        )
        ship = (ship_resp.data or [None])[0]
        if not ship:
            return None

        vendor_id = ship.get("vendor_id")
        driver_id = ship.get("driver_id")
        truck_id = ship.get("truck_id")
        route_id = ship.get("route_id")
        ship_val = float(ship.get("shipment_value") or 0)
        dispatch_dt = ship.get("dispatch_datetime")
        deadline = ship.get("delivery_deadline")
        origin_state = ship.get("origin_state")
        dest_state = ship.get("destination_state")

        # Fetch driver license expiry
        lic_exp = None
        if driver_id:
            try:
                d_resp = (
                    supabase.table("lg_drivers")
                    .select("license_expiry_date")
                    .eq("user_id", uid)
                    .eq("driver_id", driver_id)
                    .limit(1)
                    .execute()
                )
                d_row = (d_resp.data or [None])[0]
                lic_exp = d_row.get("license_expiry_date") if d_row else None
            except Exception:
                pass

        # Fetch truck expiry dates
        ins_exp = fit_exp = reg_exp = veh_type = None
        if truck_id:
            try:
                t_resp = (
                    supabase.table("lg_trucks")
                    .select("insurance_expiry_date, fitness_expiry_date, registration_expiry_date, vehicle_type")
                    .eq("user_id", uid)
                    .eq("truck_id", truck_id)
                    .limit(1)
                    .execute()
                )
                t_row = (t_resp.data or [None])[0]
                if t_row:
                    ins_exp = t_row.get("insurance_expiry_date")
                    fit_exp = t_row.get("fitness_expiry_date")
                    reg_exp = t_row.get("registration_expiry_date")
                    veh_type = t_row.get("vehicle_type")
            except Exception:
                pass

        # Fetch financials
        insurance_cov = exp_margin = cost_var_pct = dist_km = mkt_vol = cap_short = 0.0
        try:
            fin_resp = (
                supabase.table("lg_shipment_financials")
                .select("insurance_coverage_value, expected_margin")
                .eq("user_id", uid)
                .eq("shipment_id", shipment_id)
                .limit(1)
                .execute()
            )
            fin_row = (fin_resp.data or [None])[0]
            if fin_row:
                insurance_cov = float(fin_row.get("insurance_coverage_value") or 0)
                exp_margin = float(fin_row.get("expected_margin") or 0)
        except Exception:
            pass

        try:
            cost_resp = (
                supabase.table("lg_shipment_cost_planning_actuals")
                .select("cost_variance_percentage, distance_km, market_volatility_index, market_capacity_shortage_index")
                .eq("user_id", uid)
                .eq("shipment_id", shipment_id)
                .limit(1)
                .execute()
            )
            cost_row = (cost_resp.data or [None])[0]
            if cost_row:
                cost_var_pct = float(cost_row.get("cost_variance_percentage") or 0)
                dist_km = float(cost_row.get("distance_km") or 0)
                mkt_vol = float(cost_row.get("market_volatility_index") or 0)
                cap_short = float(cost_row.get("market_capacity_shortage_index") or 0)
        except Exception:
            pass

        # Vendor metrics with source precedence
        vendor_otp, vendor_delay_rate, vendor_claim_ratio, source_used = _fetch_vendor_metrics_with_source(uid, vendor_id)
        confidence = float(CONFIDENCE_BY_SOURCE.get(source_used, CONFIDENCE_BY_SOURCE.get("fallback", 0.5)))

        # Driver incidents
        incident_count = 0
        max_incidents = 1
        if driver_id:
            try:
                inc_resp = (
                    supabase.table("lg_driver_incidents")
                    .select("driver_id", count="exact")
                    .eq("user_id", uid)
                    .eq("driver_id", driver_id)
                    .execute()
                )
                incident_count = inc_resp.count or 0

                all_inc_resp = (
                    supabase.table("lg_driver_incidents")
                    .select("driver_id")
                    .eq("user_id", uid)
                    .execute()
                )
                from collections import Counter
                counts = Counter(r["driver_id"] for r in (all_inc_resp.data or []))
                max_incidents = max(counts.values(), default=1)
            except Exception:
                pass

        # Operational risk: delayed trips vs total trips for this vendor
        delayed = 0
        total_trips = 1
        if vendor_id:
            try:
                all_ships = (
                    supabase.table("lg_shipments")
                    .select("shipment_status")
                    .eq("user_id", uid)
                    .eq("vendor_id", vendor_id)
                    .execute()
                )
                rows = all_ships.data or []
                total_trips = max(len(rows), 1)
                delayed = sum(1 for r in rows if r.get("shipment_status") == "DELAYED")
            except Exception:
                pass

        # Time pressure calculation
        try:
            now = datetime.now(tz=timezone.utc)

            def _parse_dt(val):
                if val is None:
                    return None
                if isinstance(val, datetime):
                    return val.replace(tzinfo=timezone.utc) if val.tzinfo is None else val
                try:
                    import pandas as pd
                    ts = pd.Timestamp(val)
                    return ts.to_pydatetime().replace(tzinfo=timezone.utc)
                except Exception:
                    return None

            deadline_dt = _parse_dt(deadline)
            dispatch_dt_obj = _parse_dt(dispatch_dt)
            remaining_days = max(0.0, (deadline_dt - now).total_seconds() / 86400) if deadline_dt else 5.0
            total_transit = max(1.0, (deadline_dt - dispatch_dt_obj).total_seconds() / 86400) if (deadline_dt and dispatch_dt_obj) else 7.0
        except Exception:
            remaining_days = 5.0
            total_transit = 7.0

        weights = get_risk_weights(uid)

        # Compute all scores (exact formulas from logistics-ai-main)
        compliance = compute_compliance_risk(lic_exp, ins_exp, fit_exp, reg_exp)
        vendor_risk, vendor_components = _compute_vendor_component_risk(
            vendor_otp, vendor_delay_rate, vendor_claim_ratio
        )
        incident_risk = compute_incident_risk(incident_count, max(max_incidents, 1))
        operational = compute_operational_risk(int(delayed), int(total_trips), remaining_days, total_transit)
        # Blend incident into operational (exact formula from logistics-ai-main)
        operational = operational * 0.7 + incident_risk * 0.3
        financial = compute_financial_exposure_score(ship_val, insurance_cov, cost_var_pct)
        overall = compute_overall_risk(compliance, vendor_risk, operational, financial, weights)
        cat = risk_category(overall)

        critical_threshold = float(ALERT_THRESHOLDS.get("CRITICAL", 85.0))
        warning_threshold = float(ALERT_THRESHOLDS.get("WARNING", 65.0))
        info_threshold = float(ALERT_THRESHOLDS.get("INFO", 40.0))
        alert = overall >= info_threshold
        alert_type = (
            "CRITICAL_RISK" if overall >= critical_threshold else
            "WARNING_RISK" if overall >= warning_threshold else
            "INFO_RISK" if overall >= info_threshold else None
        )
        fin_impact = ship_val * prob_loss(overall)

        snapshot = {
            "user_id": uid,
            "shipment_id": shipment_id,
            "compliance_risk_score": round(compliance, 2),
            "vendor_risk_score": round(vendor_risk, 2),
            "operational_risk_score": round(operational, 2),
            "financial_exposure_score": round(financial, 2),
            "overall_risk_score": round(overall, 2),
            "risk_category": cat,
            "alert_generated": alert,
            "alert_type": alert_type,
            "estimated_financial_impact": round(fin_impact, 2),
            "model_version": MODEL_VERSION,
        }

        supabase.table("lg_shipment_risk_snapshots").upsert(
            snapshot, on_conflict="user_id,shipment_id"
        ).execute()

        logger.info("Risk snapshot stored for shipment_id=%s overall=%.2f cat=%s", shipment_id, overall, cat)

        return {
            "shipment_id": shipment_id,
            "compliance": compliance,
            "vendor": vendor_risk,
            "operational": operational,
            "financial": financial,
            "overall": overall,
            "category": cat,
            "alert": alert,
            "alert_type": alert_type,
            "risk_score": round(overall, 2),
            "risk_level": cat.title(),
            "confidence": round(confidence, 2),
            "source_used": source_used,
            "components": vendor_components,
        }

    except Exception as exc:
        logger.error("Risk scoring failed for shipment %s: %s", shipment_id, exc)
        return None


def rescore_all_for_user(uid: str) -> dict:
    """Re-score every shipment for a given user. Returns {success, failed}."""
    try:
        resp = supabase.table("lg_shipments").select("shipment_id").eq("user_id", uid).execute()
        shipment_ids = [r["shipment_id"] for r in (resp.data or [])]
    except Exception as exc:
        logger.error("rescore_all_for_user: failed to fetch shipments: %s", exc)
        return {"success": 0, "failed": 0, "total": 0}

    success = failed = 0
    for sid in shipment_ids:
        result = compute_and_store_risk_snapshot(str(sid), uid)
        if result:
            success += 1
        else:
            failed += 1

    logger.info("rescore_all_for_user uid=%s total=%d success=%d failed=%d", uid, len(shipment_ids), success, failed)
    return {"success": success, "failed": failed, "total": len(shipment_ids)}
