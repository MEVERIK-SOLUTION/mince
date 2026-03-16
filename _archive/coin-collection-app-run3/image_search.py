from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import tempfile
import os

from ...database import get_db
from ...services.image_search_service import image_search_service
from ...core.auth import get_current_user
from ...models.user import User

router = APIRouter()

@router.post("/search-by-image")
async def search_coins_by_image(
    image: UploadFile = File(...),
    limit: int = Query(10, ge=1, le=50),
    similarity_threshold: float = Query(0.7, ge=0.1, le=1.0),
    include_metadata: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Vyhledání podobných mincí podle nahraného obrázku
    """
    if not image.content_type or not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Neplatný typ souboru - vyžadován obrázek")
    
    temp_file = None
    try:
        # Uložení dočasného souboru
        suffix = os.path.splitext(image.filename)[1] if image.filename else '.jpg'
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        
        content = await image.read()
        temp_file.write(content)
        temp_file.close()
        
        # Nastavení prahu podobnosti
        original_threshold = image_search_service.similarity_threshold
        image_search_service.similarity_threshold = similarity_threshold
        
        try:
            # Vyhledávání
            result = await image_search_service.search_similar_coins(
                query_image_path=temp_file.name,
                db=db,
                limit=limit,
                include_metadata=include_metadata
            )
            
            if not result.get('success'):
                raise HTTPException(
                    status_code=500, 
                    detail=f"Vyhledávání selhalo: {result.get('error', 'Neznámá chyba')}"
                )
            
            return {
                "success": True,
                "query_image": image.filename,
                "results": result['results'],
                "total_found": result['total_found'],
                "similarity_threshold": similarity_threshold,
                "search_parameters": {
                    "limit": limit,
                    "include_metadata": include_metadata
                }
            }
            
        finally:
            # Obnovení původního prahu
            image_search_service.similarity_threshold = original_threshold
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při zpracování: {str(e)}")
    
    finally:
        # Vyčištění dočasného souboru
        if temp_file:
            try:
                os.unlink(temp_file.name)
            except OSError:
                pass

@router.post("/batch-search-by-images")
async def batch_search_coins_by_images(
    images: List[UploadFile] = File(...),
    limit: int = Query(10, ge=1, le=50),
    similarity_threshold: float = Query(0.7, ge=0.1, le=1.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dávkové vyhledávání podobných mincí pro více obrázků
    """
    if len(images) > 10:
        raise HTTPException(status_code=400, detail="Maximálně 10 obrázků najednou")
    
    temp_files = []
    try:
        # Uložení dočasných souborů
        image_paths = []
        for image in images:
            if not image.content_type or not image.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail=f"Neplatný typ souboru: {image.filename}")
            
            suffix = os.path.splitext(image.filename)[1] if image.filename else '.jpg'
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            temp_files.append(temp_file.name)
            
            content = await image.read()
            temp_file.write(content)
            temp_file.close()
            
            image_paths.append(temp_file.name)
        
        # Nastavení prahu podobnosti
        original_threshold = image_search_service.similarity_threshold
        image_search_service.similarity_threshold = similarity_threshold
        
        try:
            # Dávkové vyhledávání
            result = await image_search_service.batch_search_similar_coins(
                query_images=image_paths,
                db=db,
                limit=limit
            )
            
            if not result.get('success'):
                raise HTTPException(
                    status_code=500, 
                    detail=f"Dávkové vyhledávání selhalo: {result.get('error', 'Neznámá chyba')}"
                )
            
            # Příprava výsledků s názvy souborů
            batch_results = []
            for i, batch_result in enumerate(result['batch_results']):
                batch_results.append({
                    'query_image': images[i].filename,
                    'query_index': i,
                    'search_result': batch_result['search_result']
                })
            
            return {
                "success": True,
                "batch_results": batch_results,
                "total_queries": len(images),
                "similarity_threshold": similarity_threshold,
                "search_parameters": {
                    "limit": limit
                }
            }
            
        finally:
            # Obnovení původního prahu
            image_search_service.similarity_threshold = original_threshold
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při dávkovém zpracování: {str(e)}")
    
    finally:
        # Vyčištění dočasných souborů
        for temp_file in temp_files:
            try:
                os.unlink(temp_file)
            except OSError:
                pass

