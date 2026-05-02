import logging
from typing import List, Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

_DEFAULT_SECRET = "yoursecretkeyhere_changeinprod"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Food-Soft POS MVP"
    API_V1_STR: str = "/api/v1"

    # development | production
    ENV: str = "development"
    # Orígenes CORS separados por coma (requerido si ENV=production)
    ALLOWED_ORIGINS: Optional[str] = None
    
    # Database
    DATABASE_URL: Optional[str] = None
    
    # Fallback (Local Dev Only)
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "178601"
    POSTGRES_DB: str = "foodsoftdb"
    POSTGRES_PORT: str = "5432"
    
    # Auth (no usar el valor por defecto en producción)
    SECRET_KEY: str = _DEFAULT_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    # False en producción salvo que quieras registro abierto (definir True solo en dev si hace falta)
    PUBLIC_REGISTRATION_ENABLED: bool = False

    # Meta Platform (Bot)
    META_VERIFY_TOKEN: str = "omnikook_secret_verify_token"
    META_ACCESS_TOKEN: Optional[str] = None
    META_APP_SECRET: Optional[str] = None

    # WhatsApp/Meta bot → internal orders (until mapped per phone_number_id)
    DEFAULT_BOT_ORGANIZATION_ID: int = 1
    
    # Use pydantic_settings model config to load .env if present
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra='ignore')

    @model_validator(mode="after")
    def validate_production(self):
        if self.ENV == "production":
            if self.SECRET_KEY == _DEFAULT_SECRET:
                raise ValueError(
                    "SECRET_KEY no puede ser el valor por defecto cuando ENV=production."
                )
            if not (self.ALLOWED_ORIGINS or "").strip():
                raise ValueError(
                    "ALLOWED_ORIGINS es obligatorio cuando ENV=production (lista separada por comas)."
                )
            if self.PUBLIC_REGISTRATION_ENABLED:
                logger.warning(
                    "PUBLIC_REGISTRATION_ENABLED=True: el endpoint /auth/register está expuesto."
                )
        return self

    def get_cors_origins(self) -> List[str]:
        raw = (self.ALLOWED_ORIGINS or "").strip()
        if raw:
            return [o.strip() for o in raw.split(",") if o.strip()]
        return ["*"]

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
