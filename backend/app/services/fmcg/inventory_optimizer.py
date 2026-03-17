"""
FMCG Inventory Optimization Service

Classical inventory theory formulas applied to your uploaded demand + stock data:

  Safety Stock  = Z × σ_d × √(lead_time)
  Reorder Point = avg_daily_demand × lead_time + safety_stock
  EOQ           = √(2 × avg_daily_demand × order_cost / holding_cost_pct)
  Max Stock     = ROP + EOQ
  Days Left     = current_stock / avg_daily_demand

Outputs are produced at two levels:
  - by_sku      : aggregate across all warehouses for each SKU
  - by_warehouse: per-warehouse breakdown with per-SKU detail

Z-score → service level mapping
  90% → 1.282
  95% → 1.645
  99% → 2.326
"""

import io
import numpy as np
import pandas as pd

SERVICE_LEVEL_Z = {0.90: 1.282, 0.95: 1.645, 0.99: 2.326}


# ─── File parsing ────────────────────────────────────────────────────────────

def parse_file_for_optimization(
    file_bytes: bytes,
    filename: str,
    column_mapping: dict,
) -> pd.DataFrame:
    """
    Parse CSV/XLSX into a DataFrame with columns:
        date, units, sku, warehouse (optional), stock_level (optional)
    Uses the same column_mapping stored in data_files.column_mapping.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "csv"

    if ext in ("xlsx", "xls"):
        raw = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl")
    else:
        try:
            raw = pd.read_csv(io.BytesIO(file_bytes))
        except Exception:
            raw = pd.read_csv(io.StringIO(file_bytes.decode("utf-8", errors="replace")))

    date_col = column_mapping.get("date")
    units_col = column_mapping.get("units_sold")
    sku_col = column_mapping.get("sku") or column_mapping.get("product_name")
    warehouse_col = column_mapping.get("warehouse")
    stock_col = column_mapping.get("stock_level")

    if not date_col or not units_col:
        raise ValueError("column_mapping must include 'date' and 'units_sold'")
    if date_col not in raw.columns:
        raise ValueError(f"Date column '{date_col}' not found. Available: {list(raw.columns)}")
    if units_col not in raw.columns:
        raise ValueError(f"Units column '{units_col}' not found. Available: {list(raw.columns)}")

    df = pd.DataFrame()
    df["date"] = pd.to_datetime(raw[date_col], infer_datetime_format=True, errors="coerce")
    df["units"] = pd.to_numeric(raw[units_col], errors="coerce").fillna(0).clip(lower=0)
    df["sku"] = (
        raw[sku_col].astype(str).str.strip()
        if (sku_col and sku_col in raw.columns)
        else "All Products"
    )
    df["warehouse"] = (
        raw[warehouse_col].astype(str).str.strip()
        if (warehouse_col and warehouse_col in raw.columns)
        else None
    )
    df["stock_level"] = (
        pd.to_numeric(raw[stock_col], errors="coerce")
        if (stock_col and stock_col in raw.columns)
        else np.nan
    )

    df = df.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)
    return df


# ─── Core metrics calculator ─────────────────────────────────────────────────

def _compute_metrics(
    units: np.ndarray,
    stock_series: pd.Series,
    lead_time: int,
    z: float,
    order_cost: float,
    holding_cost_pct: float,
) -> dict:
    """
    Compute all inventory optimization metrics for one (sku, warehouse) pair.

    units         – historical daily sales array
    stock_series  – stock_level column values (may contain NaN)
    lead_time     – supplier lead time in days
    z             – service level z-score
    order_cost    – $ cost per order (used in EOQ; 0 → fallback heuristic)
    holding_cost_pct – annual holding cost as fraction of inventory value
    """
    avg_demand = float(np.mean(units)) if len(units) > 0 else 0.0
    std_demand = float(np.std(units)) if len(units) > 1 else avg_demand * 0.20

    # Current stock: most recent non-null value
    valid_stock = stock_series.dropna()
    current_stock = float(valid_stock.iloc[-1]) if len(valid_stock) > 0 else 0.0
    has_stock_data = len(valid_stock) > 0

    if avg_demand <= 0:
        return {
            "avg_daily_demand": 0.0,
            "demand_std": 0.0,
            "current_stock": round(current_stock),
            "safety_stock": 0,
            "reorder_point": 0,
            "eoq": 0,
            "max_stock": 0,
            "days_remaining": 999.0,
            "status": "ok",
            "suggested_order_qty": 0,
            "has_stock_data": has_stock_data,
        }

    # Safety stock
    safety_stock = int(round(z * std_demand * np.sqrt(lead_time)))

    # Reorder point
    rop = int(round(avg_demand * lead_time + safety_stock))

    # EOQ — demand-proportional version (scales with avg demand, requires cost params)
    if order_cost > 0 and holding_cost_pct > 0:
        eoq = int(round(np.sqrt(2 * avg_demand * order_cost / holding_cost_pct)))
    else:
        # Fallback: order enough for 2× the lead time
        eoq = int(round(avg_demand * lead_time * 2))

    max_stock = rop + eoq

    # Days remaining on current stock
    days_remaining = round(current_stock / avg_demand, 1) if avg_demand > 0 else 999.0

    # Status
    if current_stock <= 0:
        status = "stockout"
    elif current_stock <= rop:
        status = "order_now"
    elif current_stock <= rop * 1.5:
        status = "watch"
    elif current_stock > max_stock * 1.2:
        status = "overstock"
    else:
        status = "ok"

    # Suggested order quantity — how many units to buy to reach max_stock
    if status in ("stockout", "order_now"):
        suggested_qty = max(0, int(round(max_stock - current_stock)))
    elif status == "watch":
        suggested_qty = max(0, int(round((rop + eoq) - current_stock)))
    else:
        suggested_qty = 0

    return {
        "avg_daily_demand": round(avg_demand, 1),
        "demand_std": round(std_demand, 1),
        "current_stock": round(current_stock),
        "safety_stock": safety_stock,
        "reorder_point": rop,
        "eoq": eoq,
        "max_stock": max_stock,
        "days_remaining": days_remaining,
        "status": status,
        "suggested_order_qty": suggested_qty,
        "has_stock_data": has_stock_data,
    }


def _status_order(status: str) -> int:
    """Sort order: most urgent first."""
    return {"stockout": 0, "order_now": 1, "watch": 2, "overstock": 3, "ok": 4}.get(status, 5)


# ─── Main optimization runner ────────────────────────────────────────────────

def run_inventory_optimization(
    df: pd.DataFrame,
    lead_time_days: int,
    service_level: float,
    order_cost: float,
    holding_cost_pct: float,
) -> dict:
    """
    Run inventory optimization for all SKUs in the DataFrame.

    Returns:
        params          – echoes back the input parameters
        has_stock_data  – whether stock_level column was present in the CSV
        has_warehouse_data – whether warehouse column was present
        summary         – aggregate status counts + total suggested units
        by_sku          – list of per-SKU metrics (aggregated across warehouses)
        by_warehouse    – list of per-warehouse summaries with SKU detail
    """
    z = SERVICE_LEVEL_Z.get(service_level, 1.645)
    has_stock_data = df["stock_level"].notna().any()
    has_warehouse_data = df["warehouse"].notna().any() and (df["warehouse"].nunique() > 1)

    # ── Per-SKU (aggregate across all warehouses) ─────────────────────────────
    by_sku = []
    for sku, grp in df.groupby("sku"):
        # Aggregate demand across warehouses
        daily_demand = grp.groupby("date")["units"].sum().values
        # Current stock = sum of latest stock per warehouse for this SKU
        if has_stock_data and grp["stock_level"].notna().any():
            # Per-warehouse latest stock, then sum
            if has_warehouse_data:
                wh_stocks = []
                for _, wh_grp in grp.groupby("warehouse"):
                    valid = wh_grp.dropna(subset=["stock_level"])
                    if len(valid) > 0:
                        wh_stocks.append(float(valid.sort_values("date")["stock_level"].iloc[-1]))
                agg_stock = pd.Series([sum(wh_stocks)] if wh_stocks else [np.nan])
            else:
                valid = grp.dropna(subset=["stock_level"])
                agg_stock = valid.sort_values("date")["stock_level"]
        else:
            agg_stock = pd.Series([np.nan])

        metrics = _compute_metrics(
            daily_demand, agg_stock, lead_time_days, z, order_cost, holding_cost_pct
        )
        by_sku.append({"sku": str(sku), "data_points": int(len(grp)), **metrics})

    by_sku.sort(key=lambda x: (_status_order(x["status"]), -x.get("suggested_order_qty", 0)))

    # ── Per-warehouse breakdown ───────────────────────────────────────────────
    by_warehouse = []
    if has_warehouse_data:
        for warehouse, wh_grp in df.groupby("warehouse"):
            wh_skus = []
            for sku, sku_grp in wh_grp.groupby("sku"):
                daily_demand = sku_grp.groupby("date")["units"].sum().values
                stock_col = sku_grp.sort_values("date")["stock_level"]
                metrics = _compute_metrics(
                    daily_demand, stock_col, lead_time_days, z, order_cost, holding_cost_pct
                )
                wh_skus.append({"sku": str(sku), "data_points": int(len(sku_grp)), **metrics})

            wh_skus.sort(key=lambda x: (_status_order(x["status"]), -x.get("suggested_order_qty", 0)))

            wh_summary = _summarize(wh_skus)
            by_warehouse.append({
                "warehouse": str(warehouse),
                "summary": wh_summary,
                "skus": wh_skus,
            })

        # Sort warehouses: most critical first (most order_now + stockout)
        by_warehouse.sort(
            key=lambda w: -(w["summary"]["stockout"] + w["summary"]["order_now"]),
        )

    # ── Overall summary ───────────────────────────────────────────────────────
    summary = _summarize(by_sku)

    return {
        "params": {
            "lead_time_days": lead_time_days,
            "service_level": service_level,
            "z_score": z,
            "order_cost": order_cost,
            "holding_cost_pct": holding_cost_pct,
        },
        "has_stock_data": bool(has_stock_data),
        "has_warehouse_data": bool(has_warehouse_data),
        "summary": summary,
        "by_sku": by_sku,
        "by_warehouse": by_warehouse,
    }


def _summarize(skus: list) -> dict:
    counts = {"stockout": 0, "order_now": 0, "watch": 0, "overstock": 0, "ok": 0}
    total_suggested = 0
    for s in skus:
        status = s.get("status", "ok")
        if status in counts:
            counts[status] += 1
        else:
            counts["ok"] += 1
        total_suggested += s.get("suggested_order_qty", 0)
    return {
        **counts,
        "total_skus": len(skus),
        "total_suggested_units": total_suggested,
    }
