from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
import logging

from ..core.database import get_db
from ..models.coin import Coin, CoinImage
from ..schemas.coin import CoinCreate, CoinUpdate, CoinResponse, CoinListResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[CoinListResponse])
async def get_coins(
    skip: int = Query(0, ge=0, description="Počet záznamů k přeskočení"),
    limit: int = Query(100, ge=1, le=1000, description="Maximální počet záznamů"),
    search: Optional[str] = Query(None, description="Vyhledávací text"),
    country: Optional[str] = Query(None, description="Filtr podle země"),
    coin_type: Optional[str] = Query(None, description="Filtr podle typu mince"),
    year_from: Optional[int] = Query(None, description="Rok od"),
    year_to: Optional[int] = Query(None, description="Rok do"),
    db: Session = Depends(get_db)
):
    """
    Získání seznamu mincí s možností filtrování a vyhledávání
    """
    try:
        query = db.query(Coin)
        
        # Fulltextové vyhledávání
        if search:
            search_filter = or_(
                Coin.name.ilike(f"%{search}%"),
                Coin.country.ilike(f"%{search}%"),
                Coin.material.ilike(f"%{search}%"),
                Coin.series.ilike(f"%{search}%")
            )
            query = query.filter(search_filter)
        
        # Filtry
        if country:
            query = query.filter(Coin.country.ilike(f"%{country}%"))
        
        if coin_type:
            query = query.filter(Coin.coin_type == coin_type)
        
        if year_from:
            query = query.filter(Coin.year_minted >= year_from)
        
        if year_to:
            query = query.filter(Coin.year_minted <= year_to)
        
        # Řazení a stránkování
        coins = query.order_by(Coin.created_at.desc()).offset(skip).limit(limit).all()
        
        # Přidání primary image pro každou minci
        result = []
        for coin in coins:
            primary_image = db.query(CoinImage).filter(
                and_(CoinImage.coin_id == coin.id, CoinImage.is_primary == True)
            ).first()
            
            coin_data = CoinListResponse(
                id=coin.id,
                name=coin.name,
                country=coin.country,
                year_minted=coin.year_minted,
                denomination=coin.denomination,
                currency=coin.currency,
                coin_type=coin.coin_type,
                material=coin.material,
                rarity_level=coin.rarity_level,
                primary_image=primary_image.file_path if primary_image else None,
                created_at=coin.created_at
            )
            result.append(coin_data)
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting coins: {e}")
        raise HTTPException(status_code=500, detail="Chyba při načítání mincí")


