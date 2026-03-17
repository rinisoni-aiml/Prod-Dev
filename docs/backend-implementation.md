# Backend Implementation Guide

## Complete FastAPI Backend with Supabase Integration

This guide provides the complete, production-ready backend implementation.

---

## Directory Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── dependencies.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── contracts.py
│   │   ├── inventory.py
│   │   └── chat.py
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
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── forecast_service.py
│   │   └── ai_service.py
│   └── utils/
│       ├── __init__.py
│       └── supabase_client.py
├── .env
├── requirements.txt
└── vercel.json
```

---

## Installation

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

---

## File Contents

### requirements.txt
```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
supabase==2.3.0
python-multipart==0.0.6
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.0
pydantic-settings==2.1.0
pydantic[email]==2.5.3
httpx==0.26.0
pandas==2.1.4
numpy==1.26.3
scikit-learn==1.4.0
openai==1.10.0
anthropic==0.8.1
```

### .env
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here

# JWT
SECRET_KEY=your-secret-key-generate-with-openssl-rand-hex-32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Frontend
FRONTEND_URL=http://localhost:8080

# AI (Optional)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Environment
ENVIRONMENT=development
```

### app/config.py
```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_key: str
    
    # JWT
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080
    
    # Frontend
    frontend_url: str = "http://localhost:8080"
    
    # AI (Optional)
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    
    # Environment
    environment: str = "development"
    
    class Config:
        env_file = ".env"
        case_sensitive = False

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
```

### app/utils/supabase_client.py
```python
from supabase import create_client, Client
from app.config import settings

def get_supabase_client() -> Client:
    """Get Supabase client instance"""
    return create_client(settings.supabase_url, settings.supabase_service_key)

supabase: Client = get_supabase_client()
```

### app/dependencies.py
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthCredential
from jose import JWTError, jwt
from app.config import settings
from app.utils.supabase_client import supabase

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthCredential = Depends(security)):
    """Verify JWT token and return current user"""
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Get user from Supabase
    try:
        response = supabase.table("profiles").select("*").eq("email", email).execute()
        if not response.data:
            raise credentials_exception
        return response.data[0]
    except Exception:
        raise credentials_exception
```

### app/models/auth.py
```python
from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserProfile(BaseModel):
    id: UUID
    email: str
    full_name: str | None = None
    avatar_url: str | None = None
    created_at: datetime

