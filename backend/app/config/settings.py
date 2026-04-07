from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/auction_db"
    DIRECT_URL: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/auction_db"
    JWT_SECRET: str = "your-super-secret-jwt-key-change-in-production"
    JWT_EXPIRES_IN: str = "7d"
    JWT_ALGORITHM: str = "HS256"
    PORT: int = 5000
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
