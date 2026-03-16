from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Response, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import tempfile
from pathlib import Path

from ...database import get_db
from ...services.backup_service import BackupService
from ...models.user import User
from ...core.auth import get_current_user

router = APIRouter()

@router.post("/backups/full")
async def create_full_backup(
    background_tasks: BackgroundTasks,
    include_images: bool = Query(True, description="Zahrnout obrázky do zálohy"),
    compression_level: int = Query(6, description="Úroveň komprese (1-9)", ge=1, le=9),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Vytvoří kompletní zálohu všech dat uživatele
    """
    try:
        backup_service = BackupService(db)
        
        # Spuštění zálohy na pozadí
        backup_info = await backup_service.create_full_backup(
            user_id=current_user.id,
            include_images=include_images,
            compression_level=compression_level
        )
        
        return {
            "message": "Kompletní záloha byla vytvořena",
            "backup_info": backup_info
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při vytváření zálohy: {str(e)}")

@router.post("/collections/{collection_id}/backup")
async def create_collection_backup(
    collection_id: int,
    include_images: bool = Query(True, description="Zahrnout obrázky do zálohy"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Vytvoří zálohu konkrétní kolekce
    """
    try:
        backup_service = BackupService(db)
        
        backup_info = await backup_service.create_collection_backup(
            collection_id=collection_id,
            include_images=include_images
        )
        
        return {
            "message": "Záloha kolekce byla vytvořena",
            "backup_info": backup_info
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při vytváření zálohy: {str(e)}")

@router.get("/backups")
async def list_backups(
    backup_type: Optional[str] = Query(None, description="Typ zálohy: full_backup, collection_backup"),
    limit: int = Query(50, description="Maximální počet záznamů", ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Vypíše dostupné zálohy uživatele
    """
    try:
        backup_service = BackupService(db)
        
        backups = backup_service.list_backups(
            user_id=current_user.id,
            backup_type=backup_type,
            limit=limit
        )
        
        return {
            "backups": backups,
            "total": len(backups)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při načítání záloh: {str(e)}")

@router.get("/backups/{backup_id}/download")
async def download_backup(
    backup_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Stáhne záložní soubor
    """
    try:
        backup_service = BackupService(db)
        
        # Najít zálohu
        backups = backup_service.list_backups(user_id=current_user.id)
        backup = next((b for b in backups if b["backup_id"] == backup_id), None)
        
        if not backup:
            raise HTTPException(status_code=404, detail="Záloha nenalezena")
        
        backup_path = Path(backup["file_path"])
        if not backup_path.exists():
            raise HTTPException(status_code=404, detail="Záložní soubor nenalezen")
        
        # Vrácení souboru
        with open(backup_path, "rb") as f:
            content = f.read()
        
        return Response(
            content=content,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={backup_id}.zip"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při stahování zálohy: {str(e)}")

@router.post("/backups/{backup_id}/verify")
async def verify_backup(
    backup_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ověří integritu zálohy
    """
    try:
        backup_service = BackupService(db)
        
        # Najít zálohu
        backups = backup_service.list_backups(user_id=current_user.id)
        backup = next((b for b in backups if b["backup_id"] == backup_id), None)
        
        if not backup:
            raise HTTPException(status_code=404, detail="Záloha nenalezena")
        
        verification_result = await backup_service.verify_backup_integrity(backup["file_path"])
        
        return verification_result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při ověřování zálohy: {str(e)}")

@router.post("/restore")
async def restore_from_backup(
    backup_file: UploadFile = File(...),
    strategy: str = Query("merge", description="Strategie obnovení: merge, replace, new_collection"),
    restore_images: bool = Query(True, description="Obnovit také obrázky"),
    collection_name_suffix: str = Query("_restored", description="Přípona pro názvy kolekcí"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obnoví data ze záložního souboru
    """
    if not backup_file.filename or not backup_file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Podporovány jsou pouze ZIP soubory")
    
    try:
        backup_service = BackupService(db)
        
        # Uložení nahraného souboru
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_file:
            content = await backup_file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Ověření integrity před obnovením
            verification = await backup_service.verify_backup_integrity(temp_file_path)
            if not verification["valid"]:
                raise HTTPException(status_code=400, detail=f"Neplatná záloha: {verification['error']}")
            
            # Obnovení dat
            restore_options = {
                "strategy": strategy,
                "restore_images": restore_images,
                "collection_name_suffix": collection_name_suffix
            }
            
            restore_result = await backup_service.restore_from_backup(
                backup_file_path=temp_file_path,
                user_id=current_user.id,
                restore_options=restore_options
            )
            
            return {
                "message": "Data byla úspěšně obnovena ze zálohy",
                "restore_result": restore_result
            }
            
        finally:
            # Vyčištění dočasného souboru
            Path(temp_file_path).unlink(missing_ok=True)
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při obnovování ze zálohy: {str(e)}")

@router.post("/restore/from-backup/{backup_id}")
async def restore_from_existing_backup(
    backup_id: str,
    strategy: str = Query("merge", description="Strategie obnovení: merge, replace, new_collection"),
    restore_images: bool = Query(True, description="Obnovit také obrázky"),
    collection_name_suffix: str = Query("_restored", description="Přípona pro názvy kolekcí"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obnoví data z existující zálohy
    """
    try:
        backup_service = BackupService(db)
        
        # Najít zálohu
        backups = backup_service.list_backups(user_id=current_user.id)
        backup = next((b for b in backups if b["backup_id"] == backup_id), None)
        
        if not backup:
            raise HTTPException(status_code=404, detail="Záloha nenalezena")
        
        # Obnovení dat
        restore_options = {
            "strategy": strategy,
            "restore_images": restore_images,
            "collection_name_suffix": collection_name_suffix
        }
        
        restore_result = await backup_service.restore_from_backup(
            backup_file_path=backup["file_path"],
            user_id=current_user.id,
            restore_options=restore_options
        )
        
        return {
            "message": "Data byla úspěšně obnovena ze zálohy",
            "restore_result": restore_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při obnovování ze zálohy: {str(e)}")

@router.delete("/backups/{backup_id}")
async def delete_backup(
    backup_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Smaže zálohu
    """
    try:
        backup_service = BackupService(db)
        
        # Ověření, že záloha patří uživateli
        backups = backup_service.list_backups(user_id=current_user.id)
        backup = next((b for b in backups if b["backup_id"] == backup_id), None)
        
        if not backup:
            raise HTTPException(status_code=404, detail="Záloha nenalezena")
        
        success = backup_service.delete_backup(backup_id)
        
        if success:
            return {
                "message": f"Záloha {backup_id} byla smazána",
                "deleted_at": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Nepodařilo se smazat zálohu")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při mazání zálohy: {str(e)}")

@router.post("/backups/cleanup")
async def cleanup_old_backups(
    retention_days: int = Query(30, description="Počet dní pro uchování záloh", ge=1, le=365),
    keep_minimum: int = Query(5, description="Minimální počet záloh k uchování", ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Vyčistí staré zálohy podle pravidel retence
    """
    try:
        backup_service = BackupService(db)
        
        cleanup_result = backup_service.cleanup_old_backups(
            retention_days=retention_days,
            keep_minimum=keep_minimum
        )
        
        return {
            "message": "Vyčištění záloh dokončeno",
            "cleanup_result": cleanup_result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při čištění záloh: {str(e)}")

@router.get("/backups/settings")
async def get_backup_settings(
    current_user: User = Depends(get_current_user)
):
    """
    Získá nastavení zálohování
    """
    # Simulace nastavení (v reálné aplikaci by se načítalo z DB nebo konfigurace)
    settings = {
        "auto_backup_enabled": False,
        "auto_backup_frequency": "weekly",  # daily, weekly, monthly
        "include_images_by_default": True,
        "compression_level": 6,
        "retention_days": 30,
        "keep_minimum_backups": 5,
        "s3_backup_enabled": False,
        "backup_notifications": True,
        "max_backup_size_mb": 1000
    }
    
    return {
        "settings": settings,
        "available_frequencies": [
            {"value": "daily", "label": "Denně"},
            {"value": "weekly", "label": "Týdně"},
            {"value": "monthly", "label": "Měsíčně"}
        ],
        "compression_levels": [
            {"value": 1, "label": "Nejrychlejší (největší soubor)"},
            {"value": 6, "label": "Vyvážené (doporučeno)"},
            {"value": 9, "label": "Nejmenší (nejpomalejší)"}
        ]
    }

@router.put("/backups/settings")
async def update_backup_settings(
    settings: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """
    Aktualizuje nastavení zálohování
    """
    # Validace nastavení
    allowed_frequencies = ["daily", "weekly", "monthly"]
    if settings.get("auto_backup_frequency") not in allowed_frequencies:
        raise HTTPException(status_code=400, detail="Neplatná frekvence zálohování")
    
    compression_level = settings.get("compression_level", 6)
    if not (1 <= compression_level <= 9):
        raise HTTPException(status_code=400, detail="Úroveň komprese musí být mezi 1-9")
    
    retention_days = settings.get("retention_days", 30)
    if not (1 <= retention_days <= 365):
        raise HTTPException(status_code=400, detail="Doba uchování musí být mezi 1-365 dny")
    
    # V reálné aplikaci by se uložilo do databáze
    # user_settings = UserBackupSettings(user_id=current_user.id, **settings)
    # db.merge(user_settings)
    # db.commit()
    
    return {
        "message": "Nastavení zálohování bylo aktualizováno",
        "settings": settings,
        "updated_at": datetime.now().isoformat()
    }

@router.get("/backups/statistics")
async def get_backup_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Získá statistiky zálohování
    """
    try:
        backup_service = BackupService(db)
        
        # Načtení všech záloh uživatele
        backups = backup_service.list_backups(user_id=current_user.id)
        
        if not backups:
            return {
                "total_backups": 0,
                "total_size": 0,
                "oldest_backup": None,
                "newest_backup": None,
                "backup_types": {},
                "storage_usage": {
                    "local": {"count": 0, "size": 0},
                    "s3": {"count": 0, "size": 0}
                }
            }
        
        # Výpočet statistik
        total_size = sum(backup["file_size"] for backup in backups)
        backup_types = {}
        storage_usage = {"local": {"count": 0, "size": 0}, "s3": {"count": 0, "size": 0}}
        
        for backup in backups:
            # Typy záloh
            backup_type = backup["backup_type"]
            if backup_type not in backup_types:
                backup_types[backup_type] = {"count": 0, "size": 0}
            backup_types[backup_type]["count"] += 1
            backup_types[backup_type]["size"] += backup["file_size"]
            
            # Úložiště
            storage_type = backup.get("storage_type", "local")
            storage_usage[storage_type]["count"] += 1
            storage_usage[storage_type]["size"] += backup["file_size"]
        
        # Nejstarší a nejnovější záloha
        sorted_backups = sorted(backups, key=lambda x: x["created_at"])
        oldest_backup = sorted_backups[0]
        newest_backup = sorted_backups[-1]
        
        return {
            "total_backups": len(backups),
            "total_size": total_size,
            "total_size_formatted": f"{total_size / (1024*1024):.1f} MB",
            "oldest_backup": {
                "backup_id": oldest_backup["backup_id"],
                "created_at": oldest_backup["created_at"],
                "backup_type": oldest_backup["backup_type"]
            },
            "newest_backup": {
                "backup_id": newest_backup["backup_id"],
                "created_at": newest_backup["created_at"],
                "backup_type": newest_backup["backup_type"]
            },
            "backup_types": backup_types,
            "storage_usage": storage_usage,
            "average_backup_size": total_size / len(backups),
            "average_backup_size_formatted": f"{(total_size / len(backups)) / (1024*1024):.1f} MB"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při načítání statistik: {str(e)}")

@router.post("/backups/schedule")
async def schedule_automatic_backup(
    collection_id: Optional[int] = Query(None, description="ID kolekce (None pro kompletní zálohu)"),
    frequency: str = Query("weekly", description="Frekvence: daily, weekly, monthly"),
    include_images: bool = Query(True, description="Zahrnout obrázky"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Naplánuje automatické zálohování
    """
    if frequency not in ["daily", "weekly", "monthly"]:
        raise HTTPException(status_code=400, detail="Neplatná frekvence")
    
    # Simulace vytvoření plánu (v reálné aplikaci by se použil Celery nebo podobný scheduler)
    schedule_id = f"schedule_{current_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    return {
        "schedule_id": schedule_id,
        "user_id": current_user.id,
        "collection_id": collection_id,
        "backup_type": "collection" if collection_id else "full",
        "frequency": frequency,
        "include_images": include_images,
        "next_execution": "2024-01-16T02:00:00",  # Simulace
        "status": "active",
        "created_at": datetime.now().isoformat()
    }

@router.get("/backups/schedules")
async def get_backup_schedules(
    current_user: User = Depends(get_current_user)
):
    """
    Získá naplánované zálohy
    """
    # Simulace (v reálné aplikaci by se načítalo z DB)
    schedules = [
        {
            "schedule_id": f"schedule_{current_user.id}_20240101_120000",
            "backup_type": "full",
            "frequency": "weekly",
            "include_images": True,
            "next_execution": "2024-01-16T02:00:00",
            "last_execution": "2024-01-09T02:00:00",
            "status": "active",
            "created_at": "2024-01-01T12:00:00"
        }
    ]
    
    return {
        "schedules": schedules,
        "total": len(schedules)
    }

@router.delete("/backups/schedules/{schedule_id}")
async def cancel_backup_schedule(
    schedule_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Zruší naplánované zálohování
    """
    # V reálné aplikaci by se smazal záznam z DB a zrušil úkol ve scheduleru
    return {
        "message": f"Plán zálohování {schedule_id} byl zrušen",
        "cancelled_at": datetime.now().isoformat()
    }