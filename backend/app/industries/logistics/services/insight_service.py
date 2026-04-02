"""Logistics insight generation helpers. Copied from logistics-ai-main with adapted imports."""
from __future__ import annotations

import logging
import os
from typing import Any

from app.industries.logistics.config.risk_config import ALERT_THRESHOLDS, RISK_THRESHOLDS

logger = logging.getLogger(__name__)

_USE_LLM = os.getenv("USE_LLM_INSIGHTS", "false").strip().lower() in {"1", "true", "yes"}


def _fmt(value, digits: int = 1) -> str:
    if value is None:
        return "0"
    try:
        return f"{float(value):.{digits}f}"
    except Exception:
        return "0"


def _level(score: float) -> str:
    if score >= RISK_THRESHOLDS["HIGH"]:
        return "HIGH"
    if score >= RISK_THRESHOLDS["MEDIUM"]:
        return "MEDIUM"
    return "LOW"


def _try_llm(prompt: str):
    if not _USE_LLM:
        return None
    try:
        from app.industries.logistics.utils.llm_init import get_llm
        llm = get_llm(model="llama-3.1-8b-instant", temperature=0.4)
        response = llm.invoke([{"role": "user", "content": prompt}])
        result = response.content.strip()
        if result:
            logger.info("insight generation status=llm_success")
            return result
    except Exception as exc:
        logger.warning("insight generation status=llm_failed error=%s", exc)
    return None


def generate_dashboard_insight(data: dict[str, Any]) -> list[dict[str, str]]:
    avg_risk = float(data.get("company_risk", 0) or 0)
    delayed = int(data.get("delayed_shipments", 0) or 0)
    total_shipments = int(data.get("total_shipments", 0) or 0)
    delay_rate_pct = float(data.get("delay_rate_pct", 0) or 0)
    compliance_alerts = int(data.get("compliance_alerts", 0) or 0)
    vendor_alerts = int(data.get("vendor_alerts", 0) or 0)
    driver_licenses_expiring_30 = int(data.get("driver_licenses_expiring_30", 0) or 0)
    vehicle_docs_expiring_30 = int(data.get("vehicle_docs_expiring_30", 0) or 0)
    top_route = data.get("top_route_name") or "No hotspot route"
    top_route_risk = float(data.get("top_route_risk", 0) or 0)

    prompt = (
        "Create 4 concise dashboard insights from: "
        f"avg_risk={avg_risk}, delayed={delayed}, compliance_alerts={compliance_alerts}, "
        f"vendor_alerts={vendor_alerts}, top_route={top_route}, top_route_risk={top_route_risk}."
    )
    llm_text = _try_llm(prompt)

    if llm_text:
        return [{"title": "Network Overview", "icon": "chart", "body": llm_text}]

    return [
        {
            "title": "Delay Risk Indicator",
            "icon": "alert",
            "body": (
                f"The network currently runs at {_fmt(delay_rate_pct)}% delay rate across {total_shipments} shipments. "
                f"Top pressure corridor is {top_route} with {_fmt(top_route_risk)} risk, requiring closer dispatch control."
            ),
        },
        {
            "title": "Driver License Expiry",
            "icon": "user",
            "body": (
                f"{driver_licenses_expiring_30} driver licenses are due within 30 days. "
                "Renewals should be prioritized to prevent avoidable allocation disruptions."
            ),
        },
        {
            "title": "Vehicle Doc Expiry Alert",
            "icon": "truck",
            "body": (
                f"{vehicle_docs_expiring_30} vehicle compliance documents are expiring soon, "
                f"while {compliance_alerts} renewals are inside the next 5-day priority window. "
                "Immediate updates are recommended to maintain fleet readiness."
            ),
        },
    ]


def generate_vendor_insight(data: dict[str, Any]) -> str:
    name = data.get("vendor_name") or "Vendor"
    risk = float(data.get("risk_score", 0) or 0)
    otp = float(data.get("on_time_pct", 0) or 0)
    delay = float(data.get("delay_rate_pct", 0) or 0)
    level = _level(risk)

    llm_text = _try_llm(
        f"Generate vendor insight for {name} risk={risk} otp={otp} delay={delay} level={level}."
    )
    if llm_text:
        return llm_text

    return (
        f"{name} is at {_fmt(risk)} risk ({level}) with on-time performance at {_fmt(otp)}% and delay rate at {_fmt(delay)}%. "
        f"Assignment strategy should prioritize lanes where this profile remains within risk tolerance."
    )


def generate_risk_insight(data: dict[str, Any]) -> str:
    avg_risk = float(data.get("avg_risk", 0) or 0)
    high_share = float(data.get("high_risk_share", 0) or 0)
    volatility = float(data.get("top_volatility", 0) or 0)
    llm_text = _try_llm(
        f"Generate risk analytics insight avg_risk={avg_risk} high_share={high_share} volatility={volatility}."
    )
    if llm_text:
        return llm_text

    return (
        f"Average risk is {_fmt(avg_risk)} with {_fmt(high_share)}% of shipments in high-risk range. "
        f"Peak market volatility index is {_fmt(volatility)}, which is a leading signal for route-level escalation."
    )


def generate_shipment_insight(data: dict[str, Any]) -> str:
    shipment_id = data.get("shipment_id")
    overall = float(data.get("overall_risk", 0) or 0)
    category = data.get("risk_level") or _level(overall)
    top_component = data.get("top_component") or "operational"
    llm_text = _try_llm(
        f"Generate shipment insight id={shipment_id} overall={overall} category={category} top_component={top_component}."
    )
    if llm_text:
        return llm_text

    return (
        f"Shipment {shipment_id} is currently {_fmt(overall)} risk in {category} category, "
        f"with {top_component} as the largest contributor. "
        f"Mitigation actions are prioritized according to configured alert thresholds "
        f"({ALERT_THRESHOLDS['CRITICAL']}/{ALERT_THRESHOLDS['WARNING']})."
    )