@router.get("/similar-coins/{coin_id}")
async def get_similar_coins_by_id(
    coin_id: int,
    limit: int = Query(10, ge=1, le=50),
    similarity_threshold: float = Query(0.7, ge=0.1, le=1.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Vyhledání podobných mincí na základě existující mince v databázi
    """
    try:
        # Kontrola existence mince
        from ...models.coin import Coin, CoinImage
        
        coin = db.query(Coin).filter(Coin.id == coin_id).first()
        if not coin:
            raise HTTPException(status_code=404, detail="Mince nenalezena")
        
        # Získání hlavního obrázku mince
        main_image = db.query(CoinImage).filter(
            CoinImage.coin_id == coin_id,
            CoinImage.is_main == True
        ).first()
        
        if not main_image:
            # Pokud není hlavní obrázek, vezmi první dostupný
            main_image = db.query(CoinImage).filter(
                CoinImage.coin_id == coin_id
            ).first()
        
        if not main_image:
            raise HTTPException(status_code=404, detail="Mince nemá žádné obrázky")
        
        # Cesta k obrázku
        image_path = os.path.join("uploads", main_image.image_path)
        
        if not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail="Soubor obrázku nenalezen")
        
        # Nastavení prahu podobnosti
        original_threshold = image_search_service.similarity_threshold
        image_search_service.similarity_threshold = similarity_threshold
        
        try:
            # Vyhledávání
            result = await image_search_service.search_similar_coins(
                query_image_path=image_path,
                db=db,
                limit=limit + 1,  # +1 protože výsledky budou obsahovat i původní minci
                include_metadata=True
            )
            
            if not result.get('success'):
                raise HTTPException(
                    status_code=500, 
                    detail=f"Vyhledávání selhalo: {result.get('error', 'Neznámá chyba')}"
                )
            
            # Odstranění původní mince z výsledků
            filtered_results = [
                r for r in result['results'] 
                if r['coin_id'] != coin_id
            ][:limit]
            
            return {
                "success": True,
                "source_coin": {
                    "id": coin.id,
                    "name": coin.name,
                    "country": coin.country,
                    "year": coin.year
                },
                "similar_coins": filtered_results,
                "total_found": len(filtered_results),
                "similarity_threshold": similarity_threshold
            }
            
        finally:
            # Obnovení původního prahu
            image_search_service.similarity_threshold = original_threshold
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při vyhledávání: {str(e)}")

@router.post("/extract-features")
async def extract_image_features(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Extrakce příznaků z obrázku pro analýzu
    """
    if not image.content_type or not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Neplatný typ souboru - vyžadován obrázek")
    
    temp_file = None
    try:
        # Uložení dočasného souboru
        suffix = os.path.splitext(image.filename)[1] if image.filename else '.jpg'
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        
        content = await image.read()
        temp_file.write(content)
        temp_file.close()
        
        # Extrakce příznaků
        features = await image_search_service._extract_image_features(temp_file.name)
        
        if not features:
            raise HTTPException(status_code=500, detail="Nepodařilo se extrahovat příznaky z obrázku")
        
        # Příprava výsledků (bez numpy arrays pro JSON serialization)
        feature_summary = {
            "visual_features": {
                "orb_keypoints": features.get('orb_keypoints_count', 0),
                "sift_keypoints": features.get('sift_keypoints_count', 0)
            },
            "shape_features": {
                "area": features.get('shape_features', {}).get('area', 0),
                "perimeter": features.get('shape_features', {}).get('perimeter', 0),
                "circularity": features.get('shape_features', {}).get('circularity', 0),
                "convexity": features.get('shape_features', {}).get('convexity', 0),
                "vertices_count": features.get('shape_features', {}).get('vertices_count', 0)
            },
            "geometric_features": {
                "circles_detected": features.get('geometric_features', {}).get('circles_detected', 0),
                "largest_circle_radius": features.get('geometric_features', {}).get('largest_circle_radius', 0)
            },
            "texture_features": {
                "gabor_responses": features.get('texture_features', {}).get('gabor_responses', [])
            }
        }
        
        return {
            "success": True,
            "image_name": image.filename,
            "features": feature_summary,
            "feature_extraction_successful": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při extrakci příznaků: {str(e)}")
    
    finally:
        # Vyčištění dočasného souboru
        if temp_file:
            try:
                os.unlink(temp_file.name)
            except OSError:
                pass

@router.delete("/clear-cache")
async def clear_feature_cache(
    current_user: User = Depends(get_current_user)
):
    """
    Vymazání cache příznaků obrázků
    """
    try:
        image_search_service.clear_feature_cache()
        
        return {
            "success": True,
            "message": "Cache příznaků byla vymazána"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při mazání cache: {str(e)}")

@router.get("/search-statistics")
async def get_search_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Získání statistik vyhledávání
    """
    try:
        from ...models.coin import Coin, CoinImage
        
        # Základní statistiky
        total_coins = db.query(Coin).count()
        coins_with_images = db.query(Coin).join(CoinImage).distinct(Coin.id).count()
        total_images = db.query(CoinImage).count()
        
        # Statistiky podle typu obrázku
        image_types = db.query(CoinImage.image_type, db.func.count(CoinImage.id)).group_by(CoinImage.image_type).all()
        
        # Cache statistiky
        cache_dir = image_search_service.cache_dir
        cached_features = 0
        if os.path.exists(cache_dir):
            cached_features = len([f for f in os.listdir(cache_dir) if f.endswith('.pkl')])
        
        return {
            "success": True,
            "statistics": {
                "total_coins": total_coins,
                "coins_with_images": coins_with_images,
                "total_images": total_images,
                "image_coverage_percent": (coins_with_images / total_coins * 100) if total_coins > 0 else 0,
                "cached_features": cached_features,
                "image_types": [{"type": img_type, "count": count} for img_type, count in image_types],
                "search_configuration": {
                    "similarity_threshold": image_search_service.similarity_threshold,
                    "max_results": image_search_service.max_results,
                    "similarity_weights": image_search_service.similarity_weights
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při získávání statistik: {str(e)}")

@router.put("/search-configuration")
async def update_search_configuration(
    similarity_threshold: Optional[float] = Query(None, ge=0.1, le=1.0),
    max_results: Optional[int] = Query(None, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    """
    Aktualizace konfigurace vyhledávání
    """
    try:
        updated_config = {}
        
        if similarity_threshold is not None:
            image_search_service.similarity_threshold = similarity_threshold
            updated_config['similarity_threshold'] = similarity_threshold
        
        if max_results is not None:
            image_search_service.max_results = max_results
            updated_config['max_results'] = max_results
        
        return {
            "success": True,
            "message": "Konfigurace vyhledávání byla aktualizována",
            "updated_config": updated_config,
            "current_config": {
                "similarity_threshold": image_search_service.similarity_threshold,
                "max_results": image_search_service.max_results,
                "similarity_weights": image_search_service.similarity_weights
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při aktualizaci konfigurace: {str(e)}")