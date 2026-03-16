import asyncio
import logging
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from celery import current_task
from sqlalchemy.orm import Session
from PIL import Image
import io
import base64

from .celery_app import celery_app
from ..database import get_db
from ..models.user import User
from ..models.coin import Coin
from ..models.collection import Collection
from ..models.coin_image import CoinImage
from ..services.coin_identification import CoinIdentificationService
from ..services.batch_identification_service import BatchIdentificationService
from ..services.report_service import ReportService
from ..services.backup_service import BackupService
from ..services.email_service import EmailService
from ..services.api_integrations import MultiAPIService

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=3)
def process_coin_identification(self, image_data: str, user_id: int, collection_id: Optional[int] = None):
    """Zpracování identifikace mince z obrázku"""
    try:
        logger.info(f"Starting coin identification for user {user_id}")
        
        db = next(get_db())
        identification_service = CoinIdentificationService()
        
        # Dekódování base64 obrázku
        try:
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            raise ValueError(f"Invalid image data: {str(e)}")
        
        # Aktualizace stavu úlohy
        if hasattr(current_task, 'update_state'):
            current_task.update_state(
                state='PROGRESS',
                meta={'stage': 'analyzing_image', 'progress': 25}
            )
        
        # Identifikace mince
        identification_result = asyncio.run(
            identification_service.identify_coin_from_image(image)
        )
        
        if hasattr(current_task, 'update_state'):
            current_task.update_state(
                state='PROGRESS',
                meta={'stage': 'fetching_details', 'progress': 50}
            )
        
        # Získání dodatečných informací z API
        api_service = MultiAPIService()
        if identification_result.get('name'):
            search_query = f"{identification_result['name']} {identification_result.get('country', '')} {identification_result.get('year', '')}"
            additional_data = asyncio.run(api_service.search_coin(search_query))
            
            if additional_data:
                identification_result.update(additional_data)
        
        if hasattr(current_task, 'update_state'):
            current_task.update_state(
                state='PROGRESS',
                meta={'stage': 'saving_results', 'progress': 75}
            )
        
        # Uložení výsledků (pokud je zadána kolekce)
        coin_id = None
        if collection_id:
            collection = db.query(Collection).filter(
                Collection.id == collection_id,
                Collection.user_id == user_id
            ).first()
            
            if collection:
                # Vytvoření nové mince
                coin = Coin(
                    collection_id=collection_id,
                    name=identification_result.get('name', 'Neidentifikovaná mince'),
                    country=identification_result.get('country'),
                    year=identification_result.get('year'),
                    denomination=identification_result.get('denomination'),
                    currency=identification_result.get('currency'),
                    material=identification_result.get('material'),
                    weight=identification_result.get('weight'),
                    diameter=identification_result.get('diameter'),
                    condition=identification_result.get('condition'),
                    rarity=identification_result.get('rarity'),
                    current_value=identification_result.get('current_value'),
                    notes=f"Automaticky identifikováno s důvěrou {identification_result.get('confidence', 0):.1%}"
                )
                
                db.add(coin)
                db.flush()
                coin_id = coin.id
                
                # Uložení obrázku
                if image_data:
                    # Vytvoření adresáře pro obrázky
                    upload_dir = f"uploads/coins/{coin_id}"
                    os.makedirs(upload_dir, exist_ok=True)
                    
                    # Uložení obrázku
                    image_filename = f"identification_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                    image_path = os.path.join(upload_dir, image_filename)
                    
                    with open(image_path, 'wb') as f:
                        f.write(image_bytes)
                    
                    # Vytvoření záznamu v databázi
                    coin_image = CoinImage(
                        coin_id=coin_id,
                        filename=image_filename,
                        file_path=image_path,
                        file_size=len(image_bytes),
                        image_type="identification",
                        is_primary=True,
                        description="Automaticky identifikovaný obrázek"
                    )
                    
                    db.add(coin_image)
        
        db.commit()
        db.close()
        
        if hasattr(current_task, 'update_state'):
            current_task.update_state(
                state='PROGRESS',
                meta={'stage': 'completed', 'progress': 100}
            )
        
        result = {
            "identification_result": identification_result,
            "coin_id": coin_id,
            "confidence": identification_result.get('confidence', 0),
            "completed_at": datetime.now().isoformat()
        }
        
        logger.info(f"Coin identification completed for user {user_id}")
        return result
        
    except Exception as e:
        logger.error(f"Coin identification failed: {str(e)}")
        raise self.retry(countdown=60, exc=e)

