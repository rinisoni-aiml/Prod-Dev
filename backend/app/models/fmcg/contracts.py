from pydantic import BaseModel
from datetime import date, datetime
from uuid import UUID
from typing import Literal


class ContractCreate(BaseModel):
    contract_name: str
    vendor: str
    start_date: date
    end_date: date
    value: float | None = None
    status: Literal["active", "pending", "expired", "expiring_soon", "cancelled"] = "active"
    notes: str | None = None


class ContractUpdate(BaseModel):
    contract_name: str | None = None
    vendor: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    value: float | None = None
    status: Literal["active", "pending", "expired", "expiring_soon", "cancelled"] | None = None
    notes: str | None = None


class ContractResponse(BaseModel):
    id: str
    contract_name: str
    vendor: str
    start_date: str
    end_date: str
    value: float | None = None
    status: str
    notes: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
