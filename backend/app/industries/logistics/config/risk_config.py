from __future__ import annotations

import os
from dataclasses import dataclass


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


CONFIG_VERSION = os.getenv("RISK_CONFIG_VERSION", "v1")
SOURCE_VERSION = os.getenv("SOURCE_VERSION", "v1")

RISK_THRESHOLDS = {
    "HIGH": _env_float("RISK_THRESHOLD_HIGH", 80.0),
    "MEDIUM": _env_float("RISK_THRESHOLD_MEDIUM", 60.0),
    "LOW": _env_float("RISK_THRESHOLD_LOW", 30.0),
}

SCORING_WEIGHTS = {
    "otp": _env_float("SCORING_WEIGHT_OTP", 0.4),
    "delay": _env_float("SCORING_WEIGHT_DELAY", 0.3),
    "claims": _env_float("SCORING_WEIGHT_CLAIMS", 0.3),
}

ALERT_THRESHOLDS = {
    "CRITICAL": _env_float("ALERT_THRESHOLD_CRITICAL", 85.0),
    "WARNING": _env_float("ALERT_THRESHOLD_WARNING", 65.0),
    "INFO": _env_float("ALERT_THRESHOLD_INFO", 40.0),
}

DEFAULT_VENDOR_METRICS = {
    "otp": _env_float("DEFAULT_VENDOR_OTP", 75.0),
    "delay_rate": _env_float("DEFAULT_VENDOR_DELAY_RATE", 20.0),
    "claim_ratio": _env_float("DEFAULT_VENDOR_CLAIM_RATIO", 5.0),
}

DEFAULT_RISK_WEIGHTS = {
    "compliance": _env_float("DEFAULT_WEIGHT_COMPLIANCE", 25.0),
    "vendor": _env_float("DEFAULT_WEIGHT_VENDOR", 25.0),
    "operational": _env_float("DEFAULT_WEIGHT_OPERATIONAL", 25.0),
    "financial": _env_float("DEFAULT_WEIGHT_FINANCIAL", 25.0),
}

CONFIDENCE_BY_SOURCE = {
    "30D": _env_float("CONFIDENCE_SOURCE_30D", 0.95),
    "90D": _env_float("CONFIDENCE_SOURCE_90D", 0.85),
    "LIFETIME": _env_float("CONFIDENCE_SOURCE_LIFETIME", 0.75),
    "fallback": _env_float("CONFIDENCE_SOURCE_FALLBACK", 0.5),
}

COMPLIANCE_ALERT_WINDOWS = {
    "critical_days": _env_int("COMPLIANCE_CRITICAL_DAYS", 7),
    "warning_days": _env_int("COMPLIANCE_WARNING_DAYS", 30),
    "watch_days": _env_int("COMPLIANCE_WATCH_DAYS", 60),
}


@dataclass(frozen=True)
class RuntimeConfig:
    risk_thresholds: dict
    scoring_weights: dict
    alert_thresholds: dict
    config_version: str
    source_version: str


RUNTIME_CONFIG = RuntimeConfig(
    risk_thresholds=RISK_THRESHOLDS,
    scoring_weights=SCORING_WEIGHTS,
    alert_thresholds=ALERT_THRESHOLDS,
    config_version=CONFIG_VERSION,
    source_version=SOURCE_VERSION,
)
