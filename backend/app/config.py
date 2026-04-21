from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    database_url: str | None = None
    secret_key: str | None = None
    allowed_origins: str | None = None

    supabase_url: str | None = None
    supabase_service_key: str | None = None

    frontend_url: str = "http://localhost:8080"

    groq_api_key: str | None = None
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None

    environment: str = "development"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()