@celery_app.task(bind=True, max_retries=3)
def process_batch_identification(self, image_data_list: List[str], user_id: int, collection_id: int):
    """Dávkové zpracování identifikace mincí"""
    try:
        logger.info(f"Starting batch identification for user {user_id}, {len(image_data_list)} images")
        
        db = next(get_db())
        batch_service = BatchIdentificationService()
        
        # Ověření kolekce
        collection = db.query(Collection).filter(
            Collection.id == collection_id,
            Collection.user_id == user_id
        ).first()
        
        if not collection:
            raise ValueError("Collection not found or access denied")
        
        results = []
        total_images = len(image_data_list)
        
        for i, image_data in enumerate(image_data_list):
            try:
                # Aktualizace progress
                if hasattr(current_task, 'update_state'):
                    current_task.update_state(
                        state='PROGRESS',
                        meta={
                            'current_image': i + 1,
                            'total_images': total_images,
                            'progress': int((i / total_images) * 100),
                            'completed_identifications': len(results)
                        }
                    )
                
                # Dekódování obrázku
                image_bytes = base64.b64decode(image_data)
                image = Image.open(io.BytesIO(image_bytes))
                
                # Identifikace
                identification_result = asyncio.run(
                    batch_service.identify_single_coin(image)
                )
                
                # Uložení mince do kolekce
                coin = Coin(
                    collection_id=collection_id,
                    name=identification_result.get('name', f'Mince #{i+1}'),
                    country=identification_result.get('country'),
                    year=identification_result.get('year'),
                    denomination=identification_result.get('denomination'),
                    currency=identification_result.get('currency'),
                    material=identification_result.get('material'),
                    weight=identification_result.get('weight'),
                    diameter=identification_result.get('diameter'),
                    condition=identification_result.get('condition'),
                    rarity=identification_result.get('rarity'),
                    current_value=identification_result.get('current_value'),
                    notes=f"Dávková identifikace - důvěra {identification_result.get('confidence', 0):.1%}"
                )
                
                db.add(coin)
                db.flush()
                
                # Uložení obrázku
                upload_dir = f"uploads/coins/{coin.id}"
                os.makedirs(upload_dir, exist_ok=True)
                
                image_filename = f"batch_{i+1}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                image_path = os.path.join(upload_dir, image_filename)
                
                with open(image_path, 'wb') as f:
                    f.write(image_bytes)
                
                coin_image = CoinImage(
                    coin_id=coin.id,
                    filename=image_filename,
                    file_path=image_path,
                    file_size=len(image_bytes),
                    image_type="batch_identification",
                    is_primary=True,
                    description=f"Dávková identifikace - obrázek {i+1}"
                )
                
                db.add(coin_image)
                
                results.append({
                    "coin_id": coin.id,
                    "identification_result": identification_result,
                    "image_index": i,
                    "confidence": identification_result.get('confidence', 0)
                })
                
            except Exception as e:
                logger.error(f"Error processing image {i}: {str(e)}")
                results.append({
                    "coin_id": None,
                    "error": str(e),
                    "image_index": i,
                    "confidence": 0
                })
        
        db.commit()
        db.close()
        
        # Finální výsledek
        successful_identifications = [r for r in results if r.get('coin_id')]
        average_confidence = sum(r.get('confidence', 0) for r in successful_identifications) / len(successful_identifications) if successful_identifications else 0
        
        final_result = {
            "total_images": total_images,
            "successful_identifications": len(successful_identifications),
            "failed_identifications": total_images - len(successful_identifications),
            "average_confidence": average_confidence,
            "results": results,
            "collection_id": collection_id,
            "completed_at": datetime.now().isoformat()
        }
        
        logger.info(f"Batch identification completed: {len(successful_identifications)}/{total_images} successful")
        return final_result
        
    except Exception as e:
        logger.error(f"Batch identification failed: {str(e)}")
        raise self.retry(countdown=120, exc=e)

