from pydantic import BaseModel
from datetime import datetime
from typing import Literal


class InventoryItem(BaseModel):
    id: str
    sku: str
    product_name: str | None = None
    category: str | None = None
    warehouse_name: str | None = None
    current_stock: int = 0
    reorder_point: int = 0
    daily_avg_demand: float = 0.0
    days_left: float | None = None
    status: Literal["optimal", "low_stock", "stockout", "overstock"] = "optimal"
    abc_category: Literal["A", "B", "C"] | None = None
    created_at: str | None = None


class InventoryItemCreate(BaseModel):
    sku: str
    product_name: str | None = None
    category: str | None = None
    warehouse_name: str | None = None
    current_stock: int = 0
    reorder_point: int = 0
    daily_avg_demand: float = 0.0
    status: Literal["optimal", "low_stock", "stockout", "overstock"] = "optimal"
    abc_category: Literal["A", "B", "C"] | None = None


class WarehouseResponse(BaseModel):
    id: str
    name: str
    location: str | None = None
    total_skus: int = 0
    stockouts: int = 0
    fill_rate: float = 100.0
    status: Literal["good", "warning", "critical"] = "good"


class InventoryOverview(BaseModel):
    optimal: int = 0
    low_stock: int = 0
    stockout: int = 0
    overstock: int = 0
    total: int = 0
    health_score: int = 0


class ReorderItem(BaseModel):
    sku: str
    product: str | None = None
    current_stock: int = 0
    daily_avg: float = 0.0
    days_left: float = 0.0
    urgency: Literal["critical", "high", "medium", "low"] = "medium"
    warehouse: str | None = None


class ABCCategory(BaseModel):
    category: Literal["A", "B", "C"]
    count: int = 0
    revenue_pct: int
    description: str
