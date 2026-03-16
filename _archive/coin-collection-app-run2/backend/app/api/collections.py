from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Optional
from datetime import date, datetime
import logging

from ..core.database import get_db
from ..models.coin import Coin, UserCollection, CoinImage
from ..schemas.collection import (
    CollectionItemCreate, 
    CollectionItemUpdate, 
    CollectionItemResponse,
    CollectionStatsResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[CollectionItemResponse])
async def get_collection_items(
    skip: int = Query(0, ge=0, description="Počet záznamů k přeskočení"),
    limit: int = Query(100, ge=1, le=1000, description="Maximální počet záznamů"),
    condition: Optional[str] = Query(None, description="Filtr podle stavu"),
    min_value: Optional[float] = Query(None, description="Minimální hodnota"),
    max_value: Optional[float] = Query(None, description="Maximální hodnota"),
    db: Session = Depends(get_db)
):
    """
    Získání položek z uživatelské kolekce
    """
    try:
        query = db.query(UserCollection).join(Coin)
        
        # Filtry
        if condition:
            query = query.filter(UserCollection.condition_grade == condition)
        
        if min_value is not None:
            query = query.filter(UserCollection.current_estimated_value >= min_value)
        
        if max_value is not None:
            query = query.filter(UserCollection.current_estimated_value <= max_value)
        
        # Řazení a stránkování
        items = query.order_by(UserCollection.created_at.desc()).offset(skip).limit(limit).all()
        
        result = []
        for item in items:
            # Načtení hlavního obrázku
            primary_image = db.query(CoinImage).filter(
                and_(CoinImage.coin_id == item.coin_id, CoinImage.is_primary == True)
            ).first()
            
            result.append(CollectionItemResponse(
                id=item.id,
                coin_id=item.coin_id,
                coin_name=item.coin.name,
                coin_country=item.coin.country,
                coin_year=item.coin.year_minted,
                coin_denomination=item.coin.denomination,
                coin_currency=item.coin.currency,
                condition_grade=item.condition_grade,
                condition_notes=item.condition_notes,
                acquisition_date=item.acquisition_date,
                acquisition_price=item.acquisition_price,
                acquisition_source=item.acquisition_source,
                current_estimated_value=item.current_estimated_value,
                last_valuation_date=item.last_valuation_date,
                valuation_source=item.valuation_source,
                storage_location=item.storage_location,
                insurance_value=item.insurance_value,
                notes=item.notes,
                primary_image=primary_image.file_path if primary_image else None,
                created_at=item.created_at
            ))
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting collection items: {e}")
        raise HTTPException(status_code=500, detail="Chyba při načítání kolekce")


