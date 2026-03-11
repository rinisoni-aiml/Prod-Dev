# FastAPI Backend Setup Guide

This guide will help you set up a Python FastAPI backend to work with this React frontend.

## Quick Start

### 1. Create Backend Directory

```bash
mkdir backend
cd backend
```

### 2. Set Up Python Virtual Environment

```bash
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install fastapi uvicorn python-multipart python-jose[cryptography] passlib[bcrypt] python-dotenv supabase pydantic-settings
```

### 4. Create Basic FastAPI Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── models/
│   │   └── __init__.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── dashboard.py
│   │   ├── forecasting.py
│   │   ├── inventory.py
│   │   ├── contracts.py
│   │   ├── alerts.py
│   │   ├── ai.py
│   │   └── data.py
│   └── utils/
│       ├── __init__.py
│       ├── auth.py
│       └── supabase.py
├── .env
└── requirements.txt
```

### 5. Create main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, dashboard, forecasting, inventory, contracts, alerts, ai, data

app = FastAPI(title="PulseIQ API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(forecasting.router, prefix="/api/forecasting", tags=["forecasting"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["inventory"])
app.include_router(contracts.router, prefix="/api/contracts", tags=["contracts"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(data.router, prefix="/api/data", tags=["data"])

@app.get("/")
def read_root():
    return {"message": "PulseIQ API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

### 6. Create .env File

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_key

# JWT
SECRET_KEY=your-secret-key-here-generate-with-openssl
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# API
API_HOST=0.0.0.0
API_PORT=8000
```

### 7. Create config.py

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    class Config:
        env_file = ".env"

settings = Settings()
```

### 8. Create Supabase Client (app/utils/supabase.py)

```python
from supabase import create_client, Client
from app.config import settings

supabase: Client = create_client(settings.supabase_url, settings.supabase_key)
```

### 9. Create Auth Router (app/routers/auth.py)

```python
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings
from app.utils.supabase import supabase

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

@router.post("/login")
async def login(request: LoginRequest):
    # Implement your login logic with Supabase
    try:
        response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })
        
        token = create_access_token({"sub": request.email})
        return {"access_token": token, "token_type": "bearer"}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid credentials")

@router.post("/signup")
async def signup(request: SignupRequest):
    # Implement your signup logic with Supabase
    try:
        response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {
                "data": {"full_name": request.full_name}
            }
        })
        
        token = create_access_token({"sub": request.email})
        return {"access_token": token, "token_type": "bearer"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/profile")
async def get_profile():
    # Implement profile retrieval
    return {"email": "user@example.com", "full_name": "User Name"}
```

### 10. Create Other Routers

Create similar router files for:
- `dashboard.py` - Dashboard endpoints
- `forecasting.py` - Forecasting endpoints
- `inventory.py` - Inventory endpoints
- `contracts.py` - Contracts endpoints
- `alerts.py` - Alerts endpoints
- `ai.py` - AI endpoints
- `data.py` - Data upload endpoints

### 11. Run the Backend

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

API documentation will be at `http://localhost:8000/docs`

## Supabase Database Schema

### Users Table
```sql
create table users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  full_name text,
  created_at timestamp with time zone default now()
);
```

### Products Table
```sql
create table products (
  id uuid primary key default uuid_generate_v4(),
  sku text unique not null,
  name text not null,
  category text,
  created_at timestamp with time zone default now()
);
```

### Warehouses Table
```sql
create table warehouses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  location text,
  created_at timestamp with time zone default now()
);
```

### Inventory Table
```sql
create table inventory (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id),
  warehouse_id uuid references warehouses(id),
  quantity integer not null default 0,
  updated_at timestamp with time zone default now()
);
```

### Contracts Table
```sql
create table contracts (
  id uuid primary key default uuid_generate_v4(),
  contract_name text not null,
  vendor text not null,
  start_date date not null,
  end_date date not null,
  value numeric,
  status text,
  notes text,
  created_at timestamp with time zone default now()
);
```

### Alerts Table
```sql
create table alerts (
  id uuid primary key default uuid_generate_v4(),
  alert_type text not null,
  severity text not null,
  message text not null,
  sku text,
  warehouse text,
  is_resolved boolean default false,
  created_at timestamp with time zone default now()
);
```

## Testing the API

1. Start the backend: `uvicorn app.main:app --reload`
2. Start the frontend: `npm run dev`
3. Visit `http://localhost:8080`
4. Test login/signup functionality

## Next Steps

1. Implement all router endpoints
2. Add authentication middleware
3. Set up database models
4. Add data validation
5. Implement business logic
6. Add error handling
7. Write tests
8. Deploy to production

## Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Supabase Python Client](https://supabase.com/docs/reference/python/introduction)
- [Pydantic Documentation](https://docs.pydantic.dev/)