@celery_app.task(bind=True, max_retries=3)
def generate_reports(self, user_id: int, report_type: str, report_config: Dict[str, Any]):
    """Generování reportů"""
    try:
        logger.info(f"Starting report generation for user {user_id}, type: {report_type}")
        
        db = next(get_db())
        report_service = ReportService(db)
        
        # Aktualizace stavu
        if hasattr(current_task, 'update_state'):
            current_task.update_state(
                state='PROGRESS',
                meta={'stage': 'preparing_data', 'progress': 20}
            )
        
        # Generování reportu podle typu
        if report_type == "collection_summary":
            report_data = asyncio.run(report_service.generate_collection_summary(
                user_id, report_config
            ))
        elif report_type == "value_analysis":
            report_data = asyncio.run(report_service.generate_value_analysis(
                user_id, report_config
            ))
        elif report_type == "acquisition_report":
            report_data = asyncio.run(report_service.generate_acquisition_report(
                user_id, report_config
            ))
        elif report_type == "custom":
            report_data = asyncio.run(report_service.generate_custom_report(
                user_id, report_config
            ))
        else:
            raise ValueError(f"Unknown report type: {report_type}")
        
        if hasattr(current_task, 'update_state'):
            current_task.update_state(
                state='PROGRESS',
                meta={'stage': 'generating_file', 'progress': 60}
            )
        
        # Vytvoření souboru reportu
        report_format = report_config.get('format', 'pdf')
        report_file_path = None
        
        if report_format == 'pdf':
            report_file_path = asyncio.run(report_service.create_pdf_report(
                report_data, user_id
            ))
        elif report_format == 'excel':
            report_file_path = asyncio.run(report_service.create_excel_report(
                report_data, user_id
            ))
        elif report_format == 'csv':
            report_file_path = asyncio.run(report_service.create_csv_report(
                report_data, user_id
            ))
        
        if hasattr(current_task, 'update_state'):
            current_task.update_state(
                state='PROGRESS',
                meta={'stage': 'sending_notification', 'progress': 80}
            )
        
        # Odeslání notifikace uživateli
        if report_file_path and report_config.get('send_email', False):
            user = db.query(User).filter(User.id == user_id).first()
            if user and user.email:
                email_service = EmailService()
                asyncio.run(email_service.send_report_notification(
                    user.email,
                    user.full_name,
                    report_type,
                    report_file_path
                ))
        
        db.close()
        
        result = {
            "report_type": report_type,
            "report_file_path": report_file_path,
            "report_data_summary": {
                "total_records": len(report_data.get('records', [])),
                "total_value": report_data.get('summary', {}).get('total_value', 0),
                "generated_at": datetime.now().isoformat()
            },
            "completed_at": datetime.now().isoformat()
        }
        
        logger.info(f"Report generation completed for user {user_id}")
        return result
        
    except Exception as e:
        logger.error(f"Report generation failed: {str(e)}")
        raise self.retry(countdown=180, exc=e)

