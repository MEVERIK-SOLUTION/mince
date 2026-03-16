from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ImageBase(BaseModel):
    """Základní schéma pro obrázek"""
    image_type: str = Field(..., description="Typ obrázku: obverse, reverse, edge, detail")
    is_primary: bool = Field(False, description="Je hlavní obrázek")


class ImageResponse(BaseModel):
    """Odpověď s informacemi o obrázku"""
    id: int
    coin_id: int
    image_type: str
    file_path: str
    file_size: Optional[int] = Field(None, description="Velikost souboru v bytech")
    width: Optional[int] = Field(None, description="Šířka obrázku v pixelech")
    height: Optional[int] = Field(None, description="Výška obrázku v pixelech")
    is_primary: bool
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ImageUploadResponse(ImageResponse):
    """Odpověď po nahrání obrázku"""
    message: str = Field(..., description="Zpráva o výsledku nahrání")


class ImageUploadRequest(BaseModel):
    """Request pro nahrání obrázku"""
    image_type: str = Field(..., description="Typ obrázku: obverse, reverse, edge, detail")
    is_primary: bool = Field(False, description="Nastavit jako hlavní obrázek")

    class Config:
        schema_extra = {
            "example": {
                "image_type": "obverse",
                "is_primary": True
            }
        }


class BulkUploadResponse(BaseModel):
    """Odpověď po hromadném nahrání obrázků"""
    message: str
    uploaded: list = Field(..., description="Seznam úspěšně nahraných obrázků")
    errors: list = Field(..., description="Seznam chyb při nahrávání")

    class Config:
        schema_extra = {
            "example": {
                "message": "Nahráno 3 obrázků",
                "uploaded": [
                    {"filename": "coin_front.jpg", "type": "obverse", "size": 245760},
                    {"filename": "coin_back.jpg", "type": "reverse", "size": 198432},
                    {"filename": "coin_edge.jpg", "type": "edge", "size": 156789}
                ],
                "errors": [
                    "coin_detail.gif: Nepodporovaný typ souboru"
                ]
            }
        }