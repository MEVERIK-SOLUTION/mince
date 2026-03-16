from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # Application
    app_name: str = "Coin Collection API"
    version: str = "1.0.0"
    debug: bool = True
    environment: str = "development"
    
    # Database
    database_url: str = "postgresql://coin_user:secure_password@localhost:5432/coin_collection"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # File uploads
    upload_dir: str = "uploads"
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    allowed_image_types: list = ["image/jpeg", "image/png", "image/webp"]
    
    # External APIs
    numista_api_key: Optional[str] = None
    coinscan_api_key: Optional[str] = None
    
    # Security
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # CORS
    allowed_origins: list = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080"
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Create settings instance
settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs(f"{settings.upload_dir}/coins", exist_ok=True)