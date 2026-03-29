import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Food-Soft POS MVP"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: Optional[str] = None
    
    # Fallback (Local Dev Only)
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "178601"
    POSTGRES_DB: str = "foodsoftdb"
    POSTGRES_PORT: str = "5432"
    
    # Auth
    SECRET_KEY: str = "yoursecretkeyhere_changeinprod"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # Use pydantic_settings model config to load .env if present
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra='ignore')

    def get_database_url(self) -> str:
        # Prioritize the DATABASE_URL provided by Railway
        url = self.DATABASE_URL
        
        if url:
            print(f"DEBUG: Using DATABASE_URL from environment.")
            # Fix for some older clients/drivers
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            return url
        
        # Fallback for local development
        print(f"DEBUG: No DATABASE_URL found. Falling back to local/manual config.")
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