@celery_app.task(bind=True, max_retries=3)
def backup_user_data(self, user_id: int, backup_config: Dict[str, Any]):
    """Záloha dat uživatele"""
    try:
        logger.info(f"Starting backup for user {user_id}")
        
        db = next(get_db())
        backup_service = BackupService(db)
        
        # Aktualizace stavu
        if hasattr(current_task, 'update_state'):
            current_task.update_state(
                state='PROGRESS',
                meta={'stage': 'collecting_data', 'progress': 25}
            )
        
        # Vytvoření zálohy
        backup_type = backup_config.get('type', 'full')
        include_images = backup_config.get('include_images', True)
        compression_level = backup_config.get('compression_level', 6)
        
        if backup_type == 'full':
            backup_info = asyncio.run(backup_service.create_full_backup(
                user_id=user_id,
                include_images=include_images,
                compression_level=compression_level
            ))
        else:
            collection_id = backup_config.get('collection_id')
            if not collection_id:
                raise ValueError("Collection ID required for collection backup")
            
            backup_info = asyncio.run(backup_service.create_collection_backup(
                collection_id=collection_id,
                include_images=include_images
            ))
        
        if hasattr(current_task, 'update_state'):
            current_task.update_state(
                state='PROGRESS',
                meta={'stage': 'finalizing', 'progress': 90}
            )
        
        # Odeslání notifikace
        if backup_config.get('send_notification', True):
            user = db.query(User).filter(User.id == user_id).first()
            if user and user.email:
                email_service = EmailService()
                asyncio.run(email_service.send_backup_notification(
                    user.email,
                    user.full_name,
                    backup_info
                ))
        
        db.close()
        
        logger.info(f"Backup completed for user {user_id}: {backup_info['backup_id']}")
        return backup_info
        
    except Exception as e:
        logger.error(f"Backup failed for user {user_id}: {str(e)}")
        raise self.retry(countdown=300, exc=e)

@celery_app.task(bind=True, max_retries=3)
def process_image_optimization(self, image_paths: List[str], optimization_config: Dict[str, Any]):
    """Optimalizace obrázků"""
    try:
        logger.info(f"Starting image optimization for {len(image_paths)} images")
        
        optimized_images = []
        total_images = len(image_paths)
        
        # Konfigurace optimalizace
        max_width = optimization_config.get('max_width', 1200)
        max_height = optimization_config.get('max_height', 1200)
        quality = optimization_config.get('quality', 85)
        format_type = optimization_config.get('format', 'JPEG')
        
        for i, image_path in enumerate(image_paths):
            try:
                # Aktualizace progress
                if hasattr(current_task, 'update_state'):
                    current_task.update_state(
                        state='PROGRESS',
                        meta={
                            'current_image': i + 1,
                            'total_images': total_images,
                            'progress': int((i / total_images) * 100)
                        }
                    )
                
                # Načtení a optimalizace obrázku
                with Image.open(image_path) as img:
                    # Změna velikosti pokud je potřeba
                    if img.width > max_width or img.height > max_height:
                        img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
                    
                    # Konverze do RGB pokud je potřeba
                    if img.mode in ('RGBA', 'P'):
                        img = img.convert('RGB')
                    
                    # Uložení optimalizovaného obrázku
                    optimized_path = image_path.replace('.', f'_optimized.')
                    img.save(optimized_path, format=format_type, quality=quality, optimize=True)
                    
                    # Informace o optimalizaci
                    original_size = os.path.getsize(image_path)
                    optimized_size = os.path.getsize(optimized_path)
                    
                    optimized_images.append({
                        "original_path": image_path,
                        "optimized_path": optimized_path,
                        "original_size": original_size,
                        "optimized_size": optimized_size,
                        "size_reduction": ((original_size - optimized_size) / original_size) * 100,
                        "dimensions": f"{img.width}x{img.height}"
                    })
                
            except Exception as e:
                logger.error(f"Error optimizing image {image_path}: {str(e)}")
                optimized_images.append({
                    "original_path": image_path,
                    "error": str(e)
                })
        
        # Souhrnné statistiky
        successful_optimizations = [img for img in optimized_images if 'optimized_path' in img]
        total_original_size = sum(img.get('original_size', 0) for img in successful_optimizations)
        total_optimized_size = sum(img.get('optimized_size', 0) for img in successful_optimizations)
        
        result = {
            "total_images": total_images,
            "successful_optimizations": len(successful_optimizations),
            "failed_optimizations": total_images - len(successful_optimizations),
            "total_size_reduction": ((total_original_size - total_optimized_size) / total_original_size * 100) if total_original_size > 0 else 0,
            "total_original_size_mb": round(total_original_size / 1024 / 1024, 2),
            "total_optimized_size_mb": round(total_optimized_size / 1024 / 1024, 2),
            "images": optimized_images,
            "completed_at": datetime.now().isoformat()
        }
        
        logger.info(f"Image optimization completed: {len(successful_optimizations)}/{total_images} successful")
        return result
        
    except Exception as e:
        logger.error(f"Image optimization failed: {str(e)}")
        raise self.retry(countdown=120, exc=e)

