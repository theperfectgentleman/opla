import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Project Info
    PROJECT_NAME: str = "Opla Platform"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    
    # Database
    DATABASE_URL: str
    
    # JWT Authentication
    JWT_SECRET_KEY: str
    JWT_REFRESH_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Redis (for OTP and caching)
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # OTP Configuration
    OTP_EXPIRY_MINUTES: int = 5
    OTP_LENGTH: int = 6
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:4173,http://localhost:4174,http://localhost:4175,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:4173,http://127.0.0.1:4174,http://127.0.0.1:4175,http://127.0.0.1:5173"

    # Groq (AI survey builder)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"

    # SMS broadcasts (project Messages → Broadcasts). Off unless SMS_PROVIDER is set.
    # SMS_PROVIDER: "" (off) | "mnotify" | "fake" (local dev/tests only, refused in production)
    SMS_PROVIDER: str = ""
    MNOTIFY_API_KEY: str = ""
    # Must be a sender ID already approved on the mNotify account (max 11 characters).
    MNOTIFY_SENDER_ID: str = ""
    MNOTIFY_BASE_URL: str = "https://api.mnotify.com/api"
    # Recipients per provider request, pause between requests, and cap per broadcast.
    SMS_BATCH_SIZE: int = 100
    SMS_BATCH_DELAY_SECONDS: float = 0.5
    SMS_MAX_RECIPIENTS: int = 5000
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Convert comma-separated CORS origins to list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        case_sensitive = True
        extra = "ignore"
        # Calculate path: app/core/config.py -> app/core -> app -> opla-backend -> opla -> .env
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ".env")

settings = Settings()