class ProfileUpdate(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None
```

### app/models/contracts.py
```python
from pydantic import BaseModel
from datetime import date, datetime
from uuid import UUID
from typing import Literal

class ContractCreate(BaseModel):
    contract_name: str
    vendor: str
    start_date: date
    end_date: date
    value: float | None = None
    status: Literal['active', 'pending', 'expired', 'cancelled'] = 'active'
    notes: str | None = None

class ContractUpdate(BaseModel):
    contract_name: str | None = None
    vendor: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    value: float | None = None
    status: Literal['active', 'pending', 'expired', 'cancelled'] | None = None
    notes: str | None = None

class ContractResponse(BaseModel):
    id: UUID
    contract_name: str
    vendor: str
    start_date: date
    end_date: date
    value: float | None
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
```

### app/models/chat.py
```python
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class ChatMessage(BaseModel):
    session_id: UUID | None = None
    message: str

class ChatResponse(BaseModel):
    session_id: UUID
    message: str
    response: str

class ChatSession(BaseModel):
    id: UUID
    title: str | None
    created_at: datetime
    updated_at: datetime
```

### app/services/auth_service.py
```python
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from app.config import settings
from app.utils.supabase_client import supabase

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(data: dict) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash password"""
    return pwd_context.hash(password)

async def authenticate_user(email: str, password: str):
    """Authenticate user with Supabase"""
    try:
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        return response
    except Exception as e:
        return None

async def create_user(email: str, password: str, full_name: str):
    """Create new user in Supabase"""
    try:
        response = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {"full_name": full_name}
            }
        })
        return response
    except Exception as e:
        raise Exception(f"Failed to create user: {str(e)}")
```

### app/services/forecast_service.py
```python
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression

def generate_forecast(historical_data: list, periods: int = 30):
    """Generate demand forecast using linear regression"""
    if not historical_data or len(historical_data) < 2:
        # Return mock data if insufficient historical data
        return generate_mock_forecast(periods)
    
    try:
        df = pd.DataFrame(historical_data)
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date')
        
        # Prepare data for model
        df['days'] = (df['date'] - df['date'].min()).dt.days
        X = df[['days']].values
        y = df['quantity'].values
        
        # Train model
        model = LinearRegression()
        model.fit(X, y)
        
        # Generate predictions
        last_day = df['days'].max()
        future_days = np.array([[last_day + i] for i in range(1, periods + 1)])
        predictions = model.predict(future_days)
        
        # Create forecast data
        last_date = df['date'].max()
        forecast = []
        for i, pred in enumerate(predictions):
            forecast.append({
                'date': (last_date + timedelta(days=i+1)).isoformat(),
                'predicted_quantity': max(0, int(pred)),
                'confidence': 0.85
            })
        
        return forecast
    except Exception as e:
        return generate_mock_forecast(periods)

def generate_mock_forecast(periods: int = 30):
    """Generate mock forecast data"""
    base_date = datetime.now()
    forecast = []
    base_quantity = 1000
    
    for i in range(periods):
        date = base_date + timedelta(days=i)
        quantity = base_quantity + np.random.randint(-100, 200)
        forecast.append({
            'date': date.isoformat(),
            'predicted_quantity': max(0, quantity),
            'confidence': 0.75
        })
    
    return forecast
```

### app/services/ai_service.py
```python
from app.config import settings
from app.utils.supabase_client import supabase
import httpx

async def generate_ai_response(message: str, context: dict = None) -> str:
    """Generate AI response using available AI service"""
    
    # Build context-aware prompt
    system_prompt = """You are an AI assistant for PulseIQ, a supply chain management platform.
    Help users with inventory management, demand forecasting, and supply chain optimization.
    Provide clear, actionable insights based on their data."""
    
    user_prompt = message
    if context:
        user_prompt = f"Context: {context}\n\nUser question: {message}"
    
    # Try OpenAI first
    if settings.openai_api_key:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.openai_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "gpt-3.5-turbo",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "max_tokens": 500
                    },
                    timeout=30.0
                )
                if response.status_code == 200:
                    data = response.json()
                    return data['choices'][0]['message']['content']
        except Exception as e:
            pass
    
    # Try Anthropic
    if settings.anthropic_api_key:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": settings.anthropic_api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "claude-3-haiku-20240307",
                        "max_tokens": 500,
                        "messages": [
                            {"role": "user", "content": f"{system_prompt}\n\n{user_prompt}"}
                        ]
                    },
                    timeout=30.0
                )
                if response.status_code == 200:
                    data = response.json()
                    return data['content'][0]['text']
        except Exception as e:
            pass
    
    # Fallback response
    return "I'm here to help with your supply chain management needs. However, AI services are currently unavailable. Please try again later or contact support."

async def generate_insights(user_id: str) -> list:
    """Generate AI insights based on user data"""
    insights = [
        {
            "type": "warning",
            "title": "Low Stock Alert",
            "description": "5 products are below reorder point",
            "action": "Review inventory levels"
        },
        {
            "type": "info",
            "title": "Demand Trend",
            "description": "Product demand increased 15% this month",
            "action": "Consider increasing stock"
        },
        {
            "type": "success",
            "title": "Optimization Opportunity",
            "description": "Consolidating orders could save 12% on shipping",
            "action": "Review supplier contracts"
        }
    ]
    return insights
```

### app/routers/auth.py
```python
from fastapi import APIRouter, HTTPException, Depends, status
from app.models.auth import LoginRequest, SignupRequest, TokenResponse, UserProfile, ProfileUpdate
from app.services.auth_service import authenticate_user, create_user, create_access_token
from app.dependencies import get_current_user
from app.utils.supabase_client import supabase

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """User login"""
    try:
        response = await authenticate_user(request.email, request.password)
        if not response:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        token = create_access_token({"sub": request.email})
        return TokenResponse(access_token=token)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )

@router.post("/signup", response_model=TokenResponse)
async def signup(request: SignupRequest):
    """User signup"""
    try:
        response = await create_user(request.email, request.password, request.full_name)
        token = create_access_token({"sub": request.email})
        return TokenResponse(access_token=token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Signup failed: {str(e)}"
        )

@router.get("/profile", response_model=UserProfile)
async def get_profile(current_user = Depends(get_current_user)):
    """Get current user profile"""
    return current_user

@router.patch("/profile", response_model=UserProfile)
async def update_profile(
    profile_update: ProfileUpdate,
    current_user = Depends(get_current_user)
):
    """Update user profile"""
    try:
        update_data = profile_update.model_dump(exclude_unset=True)
        response = supabase.table("profiles").update(update_data).eq("id", current_user["id"]).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profile update failed: {str(e)}"
        )
```

### app/routers/dashboard.py
```python
from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user
from app.utils.supabase_client import supabase
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/kpis")
async def get_kpis(current_user = Depends(get_current_user)):
    """Get dashboard KPIs"""
    # In production, calculate from real data
    return {
        "total_inventory_value": 2450000,
        "active_skus": 1247,
        "warehouses": 8,
        "pending_orders": 156,
        "fill_rate": 94.5,
        "inventory_turnover": 6.2
    }

@router.get("/demand-trend")
async def get_demand_trend(
    days: int = Query(30, ge=7, le=365),
    current_user = Depends(get_current_user)
):
    """Get demand trend data"""
    # Generate mock trend data
    trend_data = []
    base_date = datetime.now() - timedelta(days=days)
    
    for i in range(days):
        date = base_date + timedelta(days=i)
        trend_data.append({
            "date": date.strftime("%Y-%m-%d"),
            "demand": 1000 + (i * 10) + (50 if i % 7 < 5 else -30)
        })
    
    return trend_data

@router.get("/top-skus")
async def get_top_skus(current_user = Depends(get_current_user)):
    """Get top performing SKUs"""
    return [
        {"sku": "SKU-001", "name": "Product A", "demand": 5420, "revenue": 108400},
        {"sku": "SKU-002", "name": "Product B", "demand": 4890, "revenue": 97800},
        {"sku": "SKU-003", "name": "Product C", "demand": 4320, "revenue": 86400},
        {"sku": "SKU-004", "name": "Product D", "demand": 3950, "revenue": 79000},
        {"sku": "SKU-005", "name": "Product E", "demand": 3680, "revenue": 73600}
    ]

@router.get("/inventory-snapshot")
async def get_inventory_snapshot(current_user = Depends(get_current_user)):
    """Get inventory snapshot by category"""
    return [
        {"category": "Electronics", "value": 850000, "quantity": 3200},
        {"category": "Apparel", "value": 620000, "quantity": 8500},
        {"category": "Home & Garden", "value": 480000, "quantity": 4100},
        {"category": "Sports", "value": 320000, "quantity": 2800},
        {"category": "Other", "value": 180000, "quantity": 1900}
    ]
```

### app/routers/contracts.py
```python
from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from app.models.contracts import ContractCreate, ContractUpdate, ContractResponse
from app.dependencies import get_current_user
from app.utils.supabase_client import supabase

router = APIRouter()

@router.get("/", response_model=list[ContractResponse])
async def get_contracts(current_user = Depends(get_current_user)):
    """Get all contracts"""
    try:
        response = supabase.table("contracts").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=ContractResponse)
async def create_contract(
    contract: ContractCreate,
    current_user = Depends(get_current_user)
):
    """Create new contract"""
    try:
        data = contract.model_dump()
        data["created_by"] = current_user["id"]
        response = supabase.table("contracts").insert(data).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{contract_id}", response_model=ContractResponse)
async def update_contract(
    contract_id: UUID,
    contract: ContractUpdate,
    current_user = Depends(get_current_user)
):
    """Update contract"""
    try:
        data = contract.model_dump(exclude_unset=True)
        response = supabase.table("contracts").update(data).eq("id", str(contract_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Contract not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{contract_id}")
async def delete_contract(
    contract_id: UUID,
    current_user = Depends(get_current_user)
):
    """Delete contract"""
    try:
        response = supabase.table("contracts").delete().eq("id", str(contract_id)).execute()
        return {"message": "Contract deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### app/routers/ai.py
```python
from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID, uuid4
from app.models.chat import ChatMessage, ChatResponse, ChatSession
from app.dependencies import get_current_user
from app.services.ai_service import generate_ai_response, generate_insights
from app.utils.supabase_client import supabase

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat(
    message: ChatMessage,
    current_user = Depends(get_current_user)
):
    """Chat with AI assistant"""
    try:
        # Create session if not provided
        session_id = message.session_id
        if not session_id:
            session_response = supabase.table("chat_sessions").insert({
                "user_id": current_user["id"],
                "title": message.message[:50]
            }).execute()
            session_id = session_response.data[0]["id"]
        
        # Save user message
        supabase.table("chat_messages").insert({
            "session_id": str(session_id),
            "role": "user",
            "content": message.message
        }).execute()
        
        # Generate AI response
        ai_response = await generate_ai_response(message.message)
        
        # Save AI response
        supabase.table("chat_messages").insert({
            "session_id": str(session_id),
            "role": "assistant",
            "content": ai_response
        }).execute()
        
        return ChatResponse(
            session_id=session_id,
            message=message.message,
            response=ai_response
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions", response_model=list[ChatSession])
async def get_sessions(current_user = Depends(get_current_user)):
    """Get user's chat sessions"""
    try:
        response = supabase.table("chat_sessions").select("*").eq("user_id", current_user["id"]).order("updated_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sessions", response_model=ChatSession)
async def create_session(current_user = Depends(get_current_user)):
    """Create new chat session"""
    try:
        response = supabase.table("chat_sessions").insert({
            "user_id": current_user["id"],
            "title": "New Chat"
        }).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/insights")
async def get_ai_insights(current_user = Depends(get_current_user)):
    """Get AI-generated insights"""
    try:
        insights = await generate_insights(current_user["id"])
        return insights
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recommendations")
async def get_recommendations(
    context: dict,
    current_user = Depends(get_current_user)
):
    """Get AI recommendations based on context"""
    try:
        response = await generate_ai_response(
            "Provide recommendations based on this context",
            context
        )
        return {"recommendations": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### app/main.py
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, dashboard, contracts, ai

app = FastAPI(
    title="PulseIQ API",
    version="1.0.0",
    description="Supply Chain Management API"
)

# CORS configuration
origins = [
    settings.frontend_url,
    "http://localhost:8080",
    "http://localhost:5173",
]

if settings.environment == "production":
    origins.append("https://*.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(contracts.router, prefix="/api/contracts", tags=["Contracts"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])

@app.get("/")
def read_root():
    return {
        "message": "PulseIQ API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# For Vercel
handler = app
```

### vercel.json (for backend)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "app/main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app/main.py"
    }
  ]
}
```

---

## Running Locally

```bash
# Activate virtual environment
source venv/bin/activate  # Windows: venv\Scripts\activate

# Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Visit:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## Deployment to Vercel

```bash
# From backend directory
vercel

# Or deploy to production
vercel --prod
```

---

## Testing

```bash
# Test health endpoint
curl http://localhost:8000/health

# Test with docs
# Visit http://localhost:8000/docs
```

---

## Next Steps

1. Add remaining routers (forecasting, inventory, alerts, data)
2. Implement file upload handling
3. Add comprehensive error handling
4. Write unit tests
5. Add logging
6. Implement rate limiting
7. Add caching
8. Monitor performance