@celery_app.task(bind=True, max_retries=3)
def sync_external_data(self, sync_config: Dict[str, Any]):
    """Synchronizace s externími zdroji dat"""
    try:
        logger.info("Starting external data synchronization")
        
        db = next(get_db())
        api_service = MultiAPIService()
        
        sync_type = sync_config.get('type', 'price_update')
        
        if sync_type == 'price_update':
            # Synchronizace cen z externích API
            coins_to_update = db.query(Coin).filter(
                Coin.current_value.isnot(None),
                Coin.updated_at < datetime.now() - timedelta(days=7)  # Starší než týden
            ).limit(sync_config.get('limit', 100)).all()
            
            updated_count = 0
            
            for coin in coins_to_update:
                try:
                    search_query = f"{coin.name} {coin.country} {coin.year}"
                    price_data = asyncio.run(api_service.get_coin_price(search_query))
                    
                    if price_data and price_data.get('current_price'):
                        coin.current_value = price_data['current_price']
                        coin.updated_at = datetime.now()
                        updated_count += 1
                        
                except Exception as e:
                    logger.error(f"Error updating price for coin {coin.id}: {str(e)}")
            
            db.commit()
            
            result = {
                "sync_type": sync_type,
                "total_coins": len(coins_to_update),
                "updated_count": updated_count,
                "completed_at": datetime.now().isoformat()
            }
            
        elif sync_type == 'catalog_update':
            # Synchronizace katalogu mincí
            result = asyncio.run(api_service.sync_coin_catalog())
            
        else:
            raise ValueError(f"Unknown sync type: {sync_type}")
        
        db.close()
        
        logger.info(f"External data sync completed: {sync_type}")
        return result
        
    except Exception as e:
        logger.error(f"External data sync failed: {str(e)}")
        raise self.retry(countdown=300, exc=e)

# Pomocné úlohy pro údržbu
@celery_app.task
def cleanup_temp_files():
    """Čištění dočasných souborů"""
    try:
        import tempfile
        import shutil
        
        temp_dir = tempfile.gettempdir()
        cleanup_count = 0
        
        # Čištění souborů starších než 24 hodin
        cutoff_time = datetime.now() - timedelta(hours=24)
        
        for filename in os.listdir(temp_dir):
            if filename.startswith("coin_collection_"):
                file_path = os.path.join(temp_dir, filename)
                try:
                    if os.path.getmtime(file_path) < cutoff_time.timestamp():
                        if os.path.isfile(file_path):
                            os.remove(file_path)
                        elif os.path.isdir(file_path):
                            shutil.rmtree(file_path)
                        cleanup_count += 1
                except Exception as e:
                    logger.warning(f"Could not clean up {file_path}: {e}")
        
        return {
            "cleaned_files": cleanup_count,
            "completed_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Temp file cleanup failed: {str(e)}")
        return {"error": str(e)}

@celery_app.task
def validate_data_integrity():
    """Validace integrity dat"""
    try:
        db = next(get_db())
        
        issues = []
        
        # Kontrola mincí bez kolekcí
        orphaned_coins = db.query(Coin).filter(
            ~Coin.collection_id.in_(db.query(Collection.id))
        ).count()
        
        if orphaned_coins > 0:
            issues.append(f"Found {orphaned_coins} orphaned coins")
        
        # Kontrola obrázků bez mincí
        orphaned_images = db.query(CoinImage).filter(
            ~CoinImage.coin_id.in_(db.query(Coin.id))
        ).count()
        
        if orphaned_images > 0:
            issues.append(f"Found {orphaned_images} orphaned images")
        
        # Kontrola chybějících souborů obrázků
        missing_files = 0
        for image in db.query(CoinImage).all():
            if not os.path.exists(image.file_path):
                missing_files += 1
        
        if missing_files > 0:
            issues.append(f"Found {missing_files} missing image files")
        
        db.close()
        
        return {
            "issues_found": len(issues),
            "issues": issues,
            "completed_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Data integrity validation failed: {str(e)}")
        return {"error": str(e)}