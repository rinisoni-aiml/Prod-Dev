import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression


def generate_forecast(historical_data: list, periods: int = 30) -> list:
    """Generate demand forecast using linear regression with weekly seasonality."""
    if not historical_data or len(historical_data) < 7:
        return []

    try:
        df = pd.DataFrame(historical_data)
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").reset_index(drop=True)

        df["days"] = (df["date"] - df["date"].min()).dt.days
        df["dow"] = df["date"].dt.dayofweek

        dow_dummies = pd.get_dummies(df["dow"], prefix="dow", drop_first=True)
        X = pd.concat([df[["days"]], dow_dummies], axis=1).values
        y = df["quantity"].values

        model = LinearRegression()
        model.fit(X, y)

        last_day = df["days"].max()
        last_date = df["date"].max()
        forecast = []

        for i in range(1, periods + 1):
            future_date = last_date + timedelta(days=i)
            future_day = last_day + i
            future_dow = future_date.weekday()
            dow_row = {f"dow_{j}": int(future_dow == j) for j in range(1, 7)}
            row = np.array([[future_day] + [dow_row.get(f"dow_{j}", 0) for j in range(1, 7)]])
            pred = max(0, float(model.predict(row)[0]))
            residual_std = float(np.std(y - model.predict(X)))
            forecast.append({
                "date": future_date.strftime("%Y-%m-%d"),
                "predicted_quantity": round(pred),
                "upper": round(pred + 1.96 * residual_std),
                "lower": round(max(0, pred - 1.96 * residual_std)),
                "confidence": 0.85,
            })

        return forecast
    except Exception:
        return []
