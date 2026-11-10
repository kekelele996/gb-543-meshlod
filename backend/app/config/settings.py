"""集中式配置：所有环境变量在此读取一次。"""
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "MeshLOD"
    ENV: str = "production"

    DB_HOST: str = "db"
    DB_PORT: int = 5432
    DB_NAME: str = "meshlod_db"
    DB_USER: str = "meshlod_user"
    DB_PASSWORD: str = "meshlod_pwd"
    DB_ADMIN_PASSWORD: str = "meshlod_admin_pwd"

    JWT_SECRET: str = "change_me_to_a_long_random_string"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_HOURS: int = 12
    REFRESH_TOKEN_DAYS: int = 7

    REDIS_URL: str = "redis://redis:6379/0"
    ARTIFACT_DIR: str = "/data/artifacts"
    MAX_UPLOAD_MB: int = 80
    SEED_DEMO: bool = True

    SSE_VIEWPORT_HEIGHT: int = 1080
    SSE_FOV_Y_DEG: float = 60.0
    SSE_INCLUDE_FLAG: bool = True

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
