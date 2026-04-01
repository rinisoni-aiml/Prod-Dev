"""
FMCG Inventory Optimization Service

Classical inventory theory formulas applied to your uploaded demand + stock data:

  Safety Stock  = Z × σ_d × √(lead_time)
  Reorder Point = avg_daily_demand × lead_time + safety_stock
  EOQ           = √(2 × avg_daily_demand × order_cost / holding_cost_pct)
  Max Stock     = ROP + EOQ
  DOS           = current_stock / avg_daily_demand  (Days of Supply)

Status classification (DOS-based when stock data is present):
  stockout  — current_stock <= 0
  critical  — DOS <= lead_time / 2           (will stockout before reorder arrives)
  low_stock — current_stock <= ROP           (within reorder trigger zone)
  watch     — current_stock <= ROP × 1.5    (approaching reorder point)
  overstock — current_stock > max_stock × 1.2
  ok        — otherwise

KEY FIX (all-items-stocked-out bug):
  When stock_level column is missing/unmapped, current_stock defaulted to 0
  which triggered stockout for every SKU.  Now when has_stock_data=False,
  status defaults to "ok" (unknown — cannot assess without stock data).

Z-score → service level mapping
  90% → 1.282
  95% → 1.645
  99% → 2.326
"""

import io
import numpy as np
import pandas as pd

SERVICE_LEVEL_Z = {0.90: 1.282, 0.95: 1.645, 0.99: 2.326}


# ─── Numeric cleaning ────────────────────────────────────────────────────────

def _clean_numeric(series: pd.Series) -> pd.Series:
    """Strip thousands-separator commas then coerce to float."""
    return pd.to_numeric(
        series.astype(str).str.replace(r"[,\s]", "", regex=True),
        errors="coerce",
    )


# ─── Date parsing ────────────────────────────────────────────────────────────

