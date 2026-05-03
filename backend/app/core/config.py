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
    
    # Fallback (Local Dev Only) — contraseña solo en .env, no en código.
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "foodsoftdb"
    POSTGRES_PORT: str = "5432"
    
    # Auth (no usar el valor por defecto en producción)
    SECRET_KEY: str = _DEFAULT_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # False en producción salvo que quieras registro abierto (definir True solo en dev si hace falta)
    PUBLIC_REGISTRATION_ENABLED: bool = False
    # OpenAPI /docs: nunca en ENV=production; en dev desactivar con EXPOSE_OPENAPI=false
    EXPOSE_OPENAPI: bool = True

    # Meta Platform (Bot) — definir en .env (verify token del webhook Meta).
    META_VERIFY_TOKEN: str = ""
    META_ACCESS_TOKEN: Optional[str] = None
    META_APP_SECRET: Optional[str] = None

    # Si True, permite POST /bot/mock fuera de producción. Por seguridad, por defecto es False.
    ENABLE_BOT_MOCK_ENDPOINT: bool = False
    
    # Use pydantic_settings model config to load .env if present
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra='ignore')

    @model_validator(mode="after")
    def validate_production(self):
        if self.ENV == "production":
            # Forzar apagado de endpoints de prueba/mock en producción
            self.ENABLE_BOT_MOCK_ENDPOINT = False
            
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
            if not (self.META_APP_SECRET or "").strip():
                logger.warning(
                    "META_APP_SECRET vacío: POST /bot/webhook responde 503 hasta configurarlo."
                )
            if not (self.META_VERIFY_TOKEN or "").strip():
                logger.warning(
                    "META_VERIFY_TOKEN vacío: GET /bot/webhook (handshake Meta) fallará."
                )
        return self

    @model_validator(mode="after")
    def warn_default_secret_in_dev(self):
        if self.ENV != "production" and self.SECRET_KEY == _DEFAULT_SECRET:
            logger.warning(
                "SECRET_KEY sigue siendo el valor por defecto; cambiar en .env antes de exponer la API."
            )
        return self

    def get_cors_origins(self) -> List[str]:
        raw = (self.ALLOWED_ORIGINS or "").strip()
        if raw:
            return [o.strip() for o in raw.split(",") if o.strip()]
        
        # Orígenes por defecto para desarrollo y tus dominios específicos de Railway
        origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            # Tu dominio de frontend específico (detectado en consola)
            "https://compassionate-blessing-production-bc5c.up.railway.app",
        ]
        
        if self.ENV == "production":
            logger.info("CORS: Usando orígenes permitidos: %s", origins)
        
        return origins

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
