# PulseIQ — FastAPI Backend

Python FastAPI backend for the PulseIQ supply chain intelligence platform.

## Stack

- **FastAPI** — REST API framework
- **Supabase** — PostgreSQL database + auth + file storage
- **scikit-learn / pandas / numpy** — forecasting engine
- **httpx** — AI service calls (Groq, OpenAI, Anthropic)

## Folder Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app + router registration
│   ├── config.py            # Pydantic settings (reads .env)
│   ├── dependencies.py      # JWT auth via Supabase
│   ├── models/              # Pydantic request/response schemas
│   ├── routers/             # One file per API domain
│   │   ├── auth.py
│   │   ├── dashboard.py
│   │   ├── inventory.py
│   │   ├── alerts.py
│   │   ├── contracts.py
│   │   ├── forecasting.py
│   │   ├── ai.py
│   │   └── data.py
│   ├── services/            # Business logic
│   │   ├── auth_service.py
│   │   ├── forecast_service.py
│   │   └── ai_service.py
│   └── utils/
│       └── supabase_client.py
├── database/
│   └── schema.sql           # Run once in Supabase SQL editor
├── .env.example
├── requirements.txt
└── vercel.json
```

## Setup

### 1. Create Supabase tables

Open your [Supabase SQL editor](https://supabase.com/dashboard) and run `database/schema.sql`.

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:
| Key | Where to find it |
|-----|-----------------|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → `service_role` key |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) (free) |
| `FRONTEND_URL` | Your frontend URL, e.g. `http://localhost:5173` |

### 3. Install & run

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Verify

- API root: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dashboard/kpis` | KPI cards |
| `GET` | `/api/dashboard/demand-trend` | 30-day demand chart |
| `GET` | `/api/dashboard/top-skus` | Top 5 SKUs |
| `GET` | `/api/dashboard/inventory-snapshot` | Status breakdown |
| `GET` | `/api/inventory/overview` | Inventory health summary |
| `GET` | `/api/inventory/warehouses` | Warehouse list |
| `GET` | `/api/inventory/reorder-queue` | Items needing reorder |
| `GET` | `/api/inventory/abc-analysis` | ABC categorisation |
| `GET` | `/api/alerts` | Alert list (filter: resolved, severity) |
| `PATCH` | `/api/alerts/{id}/resolve` | Resolve an alert |
| `GET` | `/api/contracts` | Contract list |
| `POST` | `/api/contracts` | Create contract |
| `PATCH` | `/api/contracts/{id}` | Update contract |
| `DELETE` | `/api/contracts/{id}` | Delete contract |
| `GET` | `/api/forecasting` | Demand forecast |
| `GET` | `/api/forecasting/products` | SKUs available for forecasting |
| `GET` | `/api/forecasting/seasonality` | Day-of-week demand factors |
| `POST` | `/api/ai/chat` | AI chat message |
| `GET` | `/api/ai/sessions` | Chat session list |
| `GET` | `/api/ai/insights` | Auto-generated insights |
| `GET` | `/api/data/sources` | Uploaded file list |
| `DELETE` | `/api/data/sources/{id}` | Delete a data file |

## Deployment (Vercel)

```bash
cd backend
vercel          # preview
vercel --prod   # production
```

Set the same environment variables in the Vercel dashboard under Project → Settings → Environment Variables.
