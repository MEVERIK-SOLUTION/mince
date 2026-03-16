"""
Pydantic schemas for request/response validation.

This package contains all the data validation schemas used by the API endpoints.
"""

from .coin import CoinCreate, CoinUpdate, CoinResponse, CoinListResponse
from .image import ImageResponse, ImageUploadResponse
from .collection import CollectionItemCreate, CollectionItemUpdate, CollectionItemResponse, CollectionStatsResponse

__all__ = [
    "CoinCreate",
    "CoinUpdate", 
    "CoinResponse",
    "CoinListResponse",
    "ImageResponse",
    "ImageUploadResponse",
    "CollectionItemCreate",
    "CollectionItemUpdate",
    "CollectionItemResponse",
    "CollectionStatsResponse"
]