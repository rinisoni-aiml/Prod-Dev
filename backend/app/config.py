from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str

    frontend_url: str = "http://localhost:5173"

    groq_api_key: str | None = None
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None

    environment: str = "development"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
