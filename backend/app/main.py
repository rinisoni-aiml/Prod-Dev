from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

# ── Shared routers ────────────────────────────────────────────────────────────
from app.shared.routers import auth

# ── FMCG routers ─────────────────────────────────────────────────────────────
# NOTE: Only dashboard is migrated so far. Run migrate_backend.py to complete.
from app.industries.fmcg.routers import dashboard as fmcg_dashboard

# Temporary: Import from old locations until migration is complete
from app.routers.fmcg import inventory as fmcg_inventory
from app.routers.fmcg import alerts as fmcg_alerts
from app.routers.fmcg import contracts as fmcg_contracts
from app.routers.fmcg import forecasting as fmcg_forecasting
from app.routers.fmcg import ai as fmcg_ai
from app.routers.fmcg import data as fmcg_data

# ── Logistics routers ────────────────────────────────────────────────────────
from app.routers.logistics import data as logistics_data

app = FastAPI(
    title="PulseIQ API",
    version="1.0.0",
    description="Multi-industry intelligence platform API — FMCG, Healthcare, Logistics and more.",
    redirect_slashes=False,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
origins = [settings.frontend_url.rstrip("/"), "http://localhost:5173", "http://localhost:8080"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Shared routes ─────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

# ── FMCG routes ───────────────────────────────────────────────────────────────
app.include_router(fmcg_dashboard.router,   prefix="/api/fmcg/dashboard",   tags=["FMCG - Dashboard"])
app.include_router(fmcg_inventory.router,   prefix="/api/fmcg/inventory",   tags=["FMCG - Inventory"])
app.include_router(fmcg_alerts.router,      prefix="/api/fmcg/alerts",      tags=["FMCG - Alerts"])
app.include_router(fmcg_contracts.router,   prefix="/api/fmcg/contracts",   tags=["FMCG - Contracts"])
app.include_router(fmcg_forecasting.router, prefix="/api/fmcg/forecasting", tags=["FMCG - Forecasting"])
app.include_router(fmcg_ai.router,          prefix="/api/fmcg/ai",          tags=["FMCG - AI"])
app.include_router(fmcg_data.router,        prefix="/api/fmcg/data",        tags=["FMCG - Data"])

# ── Logistics routes ──────────────────────────────────────────────────────────
app.include_router(logistics_data.router, prefix="/api/logistics/data", tags=["Logistics - Data"])


@app.get("/")
def root():
    return {"message": "PulseIQ API", "version": "1.0.0", "status": "running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


# Vercel serverless entry point
handler = app
