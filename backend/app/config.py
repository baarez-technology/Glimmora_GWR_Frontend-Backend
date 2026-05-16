from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    DATABASE_URL: str = "sqlite+aiosqlite:///./gwr_dev.db"
    REDIS_URL: str = "redis://localhost:6379/0"

    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"
    S3_BUCKET: str = "gwr-evidence"

    SENDGRID_API_KEY: str = ""
    BREVO_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@glimmora.com"

    # Generic SMTP (preferred — works with any free provider: Gmail, Brevo,
    # Outlook, Zoho, Mailtrap, etc.). When SMTP_HOST is set, SMTP is used in
    # preference to SendGrid. Leave SMTP_HOST blank to fall back to SendGrid /
    # dev-log mode.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True          # STARTTLS on port 587
    SMTP_USE_SSL: bool = False         # Implicit TLS (e.g. port 465)
    SMTP_FROM_NAME: str = "GWR Records"

    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    SENTRY_DSN: str = ""

    MAGIC_LINK_EXPIRE_HOURS: int = 72
    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.DATABASE_URL

    @property
    def celery_broker_url(self) -> str:
        return self.REDIS_URL

    @property
    def celery_result_backend(self) -> str:
        return self.REDIS_URL


settings = Settings()
