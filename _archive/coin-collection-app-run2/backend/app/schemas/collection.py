from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal


class CollectionItemBase(BaseModel):
    """Základní schéma pro položku kolekce"""
    coin_id: int = Field(..., description="ID mince z katalogu")
    condition_grade: Optional[str] = Field(None, max_length=20, description="Stav mince")
    condition_notes: Optional[str] = Field(None, description="Poznámky ke stavu")
    acquisition_date: Optional[date] = Field(None, description="Datum pořízení")
    acquisition_price: Optional[Decimal] = Field(None, ge=0, description="Pořizovací cena")
    acquisition_source: Optional[str] = Field(None, max_length=100, description="Zdroj pořízení")
    current_estimated_value: Optional[Decimal] = Field(None, ge=0, description="Aktuální odhadovaná hodnota")
    last_valuation_date: Optional[date] = Field(None, description="Datum posledního ocenění")
    valuation_source: Optional[str] = Field(None, max_length=100, description="Zdroj ocenění")
    storage_location: Optional[str] = Field(None, max_length=100, description="Místo uložení")
    insurance_value: Optional[Decimal] = Field(None, ge=0, description="Pojistná hodnota")
    notes: Optional[str] = Field(None, description="Poznámky")

    @validator('condition_grade')
    def validate_condition_grade(cls, v):
        if v is not None:
            allowed_grades = ['UNC', 'AU', 'XF', 'VF', 'F', 'VG', 'G', 'AG', 'FA', 'PR']
            if v not in allowed_grades:
                raise ValueError(f'Stav mince musí být jeden z: {", ".join(allowed_grades)}')
        return v

    @validator('acquisition_source')
    def validate_acquisition_source(cls, v):
        if v is not None:
            allowed_sources = ['aukce', 'obchod', 'dědictví', 'dárek', 'výměna', 'nález', 'jiné']
            if v not in allowed_sources:
                # Povolíme i jiné hodnoty, ale upozorníme
                pass
        return v


class CollectionItemCreate(CollectionItemBase):
    """Schéma pro přidání mince do kolekce"""
    pass


class CollectionItemUpdate(BaseModel):
    """Schéma pro aktualizaci položky kolekce"""
    condition_grade: Optional[str] = Field(None, max_length=20)
    condition_notes: Optional[str] = Field(None)
    acquisition_date: Optional[date] = Field(None)
    acquisition_price: Optional[Decimal] = Field(None, ge=0)
    acquisition_source: Optional[str] = Field(None, max_length=100)
    current_estimated_value: Optional[Decimal] = Field(None, ge=0)
    last_valuation_date: Optional[date] = Field(None)
    valuation_source: Optional[str] = Field(None, max_length=100)
    storage_location: Optional[str] = Field(None, max_length=100)
    insurance_value: Optional[Decimal] = Field(None, ge=0)
    notes: Optional[str] = Field(None)


class CollectionItemResponse(CollectionItemBase):
    """Kompletní odpověď s položkou kolekce"""
    id: int
    coin_name: str = Field(..., description="Název mince")
    coin_country: str = Field(..., description="Země mince")
    coin_year: Optional[int] = Field(None, description="Rok mince")
    coin_denomination: Optional[Decimal] = Field(None, description="Nominál mince")
    coin_currency: Optional[str] = Field(None, description="Měna mince")
    primary_image: Optional[str] = Field(None, description="Cesta k hlavnímu obrázku")
    created_at: datetime

    class Config:
        from_attributes = True


class CollectionStatsResponse(BaseModel):
    """Statistiky kolekce"""
    total_items: int = Field(..., description="Celkový počet položek")
    total_acquisition_value: float = Field(..., description="Celková pořizovací hodnota")
    total_current_value: float = Field(..., description="Celková aktuální hodnota")
    total_insurance_value: float = Field(..., description="Celková pojistná hodnota")
    roi_percentage: float = Field(..., description="ROI v procentech")
    
    by_condition: List[Dict[str, Any]] = Field(..., description="Statistiky podle stavu")
    by_country: List[Dict[str, Any]] = Field(..., description="Statistiky podle zemí")
    most_valuable: List[Dict[str, Any]] = Field(..., description="Nejhodnotnější mince")
    recent_additions: List[Dict[str, Any]] = Field(..., description="Nejnovější přírůstky")

    class Config:
        schema_extra = {
            "example": {
                "total_items": 150,
                "total_acquisition_value": 25000.0,
                "total_current_value": 32000.0,
                "total_insurance_value": 35000.0,
                "roi_percentage": 28.0,
                "by_condition": [
                    {"condition": "UNC", "count": 45, "total_value": 15000.0},
                    {"condition": "XF", "count": 60, "total_value": 12000.0},
                    {"condition": "VF", "count": 35, "total_value": 4500.0}
                ],
                "by_country": [
                    {"country": "Česká republika", "count": 80, "total_value": 18000.0},
                    {"country": "Slovensko", "count": 25, "total_value": 6000.0},
                    {"country": "Rakousko", "count": 20, "total_value": 4500.0}
                ],
                "most_valuable": [
                    {"id": 1, "coin_name": "Svatováclavský dukát 1929", "value": 2500.0},
                    {"id": 2, "coin_name": "10 dukát 1938", "value": 1800.0}
                ],
                "recent_additions": [
                    {"id": 3, "coin_name": "20 Kč 1993", "added_date": "2024-01-15"},
                    {"id": 4, "coin_name": "50 Kč 1994", "added_date": "2024-01-10"}
                ]
            }
        }


class CollectionFilters(BaseModel):
    """Filtry pro kolekci"""
    condition: Optional[str] = Field(None, description="Filtr podle stavu")
    min_value: Optional[float] = Field(None, ge=0, description="Minimální hodnota")
    max_value: Optional[float] = Field(None, ge=0, description="Maximální hodnota")
    acquisition_year: Optional[int] = Field(None, description="Rok pořízení")
    storage_location: Optional[str] = Field(None, description="Místo uložení")
    country: Optional[str] = Field(None, description="Země mince")


class CollectionExportRequest(BaseModel):
    """Request pro export kolekce"""
    format: str = Field("csv", description="Formát exportu: csv, excel, json")
    include_images: bool = Field(False, description="Zahrnout odkazy na obrázky")
    filters: Optional[CollectionFilters] = Field(None, description="Filtry pro export")

    @validator('format')
    def validate_format(cls, v):
        allowed_formats = ['csv', 'excel', 'json']
        if v not in allowed_formats:
            raise ValueError(f'Formát musí být jeden z: {", ".join(allowed_formats)}')
        return v


class ValueUpdateRequest(BaseModel):
    """Request pro aktualizaci hodnoty"""
    new_value: Decimal = Field(..., ge=0, description="Nová hodnota")
    valuation_source: str = Field(..., description="Zdroj ocenění")
    valuation_date: Optional[date] = Field(None, description="Datum ocenění")
    notes: Optional[str] = Field(None, description="Poznámky k ocenění")