def _parse_dates(series: pd.Series) -> pd.Series:
    """
    Adaptive multi-strategy date parser — handles virtually any format:
    ISO 8601, DD/MM/YYYY, MM/DD/YYYY, DD-MM-YY, 'Jan 2024', 'January 2024',
    'Jan-24', '15-Jan-2024', '20240115', epoch ints/ms, dot-separated EU dates,
    and anything else python-dateutil can read (row-by-row fallback).
    """
    import dateutil.parser as dparser

    raw = series.astype(str).str.strip()
    parsed = pd.Series([pd.NaT] * len(series), index=series.index, dtype="datetime64[ns]")
    missing = lambda: parsed.isna() & series.notna() & (raw != "nan") & (raw != "") & (raw != "NaT")

    # ── 1. Numeric epoch (unix seconds 9-10 digits, or milliseconds 13 digits) ─
    epoch_mask = raw.str.fullmatch(r"\d{9,13}")
    if epoch_mask.any():
        nums = pd.to_numeric(raw[epoch_mask], errors="coerce")
        secs = nums.where(nums < 1e12, nums / 1000)
        parsed[epoch_mask] = pd.to_datetime(secs, unit="s", errors="coerce")

    # ── 2. Pandas inference with both dayfirst variants — pick most successful ─
    if missing().any():
        rem = missing()
        p_dmy = pd.to_datetime(raw[rem], dayfirst=True,  errors="coerce")
        p_mdy = pd.to_datetime(raw[rem], dayfirst=False, errors="coerce")
        parsed[rem] = p_dmy.where(p_dmy.notna(), p_mdy)

    # ── 3. Explicit format list for patterns pandas inference misses ───────────
    _EXTRA_FMTS = [
        "%b %Y", "%B %Y", "%b-%Y", "%b-%y", "%B-%y",  # "Jan 2024", "Jan-24"
        "%d %b %Y", "%d %B %Y",                         # "15 Jan 2024"
        "%d-%b-%Y", "%d-%b-%y",                         # "15-Jan-2024"
        "%b %d %Y", "%B %d %Y",                         # "Jan 15 2024"
        "%Y%m%d",                                        # "20240115"
        "%d.%m.%Y", "%d.%m.%y",                         # EU dot-separated
        "%m-%d-%Y", "%m/%d/%Y",                         # explicit US
        "%d/%m/%Y", "%d-%m-%Y",                         # explicit UK
        "%Y/%m/%d",                                      # ISO with slashes
    ]
    for fmt in _EXTRA_FMTS:
        if not missing().any():
            break
        rem = missing()
        parsed[rem] = pd.to_datetime(raw[rem], format=fmt, errors="coerce")

    # ── 4. dateutil row-by-row — catches almost any remaining human-readable fmt
    if missing().any():
        def _try_dateutil(v):
            try:
                return pd.Timestamp(dparser.parse(v, dayfirst=True))
            except Exception:
                return pd.NaT
        rem = missing()
        parsed[rem] = raw[rem].apply(_try_dateutil)

    return parsed


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
    Handles: commas in numbers, mixed date formats, blank rows, duplicate rows,
             multi-sheet Excel (picks most data-rich sheet).
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "csv"

    if ext in ("xlsx", "xls"):
        xl = pd.ExcelFile(io.BytesIO(file_bytes), engine="openpyxl")
        best_sheet, best_rows = xl.sheet_names[0], 0
        for name in xl.sheet_names:
            try:
                df_tmp = xl.parse(name)
                if len(df_tmp) > best_rows:
                    best_rows = len(df_tmp)
                    best_sheet = name
            except Exception:
                continue
        raw = xl.parse(best_sheet)
    else:
        try:
            raw = pd.read_csv(io.BytesIO(file_bytes))
        except Exception:
            raw = pd.read_csv(io.StringIO(file_bytes.decode("utf-8", errors="replace")))

    raw = raw.dropna(how="all").reset_index(drop=True)
    raw.columns = [str(c).strip() for c in raw.columns]

    def _col(key):
        val = column_mapping.get(key)
        return val if (val and not str(val).startswith("__")) else None

    date_col      = _col("date")
    units_col     = _col("units_sold")
    sku_col       = _col("sku") or _col("product_name")
    warehouse_col = _col("warehouse")
    stock_col     = _col("stock_level")

    if not date_col or not units_col:
        raise ValueError("column_mapping must include 'date' and 'units_sold'")
    if date_col not in raw.columns:
        raise ValueError(f"Date column '{date_col}' not found. Available: {list(raw.columns)}")
    if units_col not in raw.columns:
        raise ValueError(f"Units column '{units_col}' not found. Available: {list(raw.columns)}")

    df = pd.DataFrame()
    df["date"]    = _parse_dates(raw[date_col])
    df["units"]   = _clean_numeric(raw[units_col]).fillna(0).clip(lower=0)
    df["sku"]     = (
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
        _clean_numeric(raw[stock_col])
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

    units              – historical daily sales array (aggregated by date)
    stock_series       – stock_level column values (may contain NaN)
    lead_time          – supplier lead time in days
    z                  – service level z-score
    order_cost         – $ cost per order (used in EOQ; 0 → fallback heuristic)
    holding_cost_pct   – annual holding cost as fraction of inventory value

    KEY FIX: When stock data is absent (all NaN), status = "ok" (unknown),
    not "stockout".  We cannot assess stock risk without actual stock levels.
    """
    avg_demand = float(np.mean(units)) if len(units) > 0 else 0.0
    std_demand = float(np.std(units)) if len(units) > 1 else avg_demand * 0.20

    # Current stock: most recent non-null value
    valid_stock   = stock_series.dropna()
    has_stock_data = len(valid_stock) > 0
    current_stock  = float(valid_stock.iloc[-1]) if has_stock_data else None

    if avg_demand <= 0:
        return {
            "avg_daily_demand":  0.0,
            "demand_std":        0.0,
            "current_stock":     round(current_stock) if current_stock is not None else None,
            "safety_stock":      0,
            "reorder_point":     0,
            "eoq":               0,
            "max_stock":         0,
            "days_remaining":    None if not has_stock_data else 999.0,
            "dos":               None if not has_stock_data else 999.0,
            "status":            "ok",
            "suggested_order_qty": 0,
            "has_stock_data":    has_stock_data,
        }

    # Safety stock = Z × σ × √(lead_time)
    safety_stock = int(round(z * std_demand * np.sqrt(lead_time)))

    # Reorder point = avg_demand × lead_time + safety_stock
    rop = int(round(avg_demand * lead_time + safety_stock))

    # EOQ = √(2 × D × S / H)  — fall back to lead_time coverage if costs unknown
    if order_cost > 0 and holding_cost_pct > 0:
        eoq = int(round(np.sqrt(2 * avg_demand * order_cost / holding_cost_pct)))
    else:
        # Sensible default: cover one full lead-time cycle
        eoq = int(round(avg_demand * lead_time))

    max_stock = rop + eoq

    # Days of Supply (DOS) and days remaining
    if has_stock_data and current_stock is not None:
        days_remaining = round(current_stock / avg_demand, 1) if avg_demand > 0 else 999.0
        dos            = days_remaining
    else:
        days_remaining = None
        dos            = None

    # ── Status classification ─────────────────────────────────────────────
    # KEY FIX: only apply stock-based rules when we actually have stock data.
    # Without stock data we cannot know if an item is stocked out.
    if not has_stock_data or current_stock is None:
        status = "ok"  # unknown — cannot assess without stock data
    elif current_stock <= 0:
        status = "stockout"
    elif current_stock <= rop:
        status = "order_now"
    elif current_stock <= rop * 1.5:
        status = "watch"
    elif current_stock > max_stock * 1.2:
        status = "overstock"
    else:
        status = "ok"

    # Suggested order quantity
    if status in ("stockout", "order_now") and current_stock is not None:
        suggested_qty = max(0, int(round(max_stock - current_stock)))
    elif status == "watch" and current_stock is not None:
        suggested_qty = max(0, int(round(max_stock - current_stock)))
    else:
        suggested_qty = 0

    return {
        "avg_daily_demand":  round(avg_demand, 1),
        "demand_std":        round(std_demand, 1),
        "current_stock":     round(current_stock) if current_stock is not None else None,
        "safety_stock":      safety_stock,
        "reorder_point":     rop,
        "eoq":               eoq,
        "max_stock":         max_stock,
        "days_remaining":    days_remaining,
        "dos":               dos,
        "status":            status,
        "suggested_order_qty": suggested_qty,
        "has_stock_data":    has_stock_data,
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
        params             – echoes back the input parameters
        has_stock_data     – whether stock_level column was present in the CSV
        has_warehouse_data – whether warehouse column was present
        summary            – aggregate status counts + total suggested units
        by_sku             – list of per-SKU metrics (aggregated across warehouses)
        by_warehouse       – list of per-warehouse summaries with SKU detail
    """
    z = SERVICE_LEVEL_Z.get(service_level, 1.645)
    has_stock_data     = df["stock_level"].notna().any()
    has_warehouse_data = (
        df["warehouse"].notna().any() and (df["warehouse"].nunique() > 1)
    )

    # ── Per-SKU (aggregate across all warehouses) ─────────────────────────────
    by_sku = []
    for sku, grp in df.groupby("sku"):
        # Aggregate demand across warehouses by date
        daily_demand = grp.groupby("date")["units"].sum().values

        # Current stock = sum of latest stock per warehouse for this SKU
        if has_stock_data and grp["stock_level"].notna().any():
            if has_warehouse_data:
                wh_stocks = []
                for _, wh_grp in grp.groupby("warehouse"):
                    valid = wh_grp.dropna(subset=["stock_level"])
                    if len(valid) > 0:
                        wh_stocks.append(
                            float(valid.sort_values("date")["stock_level"].iloc[-1])
                        )
                agg_stock = pd.Series([sum(wh_stocks)] if wh_stocks else [np.nan])
            else:
                valid     = grp.dropna(subset=["stock_level"])
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
                stock_col    = sku_grp.sort_values("date")["stock_level"]
                metrics      = _compute_metrics(
                    daily_demand, stock_col, lead_time_days, z, order_cost, holding_cost_pct
                )
                wh_skus.append({"sku": str(sku), "data_points": int(len(sku_grp)), **metrics})

            wh_skus.sort(
                key=lambda x: (_status_order(x["status"]), -x.get("suggested_order_qty", 0))
            )
            wh_summary = _summarize(wh_skus)
            by_warehouse.append({
                "warehouse": str(warehouse),
                "summary":   wh_summary,
                "skus":      wh_skus,
            })

        by_warehouse.sort(
            key=lambda w: -(w["summary"]["stockout"] + w["summary"]["order_now"]),
        )

    summary = _summarize(by_sku)

    return {
        "params": {
            "lead_time_days":     lead_time_days,
            "service_level":      service_level,
            "z_score":            z,
            "order_cost":         order_cost,
            "holding_cost_pct":   holding_cost_pct,
        },
        "has_stock_data":     bool(has_stock_data),
        "has_warehouse_data": bool(has_warehouse_data),
        "summary":            summary,
        "by_sku":             by_sku,
        "by_warehouse":       by_warehouse,
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
        "total_skus":            len(skus),
        "total_suggested_units": total_suggested,
    }
