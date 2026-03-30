"""
FMCG Demand Forecasting Service — XGBoost ML Pipeline

Architecture:
  1. parse_file_to_dataframe  — CSV/XLSX bytes → clean DataFrame (date, units, sku)
  2. add_features             — engineer lag, rolling, and calendar features
  3. train_model              — XGBoost (>=21 rows) or LinearRegression fallback
  4. forecast_future          — recursive multi-step prediction
  5. run_forecast_for_sku     — full pipeline for one SKU, returns frontend-ready dict
  6. run_all_skus_forecast    — orchestrates all SKUs + "All Products" aggregate
"""

import io
import numpy as np
import pandas as pd
from datetime import timedelta
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score, mean_squared_error
import xgboost as xgb


# ─── File parsing ────────────────────────────────────────────────────────────

def parse_file_to_dataframe(file_bytes: bytes, filename: str, column_mapping: dict) -> pd.DataFrame:
    """
    Parse raw CSV or Excel bytes into a clean DataFrame with columns:
        date (datetime64), units (float), sku (str)
    Uses column_mapping to resolve user-specific column names.
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

    if not date_col or not units_col:
        raise ValueError("column_mapping must include 'date' and 'units_sold'")
    if date_col not in raw.columns:
        raise ValueError(f"Date column '{date_col}' not found in file. Available: {list(raw.columns)}")
    if units_col not in raw.columns:
        raise ValueError(f"Units column '{units_col}' not found in file. Available: {list(raw.columns)}")

    df = pd.DataFrame()
    df["date"] = pd.to_datetime(raw[date_col], infer_datetime_format=True, errors="coerce")
    df["units"] = pd.to_numeric(raw[units_col], errors="coerce").fillna(0).clip(lower=0)
    df["sku"] = (
        raw[sku_col].astype(str).str.strip()
        if (sku_col and sku_col in raw.columns)
        else "All Products"
    )

    df = df.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)
    return df


def get_skus_from_dataframe(df: pd.DataFrame) -> list:
    """Return ['All Products', ...sorted SKUs...]."""
    skus = sorted(df["sku"].unique().tolist())
    return ["All Products"] + [s for s in skus if s != "All Products"]


# ─── Feature engineering ─────────────────────────────────────────────────────

FEATURE_COLS = [
    "day_idx", "dow", "month", "week_of_year",
    "lag_7", "lag_14", "lag_28",
    "roll_mean_7", "roll_mean_14", "roll_std_7",
]


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add time-series ML features to a single-SKU DataFrame.
    All lag/rolling features are computed on past values only (no leakage).
    """
    df = df.copy().sort_values("date").reset_index(drop=True)

    # Calendar features (trend + seasonality)
    df["day_idx"] = (df["date"] - df["date"].min()).dt.days
    df["dow"] = df["date"].dt.dayofweek          # 0=Mon … 6=Sun
    df["month"] = df["date"].dt.month
    df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)

    # Lag features — shifted so each row uses only historical values
    df["lag_7"] = df["units"].shift(7)
    df["lag_14"] = df["units"].shift(14)
    df["lag_28"] = df["units"].shift(28)

    # Rolling features — shift(1) prevents using the current day's value
    shifted = df["units"].shift(1)
    df["roll_mean_7"] = shifted.rolling(7, min_periods=1).mean()
    df["roll_mean_14"] = shifted.rolling(14, min_periods=1).mean()
    df["roll_std_7"] = shifted.rolling(7, min_periods=1).std().fillna(0)

    return df


# ─── Model training ──────────────────────────────────────────────────────────

def train_model(df: pd.DataFrame):
    """
    Train on the feature DataFrame.
    Uses XGBoost for >=21 usable rows; LinearRegression as a fallback.
    Returns (model, df_with_features, model_type_str).
    """
    df_feat = add_features(df)
    train = df_feat.dropna(subset=FEATURE_COLS)

    if len(train) < 7:
        return None, None, "insufficient_data"

    X = train[FEATURE_COLS].values
    y = train["units"].values

    if len(train) >= 21:
        model = xgb.XGBRegressor(
            n_estimators=300,
            learning_rate=0.08,
            max_depth=4,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=3,
            random_state=42,
            verbosity=0,
        )
        model_type = "xgboost"
    else:
        model = LinearRegression()
        model_type = "linear"

    model.fit(X, y)
    return model, df_feat, model_type


# ─── Recursive forecasting ───────────────────────────────────────────────────

def forecast_future(df_orig: pd.DataFrame, model, df_feat: pd.DataFrame, periods: int):
    """
    Recursive multi-step forecast.
    Each future prediction is appended to the buffer so next-step lag
    features are always available.

    Returns (forecast_list, r2_float, rmse_float).
    """
    # In-sample metrics
    train = df_feat.dropna(subset=FEATURE_COLS)
    X_train = train[FEATURE_COLS].values
    y_train = train["units"].values
    y_hat_train = np.clip(model.predict(X_train), 0, None).astype(float)

    r2 = float(r2_score(y_train, y_hat_train)) if len(y_train) > 1 else 0.0
    rmse = float(np.sqrt(mean_squared_error(y_train, y_hat_train)))

    # Rolling buffer for recursive prediction
    unit_buffer = list(df_orig.sort_values("date")["units"].values.astype(float))
    origin_date = df_orig["date"].min()
    last_date = df_orig["date"].max()
    last_day_idx = int((last_date - origin_date).days)

    forecast = []
    for i in range(1, periods + 1):
        future_date = last_date + timedelta(days=i)
        day_idx = last_day_idx + i
        dow = future_date.weekday()
        month = future_date.month
        woy = int(future_date.isocalendar()[1])

        n = len(unit_buffer)
        lag_7 = unit_buffer[-7] if n >= 7 else unit_buffer[0]
        lag_14 = unit_buffer[-14] if n >= 14 else unit_buffer[0]
        lag_28 = unit_buffer[-28] if n >= 28 else unit_buffer[0]
        roll_mean_7 = float(np.mean(unit_buffer[-7:])) if n >= 7 else float(np.mean(unit_buffer))
        roll_mean_14 = float(np.mean(unit_buffer[-14:])) if n >= 14 else float(np.mean(unit_buffer))
        roll_std_7 = float(np.std(unit_buffer[-7:])) if n >= 7 else 0.0

        row = np.array([[
            day_idx, dow, month, woy,
            lag_7, lag_14, lag_28,
            roll_mean_7, roll_mean_14, roll_std_7,
        ]])
        pred = max(0.0, float(model.predict(row)[0]))

        # Uncertainty grows with the square root of the horizon
        uncertainty = rmse * np.sqrt(i / 7.0)
        forecast.append({
            "date": future_date.strftime("%Y-%m-%d"),
            "forecast": round(pred),
            "upper": round(pred + 1.96 * uncertainty),
            "lower": round(max(0.0, pred - 1.96 * uncertainty)),
        })
        unit_buffer.append(pred)

    return forecast, r2, rmse


