from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import os
import logging
from contextlib import asynccontextmanager

from .core.config import settings
from .core.database import create_tables, engine
from .api import coins, images, collections
from .models import coin  # Import models to register them

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting Coin Collection API...")
    
    # Create database tables
    try:
        create_tables()
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise
    
    # Ensure upload directories exist
    os.makedirs(f"{settings.upload_dir}/coins", exist_ok=True)
    logger.info(f"Upload directory ensured: {settings.upload_dir}/coins")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Coin Collection API...")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="API pro správu kolekcí mincí s podporou AI identifikace a cenových analýz",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# Include API routers
app.include_router(coins.router, prefix="/api/coins", tags=["coins"])
app.include_router(images.router, prefix="/api/images", tags=["images"])
app.include_router(collections.router, prefix="/api/collections", tags=["collections"])


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Coin Collection API",
        "version": settings.version,
        "docs": "/docs",
        "status": "running"
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        from sqlalchemy import text
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        
        return {
            "status": "healthy",
            "database": "connected",
            "version": settings.version
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Global exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug
    )