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
        # 1. Try individual variables (High priority for Railway)
        if self.DATABASE_URL and "railway.internal" in self.DATABASE_URL:
             # Use the provided URL but ensure it's the right protocol
             url = self.DATABASE_URL
             if url.startswith("postgres://"):
                 url = url.replace("postgres://", "postgresql://", 1)
             print(f"DEBUG: Using Injected DATABASE_URL")
             return url

        # 2. Check if we have individual components (More robust)
        if self.POSTGRES_PASSWORD != "178601": # If it's not the default local one
            print(f"DEBUG: Using individual POSTGRES variables.")
            return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        
        # 3. Fallback for Local Dev
        print(f"DEBUG: Falling back to local/manual config.")
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