# ─── Metric helpers ──────────────────────────────────────────────────────────

def _weekly_factors(df: pd.DataFrame) -> list:
    df = df.copy()
    df["dow"] = df["date"].dt.dayofweek
    overall_avg = df["units"].mean()
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    if overall_avg == 0:
        return [{"day": d, "factor": 1.0} for d in days]
    return [
        {
            "day": day,
            "factor": round(
                float(df[df["dow"] == i]["units"].mean() / overall_avg)
                if not df[df["dow"] == i].empty else 1.0,
                3,
            ),
        }
        for i, day in enumerate(days)
    ]


def _historical_series(df: pd.DataFrame) -> list:
    df = df.sort_values("date").reset_index(drop=True)
    ma7 = df["units"].rolling(7, min_periods=1).mean()
    return [
        {
            "date": row["date"].strftime("%Y-%m-%d"),
            "actual": int(round(float(row["units"]))),
            "smoothed": int(round(float(ma7[i]))),
        }
        for i, row in df.iterrows()
    ]


def _trend_pct(units: np.ndarray) -> float:
    n = len(units)
    if n < 14:
        return 0.0
    half = n // 2
    early = units[:half].mean()
    late = units[half:].mean()
    return round(float((late - early) / early * 100) if early > 0 else 0.0, 1)


# ─── Main pipeline ───────────────────────────────────────────────────────────

def run_forecast_for_sku(df_sku: pd.DataFrame, periods: int) -> dict:
    """
    Full XGBoost pipeline for a single SKU.
    Returns a dict that the ForecastingPage can consume directly:
      { model, historical, forecast, metrics }
    or { error } on failure.
    """
    if len(df_sku) < 7:
        return {"error": "Need at least 7 data points to forecast."}

    try:
        model, df_feat, model_type = train_model(df_sku)
        if model is None:
            return {"error": "Not enough usable data after feature engineering."}

        forecast, r2, rmse = forecast_future(df_sku, model, df_feat, periods)
        historical = _historical_series(df_sku)
        weekly_factors = _weekly_factors(df_sku)

        units_arr = df_sku.sort_values("date")["units"].values.astype(float)
        total_forecast = sum(r["forecast"] for r in forecast)
        peak_row = max(forecast, key=lambda x: x["forecast"])

        return {
            "model": model_type,
            "historical": historical,
            "forecast": forecast,
            "metrics": {
                "r2": round(max(0.0, r2) * 100, 1),
                "rmse": round(rmse),
                "trendPct": _trend_pct(units_arr),
                "totalForecast": round(total_forecast),
                "avgDaily": round(total_forecast / periods) if periods else 0,
                "peakDay": peak_row["date"],
                "peakValue": peak_row["forecast"],
                "dataPoints": len(df_sku),
                "weeklyFactors": weekly_factors,
            },
        }
    except Exception as e:
        return {"error": str(e)}


def run_all_skus_forecast(df: pd.DataFrame, periods: int, max_skus: int = 30) -> dict:
    """
    Run the forecast pipeline for every SKU in the DataFrame plus the
    'All Products' aggregate.  Returns:
      { skus: [...], results: { "All Products": {...}, "SKU-001": {...}, ... } }
    """
    results = {}

    # Aggregate series (sum all SKUs by date)
    agg = df.groupby("date", as_index=False)["units"].sum()
    results["All Products"] = run_forecast_for_sku(agg, periods)

    # Per-SKU — limit to top SKUs by total sales volume
    top_skus = (
        df.groupby("sku")["units"]
        .sum()
        .sort_values(ascending=False)
        .head(max_skus)
        .index.tolist()
    )

    for sku in top_skus:
        df_sku = (
            df[df["sku"] == sku][["date", "units"]]
            .groupby("date", as_index=False)["units"]
            .sum()
        )
        results[sku] = run_forecast_for_sku(df_sku, periods)

    return {
        "skus": ["All Products"] + top_skus,
        "results": results,
    }


# ─── Legacy helper (used by old demand_history endpoint) ─────────────────────

def generate_forecast(historical_data: list, periods: int = 30) -> list:
    """Kept for the existing /api/fmcg/forecasting/ (demand_history) endpoint."""
    if not historical_data or len(historical_data) < 7:
        return []
    try:
        df = pd.DataFrame(historical_data)
        df["date"] = pd.to_datetime(df["date"])
        df = df.rename(columns={"quantity": "units"})
        result = run_forecast_for_sku(df, periods)
        return result.get("forecast", [])
    except Exception:
        return []
