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
    company_name: str | None = None
    industry: str | None = None
    role: str | None = None
    avatar_url: str | None = None
    onboarding_completed: bool = False
    created_at: datetime | None = None


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    company_name: str | None = None
    industry: str | None = None
    role: str | None = None
    avatar_url: str | None = None