@router.get("/{item_id}", response_model=CollectionItemResponse)
async def get_collection_item(item_id: int, db: Session = Depends(get_db)):
    """
    Získání detailu položky z kolekce
    """
    try:
        item = db.query(UserCollection).filter(UserCollection.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Položka kolekce nenalezena")
        
        # Načtení hlavního obrázku
        primary_image = db.query(CoinImage).filter(
            and_(CoinImage.coin_id == item.coin_id, CoinImage.is_primary == True)
        ).first()
        
        return CollectionItemResponse(
            id=item.id,
            coin_id=item.coin_id,
            coin_name=item.coin.name,
            coin_country=item.coin.country,
            coin_year=item.coin.year_minted,
            coin_denomination=item.coin.denomination,
            coin_currency=item.coin.currency,
            condition_grade=item.condition_grade,
            condition_notes=item.condition_notes,
            acquisition_date=item.acquisition_date,
            acquisition_price=item.acquisition_price,
            acquisition_source=item.acquisition_source,
            current_estimated_value=item.current_estimated_value,
            last_valuation_date=item.last_valuation_date,
            valuation_source=item.valuation_source,
            storage_location=item.storage_location,
            insurance_value=item.insurance_value,
            notes=item.notes,
            primary_image=primary_image.file_path if primary_image else None,
            created_at=item.created_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting collection item {item_id}: {e}")
        raise HTTPException(status_code=500, detail="Chyba při načítání položky kolekce")


@router.post("/", response_model=CollectionItemResponse)
async def add_to_collection(
    item_data: CollectionItemCreate, 
    db: Session = Depends(get_db)
):
    """
    Přidání mince do kolekce
    """
    try:
        # Kontrola existence mince
        coin = db.query(Coin).filter(Coin.id == item_data.coin_id).first()
        if not coin:
            raise HTTPException(status_code=404, detail="Mince nenalezena")
        
        # Kontrola, zda mince již není v kolekci
        existing = db.query(UserCollection).filter(
            UserCollection.coin_id == item_data.coin_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=400, 
                detail="Mince je již v kolekci. Použijte aktualizaci pro změnu údajů."
            )
        
        # Vytvoření nové položky kolekce
        db_item = UserCollection(
            coin_id=item_data.coin_id,
            condition_grade=item_data.condition_grade,
            condition_notes=item_data.condition_notes,
            acquisition_date=item_data.acquisition_date,
            acquisition_price=item_data.acquisition_price,
            acquisition_source=item_data.acquisition_source,
            current_estimated_value=item_data.current_estimated_value,
            last_valuation_date=item_data.last_valuation_date,
            valuation_source=item_data.valuation_source,
            storage_location=item_data.storage_location,
            insurance_value=item_data.insurance_value,
            notes=item_data.notes
        )
        
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        
        # Načtení hlavního obrázku
        primary_image = db.query(CoinImage).filter(
            and_(CoinImage.coin_id == db_item.coin_id, CoinImage.is_primary == True)
        ).first()
        
        return CollectionItemResponse(
            id=db_item.id,
            coin_id=db_item.coin_id,
            coin_name=coin.name,
            coin_country=coin.country,
            coin_year=coin.year_minted,
            coin_denomination=coin.denomination,
            coin_currency=coin.currency,
            condition_grade=db_item.condition_grade,
            condition_notes=db_item.condition_notes,
            acquisition_date=db_item.acquisition_date,
            acquisition_price=db_item.acquisition_price,
            acquisition_source=db_item.acquisition_source,
            current_estimated_value=db_item.current_estimated_value,
            last_valuation_date=db_item.last_valuation_date,
            valuation_source=db_item.valuation_source,
            storage_location=db_item.storage_location,
            insurance_value=db_item.insurance_value,
            notes=db_item.notes,
            primary_image=primary_image.file_path if primary_image else None,
            created_at=db_item.created_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding to collection: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Chyba při přidávání do kolekce")


@router.put("/{item_id}", response_model=CollectionItemResponse)
async def update_collection_item(
    item_id: int,
    item_data: CollectionItemUpdate,
    db: Session = Depends(get_db)
):
    """
    Aktualizace položky v kolekci
    """
    try:
        db_item = db.query(UserCollection).filter(UserCollection.id == item_id).first()
        if not db_item:
            raise HTTPException(status_code=404, detail="Položka kolekce nenalezena")
        
        # Aktualizace pouze poskytnutých polí
        update_data = item_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_item, field, value)
        
        db.commit()
        db.refresh(db_item)
        
        # Načtení hlavního obrázku
        primary_image = db.query(CoinImage).filter(
            and_(CoinImage.coin_id == db_item.coin_id, CoinImage.is_primary == True)
        ).first()
        
        return CollectionItemResponse(
            id=db_item.id,
            coin_id=db_item.coin_id,
            coin_name=db_item.coin.name,
            coin_country=db_item.coin.country,
            coin_year=db_item.coin.year_minted,
            coin_denomination=db_item.coin.denomination,
            coin_currency=db_item.coin.currency,
            condition_grade=db_item.condition_grade,
            condition_notes=db_item.condition_notes,
            acquisition_date=db_item.acquisition_date,
            acquisition_price=db_item.acquisition_price,
            acquisition_source=db_item.acquisition_source,
            current_estimated_value=db_item.current_estimated_value,
            last_valuation_date=db_item.last_valuation_date,
            valuation_source=db_item.valuation_source,
            storage_location=db_item.storage_location,
            insurance_value=db_item.insurance_value,
            notes=db_item.notes,
            primary_image=primary_image.file_path if primary_image else None,
            created_at=db_item.created_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating collection item {item_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Chyba při aktualizaci položky kolekce")


@router.delete("/{item_id}")
async def remove_from_collection(item_id: int, db: Session = Depends(get_db)):
    """
    Odebrání mince z kolekce (nemazáno z katalogu)
    """
    try:
        db_item = db.query(UserCollection).filter(UserCollection.id == item_id).first()
        if not db_item:
            raise HTTPException(status_code=404, detail="Položka kolekce nenalezena")
        
        db.delete(db_item)
        db.commit()
        
        return {"message": "Mince byla odebrána z kolekce"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing from collection {item_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Chyba při odebírání z kolekce")


@router.get("/stats/overview", response_model=CollectionStatsResponse)
async def get_collection_stats(db: Session = Depends(get_db)):
    """
    Získání statistik kolekce
    """
    try:
        # Základní statistiky
        total_items = db.query(UserCollection).count()
        
        # Celková hodnota
        total_acquisition_value = db.query(
            func.sum(UserCollection.acquisition_price)
        ).scalar() or 0
        
        total_current_value = db.query(
            func.sum(UserCollection.current_estimated_value)
        ).scalar() or 0
        
        total_insurance_value = db.query(
            func.sum(UserCollection.insurance_value)
        ).scalar() or 0
        
        # ROI kalkulace
        roi_percentage = 0
        if total_acquisition_value > 0:
            roi_percentage = ((total_current_value - total_acquisition_value) / total_acquisition_value) * 100
        
        # Statistiky podle stavu
        condition_stats = db.query(
            UserCollection.condition_grade,
            func.count(UserCollection.id),
            func.sum(UserCollection.current_estimated_value)
        ).group_by(UserCollection.condition_grade).all()
        
        # Statistiky podle zemí
        country_stats = db.query(
            Coin.country,
            func.count(UserCollection.id),
            func.sum(UserCollection.current_estimated_value)
        ).join(UserCollection).group_by(Coin.country).all()
        
        # Nejhodnotnější mince
        most_valuable = db.query(UserCollection).join(Coin).order_by(
            UserCollection.current_estimated_value.desc()
        ).limit(5).all()
        
        # Nejnovější přírůstky
        recent_additions = db.query(UserCollection).join(Coin).order_by(
            UserCollection.created_at.desc()
        ).limit(5).all()
        
        return CollectionStatsResponse(
            total_items=total_items,
            total_acquisition_value=float(total_acquisition_value),
            total_current_value=float(total_current_value),
            total_insurance_value=float(total_insurance_value),
            roi_percentage=round(roi_percentage, 2),
            by_condition=[{
                "condition": condition or "Nespecifikováno",
                "count": count,
                "total_value": float(value or 0)
            } for condition, count, value in condition_stats],
            by_country=[{
                "country": country,
                "count": count,
                "total_value": float(value or 0)
            } for country, count, value in country_stats],
            most_valuable=[{
                "id": item.id,
                "coin_name": item.coin.name,
                "value": float(item.current_estimated_value or 0)
            } for item in most_valuable if item.current_estimated_value],
            recent_additions=[{
                "id": item.id,
                "coin_name": item.coin.name,
                "added_date": item.created_at.date()
            } for item in recent_additions]
        )
        
    except Exception as e:
        logger.error(f"Error getting collection stats: {e}")
        raise HTTPException(status_code=500, detail="Chyba při načítání statistik kolekce")


@router.get("/export/csv")
async def export_collection_csv(db: Session = Depends(get_db)):
    """
    Export kolekce do CSV formátu
    """
    try:
        from fastapi.responses import StreamingResponse
        import csv
        import io
        
        # Načtení všech položek kolekce
        items = db.query(UserCollection).join(Coin).all()
        
        # Vytvoření CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Hlavička
        writer.writerow([
            'ID', 'Název mince', 'Země', 'Rok', 'Nominál', 'Měna',
            'Stav', 'Datum pořízení', 'Pořizovací cena', 'Zdroj',
            'Aktuální hodnota', 'Pojistná hodnota', 'Umístění', 'Poznámky'
        ])
        
        # Data
        for item in items:
            writer.writerow([
                item.id,
                item.coin.name,
                item.coin.country,
                item.coin.year_minted,
                item.coin.denomination,
                item.coin.currency,
                item.condition_grade,
                item.acquisition_date,
                item.acquisition_price,
                item.acquisition_source,
                item.current_estimated_value,
                item.insurance_value,
                item.storage_location,
                item.notes
            ])
        
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type='text/csv',
            headers={"Content-Disposition": "attachment; filename=kolekce_minci.csv"}
        )
        
    except Exception as e:
        logger.error(f"Error exporting collection: {e}")
        raise HTTPException(status_code=500, detail="Chyba při exportu kolekce")