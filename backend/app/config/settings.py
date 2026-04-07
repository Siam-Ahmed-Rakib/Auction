from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/auction_db"
    DIRECT_URL: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/auction_db"
    SUPABASE_JWT_SECRET: str = "02c6be6a-0075-43b9-9117-a9581990be22"
    SUPABASE_URL: str = "https://lmthclkskkechzyfenuf.supabase.co"
    PORT: int = 5000
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
