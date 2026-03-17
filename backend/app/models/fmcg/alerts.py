from pydantic import BaseModel
from datetime import datetime
from typing import Literal


class AlertResponse(BaseModel):
    id: str
    alert_type: str
    severity: Literal["critical", "high", "medium", "low"]
    message: str
    sku: str | None = None
    warehouse: str | None = None
    is_resolved: bool = False
    resolved_at: str | None = None
    created_at: str


class AlertCreate(BaseModel):
    alert_type: str
    severity: Literal["critical", "high", "medium", "low"]
    message: str
    sku: str | None = None
    warehouse: str | None = None
