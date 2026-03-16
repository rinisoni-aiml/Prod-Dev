from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, dashboard, inventory, alerts, contracts, forecasting, ai, data

app = FastAPI(
    title="PulseIQ API",
    version="1.0.0",
    description="Supply Chain Management API — FMCG Intelligence Platform",
)

# ── CORS ────────────────────────────────────────────────────────────────────
origins = [settings.frontend_url, "http://localhost:5173", "http://localhost:8080"]
if settings.environment == "production":
    origins.append("https://*.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router,        prefix="/api/auth",        tags=["Auth"])
app.include_router(dashboard.router,   prefix="/api/dashboard",   tags=["Dashboard"])
app.include_router(inventory.router,   prefix="/api/inventory",   tags=["Inventory"])
app.include_router(alerts.router,      prefix="/api/alerts",      tags=["Alerts"])
app.include_router(contracts.router,   prefix="/api/contracts",   tags=["Contracts"])
app.include_router(forecasting.router, prefix="/api/forecasting", tags=["Forecasting"])
app.include_router(ai.router,          prefix="/api/ai",          tags=["AI"])
app.include_router(data.router,        prefix="/api/data",        tags=["Data"])


@app.get("/")
def root():
    return {"message": "PulseIQ API", "version": "1.0.0", "status": "running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


# Vercel serverless entry point
handler = app
