import logging
import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

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

    # Meta Platform (Bot)
    META_VERIFY_TOKEN: str = "omnikook_secret_verify_token"
    META_ACCESS_TOKEN: Optional[str] = None
    META_APP_SECRET: Optional[str] = None
    
    # Use pydantic_settings model config to load .env if present
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra='ignore')

    def get_database_url(self) -> str:
        # Prioritize DATABASE_URL
        url = self.DATABASE_URL
        if url:
            if "@" in url:
                masked = f"postgresql://***:***@{url.split('@')[-1]}"
                logger.info("Punto de conexión DB: %s", masked)
            else:
                logger.warning("DATABASE_URL encontrada pero el formato es inusual.")

            # Safety fix for protocol
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            return url

        logger.warning(
            "No se encontró DATABASE_URL. Usando config local: %s:%s",
            self.POSTGRES_SERVER, self.POSTGRES_PORT,
        )
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
