"""Pydantic schema models for logistics industry API contracts."""

from pydantic import BaseModel, Field


class RiskWeightUpdate(BaseModel):
    compliance_weight: float = Field(..., ge=0, le=100)
    vendor_weight: float = Field(..., ge=0, le=100)
    operational_weight: float = Field(..., ge=0, le=100)
    financial_weight: float = Field(..., ge=0, le=100)
    effective_from: str


class AIChatRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)
    session_id: str = Field(default="", max_length=64)
