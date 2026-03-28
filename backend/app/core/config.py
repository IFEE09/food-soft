import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Food-Soft POS MVP"
    API_V1_STR: str = "/api/v1"
    
    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "178601"
    POSTGRES_DB: str = "foodsoftdb"
    POSTGRES_PORT: str = "5432"
    
    # Use Railway's DATABASE_URL if provided, else construct local one
    DATABASE_URL: Optional[str] = None
    
    # Auth
    SECRET_KEY: str = "yoursecretkeyhere_changeinprod"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # Use pydantic_settings model config to load .env if present
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra='ignore')

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            # SQLAlchemy async might not like postgres:// instead of postgresql://
            if self.DATABASE_URL.startswith("postgres://"):
                return self.DATABASE_URL.replace("postgres://", "postgresql://", 1)
            return self.DATABASE_URL
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
