from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

# ── Shared routers ────────────────────────────────────────────────────────────
from app.shared.routers import auth

# ── FMCG routers ─────────────────────────────────────────────────────────────
from app.industries.fmcg.routers import dashboard as fmcg_dashboard
from app.industries.fmcg.routers import inventory as fmcg_inventory
from app.industries.fmcg.routers import alerts as fmcg_alerts
from app.industries.fmcg.routers import contracts as fmcg_contracts
from app.industries.fmcg.routers import forecasting as fmcg_forecasting
from app.industries.fmcg.routers import ai as fmcg_ai
from app.industries.fmcg.routers import data as fmcg_data

# ── Logistics routers ────────────────────────────────────────────────────────
from app.industries.logistics.routers import data as logistics_data

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
