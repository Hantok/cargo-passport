from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    # Neon's pooler (PgBouncer) is fine for the app; migrations should use a direct connection.
    database_url_direct: str | None = None

    # SI "Explain": Claude through the Anthropic Messages API. Default is the local subscription shim
    # (127.0.0.1:4142). The key is SI_API_KEY, or the first line of the file SI_API_KEY_FILE
    # (the shim's bearer file), so the secret never has to sit in an env file.
    si_base_url: str | None = "http://127.0.0.1:4142"
    si_api_key: str | None = None
    si_api_key_file: str | None = None
    si_model: str | None = "claude-sonnet-5-5"

    @property
    def si_secret(self) -> str | None:
        if self.si_api_key:
            return self.si_api_key
        if self.si_api_key_file:
            try:
                return Path(self.si_api_key_file).read_text().strip() or None
            except OSError:
                return None
        return None

    cors_origins: str = "http://localhost:8000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def migration_url(self) -> str:
        return self.database_url_direct or self.database_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
