# =============================================================================
# Configuration — loads from .env
# =============================================================================
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # Google Gemini
    GEMINI_API_KEY: str = ""

    # App
    APP_NAME: str = "Student Result Analysis Platform"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,https://student-results-analysis-platfrom.vercel.app"
    DEBUG: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
