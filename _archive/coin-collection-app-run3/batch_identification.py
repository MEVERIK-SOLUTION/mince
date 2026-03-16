from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import tempfile
import os
import uuid
from datetime import datetime

from ...database import get_db
from ...services.batch_identification_service import batch_identification_service
from ...core.auth import get_current_user
from ...models.user import User

router = APIRouter()

# Úložiště pro progress tracking
active_batches = {}

@router.post("/batch-identify")
async def batch_identify_coins(
    images: List[UploadFile] = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    auto_fill_forms: bool = Query(True),
    estimate_prices: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dávková identifikace mincí z nahraných obrázků
    """
    if len(images) > batch_identification_service.max_batch_size:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximální počet obrázků je {batch_identification_service.max_batch_size}"
        )
    
    if len(images) == 0:
        raise HTTPException(status_code=400, detail="Nejméně jeden obrázek je vyžadován")
    
    # Generování batch ID
    batch_id = f"batch_{uuid.uuid4().hex[:8]}_{int(datetime.utcnow().timestamp())}"
    
    temp_files = []
    try:
        # Uložení dočasných souborů
        image_paths = []
        for i, image in enumerate(images):
            if not image.content_type or not image.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail=f"Neplatný typ souboru: {image.filename}")
            
            suffix = os.path.splitext(image.filename)[1] if image.filename else '.jpg'
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            temp_files.append(temp_file.name)
            
            content = await image.read()
            temp_file.write(content)
            temp_file.close()
            
            image_paths.append(temp_file.name)
        
        # Aktualizace konfigurace
        batch_identification_service.update_batch_config({
            'auto_fill_forms': auto_fill_forms,
            'estimate_prices': estimate_prices
        })
        
        # Progress callback
        async def progress_callback(progress: Dict):
            active_batches[batch_id] = progress
        
        # Spuštění batch identifikace na pozadí
        background_tasks.add_task(
            batch_identification_service.batch_identify_coins,
            image_paths,
            batch_id,
            db,
            progress_callback
        )
        
        # Inicializace progress tracking
        active_batches[batch_id] = {
            'batch_id': batch_id,
            'processed': 0,
            'total': len(images),
            'progress_percent': 0,
            'status': 'started',
            'start_time': datetime.utcnow().isoformat()
        }
        
        return {
            "success": True,
            "batch_id": batch_id,
            "total_images": len(images),
            "message": "Dávková identifikace byla spuštěna",
            "estimated_time_minutes": len(images) * 0.5,  # Odhad 30 sekund na obrázek
            "status_endpoint": f"/api/batch-identification/status/{batch_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Vyčištění dočasných souborů při chybě
        for temp_file in temp_files:
            try:
                os.unlink(temp_file)
            except OSError:
                pass
        raise HTTPException(status_code=500, detail=f"Chyba při spuštění batch identifikace: {str(e)}")

@router.post("/batch-identify-directory")
async def batch_identify_from_directory(
    directory_path: str,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    file_extensions: Optional[List[str]] = Query(None),
    auto_fill_forms: bool = Query(True),
    estimate_prices: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dávková identifikace mincí ze složky na serveru
    """
    if not os.path.exists(directory_path):
        raise HTTPException(status_code=404, detail="Složka neexistuje")
    
    # Generování batch ID
    batch_id = f"dir_batch_{uuid.uuid4().hex[:8]}_{int(datetime.utcnow().timestamp())}"
    
    try:
        # Aktualizace konfigurace
        batch_identification_service.update_batch_config({
            'auto_fill_forms': auto_fill_forms,
            'estimate_prices': estimate_prices
        })
        
        # Progress callback
        async def progress_callback(progress: Dict):
            active_batches[batch_id] = progress
        
        # Spuštění batch identifikace na pozadí
        background_tasks.add_task(
            batch_identification_service.batch_identify_from_directory,
            directory_path,
            batch_id,
            file_extensions,
            db,
            progress_callback
        )
        
        # Inicializace progress tracking
        active_batches[batch_id] = {
            'batch_id': batch_id,
            'processed': 0,
            'total': 0,  # Bude aktualizováno po skenování složky
            'progress_percent': 0,
            'status': 'scanning_directory',
            'start_time': datetime.utcnow().isoformat()
        }
        
        return {
            "success": True,
            "batch_id": batch_id,
            "directory_path": directory_path,
            "message": "Dávková identifikace ze složky byla spuštěna",
            "status_endpoint": f"/api/batch-identification/status/{batch_id}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při spuštění batch identifikace: {str(e)}")

@router.get("/status/{batch_id}")
async def get_batch_status(
    batch_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Získání stavu batch identifikace
    """
    try:
        # Kontrola aktivních batch operací
        if batch_id in active_batches:
            return {
                "success": True,
                "status": "active",
                "progress": active_batches[batch_id]
            }
        
        # Kontrola dokončených batch operací
        batch_status = await batch_identification_service.get_batch_status(batch_id)
        
        return {
            "success": True,
            "status": "completed" if batch_status.get('success') else "failed",
            "batch_status": batch_status
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při získávání stavu: {str(e)}")

@router.get("/results/{batch_id}")
async def get_batch_results(
    batch_id: str,
    include_errors: bool = Query(True),
    include_form_data: bool = Query(True),
    include_price_estimates: bool = Query(True),
    current_user: User = Depends(get_current_user)
):
    """
    Získání výsledků batch identifikace
    """
    try:
        batch_status = await batch_identification_service.get_batch_status(batch_id)
        
        if not batch_status or batch_status.get('status') == 'not_found':
            raise HTTPException(status_code=404, detail="Batch operace nenalezena")
        
        if batch_status.get('status') == 'processing':
            raise HTTPException(status_code=202, detail="Batch operace stále probíhá")
        
        # Filtrování výsledků podle parametrů
        results = batch_status.copy()
        
        if not include_errors and 'errors' in results:
            del results['errors']
        
        if not include_form_data:
            for result in results.get('results', []):
                if 'form_data' in result:
                    del result['form_data']
        
        if not include_price_estimates:
            for result in results.get('results', []):
                if 'price_estimate' in result:
                    del result['price_estimate']
        
        return {
            "success": True,
            "batch_results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při získávání výsledků: {str(e)}")

@router.delete("/cancel/{batch_id}")
async def cancel_batch(
    batch_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Zrušení batch identifikace
    """
    try:
        # Zrušení z aktivních operací
        if batch_id in active_batches:
            del active_batches[batch_id]
        
        # Zrušení ve službě
        result = await batch_identification_service.cancel_batch(batch_id)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při rušení batch operace: {str(e)}")

@router.get("/statistics")
async def get_batch_statistics(
    current_user: User = Depends(get_current_user)
):
    """
    Získání statistik batch identifikací
    """
    try:
        stats = batch_identification_service.get_batch_statistics()
        
        # Přidání informací o aktivních batch operacích
        stats['active_batches_detail'] = list(active_batches.values())
        
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při získávání statistik: {str(e)}")

@router.put("/configuration")
async def update_batch_configuration(
    config: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """
    Aktualizace konfigurace batch identifikace
    """
    try:
        # Validace konfigurace
        allowed_keys = {
            'chunk_size', 'timeout_per_coin', 'retry_failed', 'max_retries',
            'save_intermediate', 'auto_fill_forms', 'estimate_prices'
        }
        
        invalid_keys = set(config.keys()) - allowed_keys
        if invalid_keys:
            raise HTTPException(
                status_code=400, 
                detail=f"Neplatné konfigurační klíče: {list(invalid_keys)}"
            )
        
        # Validace hodnot
        if 'chunk_size' in config and (config['chunk_size'] < 1 or config['chunk_size'] > 20):
            raise HTTPException(status_code=400, detail="chunk_size musí být mezi 1 a 20")
        
        if 'timeout_per_coin' in config and (config['timeout_per_coin'] < 5 or config['timeout_per_coin'] > 300):
            raise HTTPException(status_code=400, detail="timeout_per_coin musí být mezi 5 a 300 sekundami")
        
        if 'max_retries' in config and (config['max_retries'] < 0 or config['max_retries'] > 5):
            raise HTTPException(status_code=400, detail="max_retries musí být mezi 0 a 5")
        
        # Aktualizace konfigurace
        batch_identification_service.update_batch_config(config)
        
        return {
            "success": True,
            "message": "Konfigurace byla aktualizována",
            "updated_config": config,
            "current_config": batch_identification_service.batch_config
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při aktualizaci konfigurace: {str(e)}")

@router.get("/active-batches")
async def get_active_batches(
    current_user: User = Depends(get_current_user)
):
    """
    Získání seznamu aktivních batch operací
    """
    try:
        return {
            "success": True,
            "active_batches": list(active_batches.values()),
            "total_active": len(active_batches)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při získávání aktivních batch operací: {str(e)}")

@router.post("/retry-failed/{batch_id}")
async def retry_failed_identifications(
    batch_id: str,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Opakování neúspěšných identifikací z batch operace
    """
    try:
        # Získání původních výsledků
        batch_status = await batch_identification_service.get_batch_status(batch_id)
        
        if not batch_status or batch_status.get('status') == 'not_found':
            raise HTTPException(status_code=404, detail="Batch operace nenalezena")
        
        # Získání neúspěšných obrázků
        failed_images = []
        for error in batch_status.get('errors', []):
            if 'image_path' in error and os.path.exists(error['image_path']):
                failed_images.append(error['image_path'])
        
        if not failed_images:
            return {
                "success": True,
                "message": "Žádné neúspěšné identifikace k opakování",
                "failed_count": 0
            }
        
        # Generování nového batch ID pro retry
        retry_batch_id = f"retry_{batch_id}_{int(datetime.utcnow().timestamp())}"
        
        # Progress callback
        async def progress_callback(progress: Dict):
            active_batches[retry_batch_id] = progress
        
        # Spuštění retry batch identifikace na pozadí
        background_tasks.add_task(
            batch_identification_service.batch_identify_coins,
            failed_images,
            retry_batch_id,
            db,
            progress_callback
        )
        
        # Inicializace progress tracking
        active_batches[retry_batch_id] = {
            'batch_id': retry_batch_id,
            'processed': 0,
            'total': len(failed_images),
            'progress_percent': 0,
            'status': 'retry_started',
            'original_batch_id': batch_id,
            'start_time': datetime.utcnow().isoformat()
        }
        
        return {
            "success": True,
            "retry_batch_id": retry_batch_id,
            "original_batch_id": batch_id,
            "failed_images_count": len(failed_images),
            "message": "Opakování neúspěšných identifikací bylo spuštěno",
            "status_endpoint": f"/api/batch-identification/status/{retry_batch_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při opakování identifikací: {str(e)}")

@router.delete("/cleanup-completed")
async def cleanup_completed_batches(
    older_than_hours: int = Query(24, ge=1, le=168),  # 1 hodina až 1 týden
    current_user: User = Depends(get_current_user)
):
    """
    Vyčištění dokončených batch operací starších než zadaný počet hodin
    """
    try:
        cutoff_time = datetime.utcnow().timestamp() - (older_than_hours * 3600)
        
        # Vyčištění z active_batches
        to_remove = []
        for batch_id, batch_info in active_batches.items():
            start_time_str = batch_info.get('start_time', '')
            try:
                start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
                if start_time.timestamp() < cutoff_time:
                    to_remove.append(batch_id)
            except:
                continue
        
        for batch_id in to_remove:
            del active_batches[batch_id]
        
        # Vyčištění uložených souborů
        results_dir = "batch_results"
        cleaned_files = 0
        if os.path.exists(results_dir):
            for filename in os.listdir(results_dir):
                filepath = os.path.join(results_dir, filename)
                if os.path.getmtime(filepath) < cutoff_time:
                    try:
                        os.remove(filepath)
                        cleaned_files += 1
                    except OSError:
                        continue
        
        return {
            "success": True,
            "message": f"Vyčištěno {len(to_remove)} aktivních batch operací a {cleaned_files} souborů",
            "removed_active_batches": len(to_remove),
            "removed_files": cleaned_files,
            "cutoff_hours": older_than_hours
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při čištění: {str(e)}")