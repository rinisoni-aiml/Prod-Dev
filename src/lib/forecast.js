/**
 * Forecasting logic has been moved to the Python FastAPI backend.
 * See: backend/app/services/fmcg/forecast_service.py
 *
 * The frontend now calls POST /api/fmcg/forecasting/run which runs
 * an XGBoost model server-side and returns structured results.
 *
 * This file is intentionally empty. Do not add ML or forecasting logic here.
 */