@router.get("/{coin_id}", response_model=CoinResponse)
async def get_coin(coin_id: int, db: Session = Depends(get_db)):
    """
    Získání detailu konkrétní mince
    """
    try:
        coin = db.query(Coin).filter(Coin.id == coin_id).first()
        if not coin:
            raise HTTPException(status_code=404, detail="Mince nenalezena")
        
        # Načtení všech obrázků
        images = db.query(CoinImage).filter(CoinImage.coin_id == coin_id).all()
        
        return CoinResponse(
            id=coin.id,
            catalog_id=coin.catalog_id,
            name=coin.name,
            country=coin.country,
            year_minted=coin.year_minted,
            year_range=coin.year_range,
            denomination=coin.denomination,
            currency=coin.currency,
            material=coin.material,
            weight_grams=coin.weight_grams,
            diameter_mm=coin.diameter_mm,
            thickness_mm=coin.thickness_mm,
            edge_type=coin.edge_type,
            coin_type=coin.coin_type,
            series=coin.series,
            rarity_level=coin.rarity_level,
            metadata=coin.metadata,
            images=[{
                "id": img.id,
                "type": img.image_type,
                "file_path": img.file_path,
                "is_primary": img.is_primary
            } for img in images],
            created_at=coin.created_at,
            updated_at=coin.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting coin {coin_id}: {e}")
        raise HTTPException(status_code=500, detail="Chyba při načítání mince")


@router.post("/", response_model=CoinResponse)
async def create_coin(coin_data: CoinCreate, db: Session = Depends(get_db)):
    """
    Vytvoření nové mince
    """
    try:
        # Generování catalog_id pokud není poskytnut
        if not coin_data.catalog_id:
            # Formát: COUNTRY-YEAR-DENOMINATION-SEQUENCE
            country_code = coin_data.country[:2].upper()
            year = coin_data.year_minted or 0
            denom = int(coin_data.denomination or 0)
            
            # Najít nejvyšší sequence pro danou kombinaci
            existing = db.query(Coin).filter(
                Coin.country == coin_data.country,
                Coin.year_minted == coin_data.year_minted,
                Coin.denomination == coin_data.denomination
            ).count()
            
            sequence = existing + 1
            catalog_id = f"{country_code}-{year}-{denom}-{sequence:03d}"
        else:
            catalog_id = coin_data.catalog_id
        
        # Vytvoření nové mince
        db_coin = Coin(
            catalog_id=catalog_id,
            name=coin_data.name,
            country=coin_data.country,
            year_minted=coin_data.year_minted,
            year_range=coin_data.year_range,
            denomination=coin_data.denomination,
            currency=coin_data.currency,
            material=coin_data.material,
            weight_grams=coin_data.weight_grams,
            diameter_mm=coin_data.diameter_mm,
            thickness_mm=coin_data.thickness_mm,
            edge_type=coin_data.edge_type,
            coin_type=coin_data.coin_type,
            series=coin_data.series,
            rarity_level=coin_data.rarity_level,
            metadata=coin_data.metadata
        )
        
        db.add(db_coin)
        db.commit()
        db.refresh(db_coin)
        
        return CoinResponse(
            id=db_coin.id,
            catalog_id=db_coin.catalog_id,
            name=db_coin.name,
            country=db_coin.country,
            year_minted=db_coin.year_minted,
            year_range=db_coin.year_range,
            denomination=db_coin.denomination,
            currency=db_coin.currency,
            material=db_coin.material,
            weight_grams=db_coin.weight_grams,
            diameter_mm=db_coin.diameter_mm,
            thickness_mm=db_coin.thickness_mm,
            edge_type=db_coin.edge_type,
            coin_type=db_coin.coin_type,
            series=db_coin.series,
            rarity_level=db_coin.rarity_level,
            metadata=db_coin.metadata,
            images=[],
            created_at=db_coin.created_at,
            updated_at=db_coin.updated_at
        )
        
    except Exception as e:
        logger.error(f"Error creating coin: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Chyba při vytváření mince")


@router.put("/{coin_id}", response_model=CoinResponse)
async def update_coin(
    coin_id: int, 
    coin_data: CoinUpdate, 
    db: Session = Depends(get_db)
):
    """
    Aktualizace existující mince
    """
    try:
        db_coin = db.query(Coin).filter(Coin.id == coin_id).first()
        if not db_coin:
            raise HTTPException(status_code=404, detail="Mince nenalezena")
        
        # Aktualizace pouze poskytnutých polí
        update_data = coin_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_coin, field, value)
        
        db.commit()
        db.refresh(db_coin)
        
        # Načtení obrázků
        images = db.query(CoinImage).filter(CoinImage.coin_id == coin_id).all()
        
        return CoinResponse(
            id=db_coin.id,
            catalog_id=db_coin.catalog_id,
            name=db_coin.name,
            country=db_coin.country,
            year_minted=db_coin.year_minted,
            year_range=db_coin.year_range,
            denomination=db_coin.denomination,
            currency=db_coin.currency,
            material=db_coin.material,
            weight_grams=db_coin.weight_grams,
            diameter_mm=db_coin.diameter_mm,
            thickness_mm=db_coin.thickness_mm,
            edge_type=db_coin.edge_type,
            coin_type=db_coin.coin_type,
            series=db_coin.series,
            rarity_level=db_coin.rarity_level,
            metadata=db_coin.metadata,
            images=[{
                "id": img.id,
                "type": img.image_type,
                "file_path": img.file_path,
                "is_primary": img.is_primary
            } for img in images],
            created_at=db_coin.created_at,
            updated_at=db_coin.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating coin {coin_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Chyba při aktualizaci mince")


@router.delete("/{coin_id}")
async def delete_coin(coin_id: int, db: Session = Depends(get_db)):
    """
    Smazání mince (včetně všech souvisejících obrázků)
    """
    try:
        db_coin = db.query(Coin).filter(Coin.id == coin_id).first()
        if not db_coin:
            raise HTTPException(status_code=404, detail="Mince nenalezena")
        
        # Smazání fyzických souborů obrázků
        images = db.query(CoinImage).filter(CoinImage.coin_id == coin_id).all()
        for image in images:
            try:
                import os
                if os.path.exists(image.file_path):
                    os.remove(image.file_path)
            except Exception as e:
                logger.warning(f"Failed to delete image file {image.file_path}: {e}")
        
        # Smazání z databáze (cascade smaže i obrázky)
        db.delete(db_coin)
        db.commit()
        
        return {"message": "Mince byla úspěšně smazána"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting coin {coin_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Chyba při mazání mince")


@router.get("/stats/summary")
async def get_collection_stats(db: Session = Depends(get_db)):
    """
    Získání základních statistik kolekce
    """
    try:
        total_coins = db.query(Coin).count()
        
        # Statistiky podle zemí
        countries = db.query(Coin.country, db.func.count(Coin.id)).group_by(Coin.country).all()
        
        # Statistiky podle typů
        types = db.query(Coin.coin_type, db.func.count(Coin.id)).group_by(Coin.coin_type).all()
        
        # Statistiky podle dekád
        decades = db.query(
            db.func.floor(Coin.year_minted / 10) * 10,
            db.func.count(Coin.id)
        ).filter(Coin.year_minted.isnot(None)).group_by(
            db.func.floor(Coin.year_minted / 10) * 10
        ).all()
        
        return {
            "total_coins": total_coins,
            "by_country": [{"country": country, "count": count} for country, count in countries],
            "by_type": [{"type": coin_type, "count": count} for coin_type, count in types],
            "by_decade": [{"decade": int(decade), "count": count} for decade, count in decades]
        }
        
    except Exception as e:
        logger.error(f"Error getting collection stats: {e}")
        raise HTTPException(status_code=500, detail="Chyba při načítání statistik")