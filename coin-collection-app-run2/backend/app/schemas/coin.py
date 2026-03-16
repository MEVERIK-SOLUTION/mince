from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


class CoinBase(BaseModel):
    """Základní schéma pro minci"""
    name: str = Field(..., min_length=1, max_length=200, description="Název mince")
    country: str = Field(..., min_length=1, max_length=100, description="Země původu")
    year_minted: Optional[int] = Field(None, ge=1, le=2030, description="Rok ražby")
    year_range: Optional[str] = Field(None, max_length=20, description="Rozsah let (např. 1993-1995)")
    denomination: Optional[Decimal] = Field(None, ge=0, description="Nominální hodnota")
    currency: Optional[str] = Field(None, max_length=10, description="Měna")
    material: Optional[str] = Field(None, max_length=100, description="Materiál")
    weight_grams: Optional[Decimal] = Field(None, ge=0, description="Hmotnost v gramech")
    diameter_mm: Optional[Decimal] = Field(None, ge=0, description="Průměr v mm")
    thickness_mm: Optional[Decimal] = Field(None, ge=0, description="Tloušťka v mm")
    edge_type: Optional[str] = Field(None, max_length=50, description="Typ hrany")
    coin_type: Optional[str] = Field(None, max_length=50, description="Typ mince")
    series: Optional[str] = Field(None, max_length=100, description="Série")
    rarity_level: Optional[int] = Field(None, ge=1, le=10, description="Úroveň vzácnosti (1-10)")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Dodatečná metadata")

    @validator('coin_type')
    def validate_coin_type(cls, v):
        if v is not None:
            allowed_types = ['oběžná', 'pamětní', 'investiční', 'antická', 'circulation', 'commemorative', 'bullion', 'ancient']
            if v not in allowed_types:
                raise ValueError(f'Typ mince musí být jeden z: {", ".join(allowed_types)}')
        return v

    @validator('edge_type')
    def validate_edge_type(cls, v):
        if v is not None:
            allowed_edges = ['hladký', 'rýhovaný', 'nápis', 'smooth', 'reeded', 'lettered']
            if v not in allowed_edges:
                raise ValueError(f'Typ hrany musí být jeden z: {", ".join(allowed_edges)}')
        return v


class CoinCreate(CoinBase):
    """Schéma pro vytvoření nové mince"""
    catalog_id: Optional[str] = Field(None, max_length=50, description="Katalogové ID (automaticky generováno)")


class CoinUpdate(BaseModel):
    """Schéma pro aktualizaci mince"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    country: Optional[str] = Field(None, min_length=1, max_length=100)
    year_minted: Optional[int] = Field(None, ge=1, le=2030)
    year_range: Optional[str] = Field(None, max_length=20)
    denomination: Optional[Decimal] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=10)
    material: Optional[str] = Field(None, max_length=100)
    weight_grams: Optional[Decimal] = Field(None, ge=0)
    diameter_mm: Optional[Decimal] = Field(None, ge=0)
    thickness_mm: Optional[Decimal] = Field(None, ge=0)
    edge_type: Optional[str] = Field(None, max_length=50)
    coin_type: Optional[str] = Field(None, max_length=50)
    series: Optional[str] = Field(None, max_length=100)
    rarity_level: Optional[int] = Field(None, ge=1, le=10)
    metadata: Optional[Dict[str, Any]] = Field(None)


class CoinImageInfo(BaseModel):
    """Informace o obrázku mince"""
    id: int
    type: str
    file_path: str
    is_primary: bool


class CoinResponse(CoinBase):
    """Kompletní odpověď s detailem mince"""
    id: int
    catalog_id: Optional[str]
    images: List[CoinImageInfo] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CoinListResponse(BaseModel):
    """Zjednodušená odpověď pro seznam mincí"""
    id: int
    name: str
    country: str
    year_minted: Optional[int]
    denomination: Optional[Decimal]
    currency: Optional[str]
    coin_type: Optional[str]
    material: Optional[str]
    rarity_level: Optional[int]
    primary_image: Optional[str] = Field(None, description="Cesta k hlavnímu obrázku")
    created_at: datetime

    class Config:
        from_attributes = True


class CoinSearchFilters(BaseModel):
    """Filtry pro vyhledávání mincí"""
    search: Optional[str] = Field(None, description="Fulltextové vyhledávání")
    country: Optional[str] = Field(None, description="Země")
    coin_type: Optional[str] = Field(None, description="Typ mince")
    material: Optional[str] = Field(None, description="Materiál")
    year_from: Optional[int] = Field(None, ge=1, description="Rok od")
    year_to: Optional[int] = Field(None, le=2030, description="Rok do")
    denomination_from: Optional[Decimal] = Field(None, ge=0, description="Nominál od")
    denomination_to: Optional[Decimal] = Field(None, ge=0, description="Nominál do")
    rarity_min: Optional[int] = Field(None, ge=1, le=10, description="Minimální vzácnost")
    rarity_max: Optional[int] = Field(None, ge=1, le=10, description="Maximální vzácnost")


class CoinStatsResponse(BaseModel):
    """Statistiky katalogu mincí"""
    total_coins: int
    by_country: List[Dict[str, Any]]
    by_type: List[Dict[str, Any]]
    by_decade: List[Dict[str, Any]]
    by_material: List[Dict[str, Any]]
    rarity_distribution: List[Dict[str, Any]]