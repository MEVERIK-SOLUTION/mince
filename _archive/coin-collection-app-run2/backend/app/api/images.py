from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
import logging
from PIL import Image
import aiofiles

from ..core.database import get_db
from ..core.config import settings
from ..models.coin import Coin, CoinImage
from ..schemas.image import ImageResponse, ImageUploadResponse

router = APIRouter()
logger = logging.getLogger(__name__)


def validate_image_file(file: UploadFile) -> bool:
    """Validace nahrávaného obrázku"""
    # Kontrola typu souboru
    if file.content_type not in settings.allowed_image_types:
        return False
    
    # Kontrola velikosti (bude kontrolována při čtení)
    return True


def generate_filename(original_filename: str, coin_id: int, image_type: str) -> str:
    """Generování unikátního názvu souboru"""
    # Získání přípony
    file_extension = os.path.splitext(original_filename)[1].lower()
    if not file_extension:
        file_extension = '.jpg'
    
    # Generování unikátního ID
    unique_id = str(uuid.uuid4())[:8]
    
    # Formát: coin_{coin_id}_{image_type}_{unique_id}.ext
    return f"coin_{coin_id}_{image_type}_{unique_id}{file_extension}"


async def process_and_save_image(
    file: UploadFile, 
    coin_id: int, 
    image_type: str
) -> dict:
    """Zpracování a uložení obrázku"""
    try:
        # Čtení souboru
        content = await file.read()
        
        # Kontrola velikosti
        if len(content) > settings.max_file_size:
            raise HTTPException(
                status_code=413, 
                detail=f"Soubor je příliš velký. Maximum: {settings.max_file_size / 1024 / 1024:.1f}MB"
            )
        
        # Generování názvu souboru
        filename = generate_filename(file.filename, coin_id, image_type)
        file_path = os.path.join(settings.upload_dir, "coins", filename)
        
        # Uložení původního souboru
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)
        
        # Zpracování obrázku pomocí PIL
        try:
            with Image.open(file_path) as img:
                # Získání rozměrů
                width, height = img.size
                
                # Rotace podle EXIF dat
                img = fix_image_orientation(img)
                
                # Optimalizace velikosti (max 1200px na delší straně)
                if max(width, height) > 1200:
                    img.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
                    width, height = img.size
                
                # Uložení optimalizovaného obrázku
                img.save(file_path, 'JPEG', quality=85, optimize=True)
                
        except Exception as e:
            logger.warning(f"Image processing failed for {file_path}: {e}")
            # Pokud zpracování selže, ponecháme původní soubor
            pass
        
        # Získání finální velikosti souboru
        file_size = os.path.getsize(file_path)
        
        return {
            "file_path": file_path,
            "filename": filename,
            "file_size": file_size,
            "width": width,
            "height": height
        }
        
    except Exception as e:
        # Vyčištění při chybě
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        raise e


def fix_image_orientation(img: Image.Image) -> Image.Image:
    """Oprava orientace obrázku podle EXIF dat"""
    try:
        from PIL.ExifTags import ORIENTATION
        
        exif = img._getexif()
        if exif is not None:
            orientation = exif.get(ORIENTATION)
            if orientation == 3:
                img = img.rotate(180, expand=True)
            elif orientation == 6:
                img = img.rotate(270, expand=True)
            elif orientation == 8:
                img = img.rotate(90, expand=True)
    except Exception:
        # Pokud EXIF data nejsou dostupná, ignorujeme
        pass
    
    return img


@router.post("/upload/{coin_id}", response_model=ImageUploadResponse)
async def upload_coin_image(
    coin_id: int,
    file: UploadFile = File(...),
    image_type: str = Form(..., description="Typ obrázku: obverse, reverse, edge, detail"),
    is_primary: bool = Form(False, description="Nastavit jako hlavní obrázek"),
    db: Session = Depends(get_db)
):
    """
    Nahrání obrázku mince
    """
    try:
        # Kontrola existence mince
        coin = db.query(Coin).filter(Coin.id == coin_id).first()
        if not coin:
            raise HTTPException(status_code=404, detail="Mince nenalezena")
        
        # Validace souboru
        if not validate_image_file(file):
            raise HTTPException(
                status_code=400, 
                detail="Nepodporovaný typ souboru. Povolené: JPEG, PNG, WebP"
            )
        
        # Validace typu obrázku
        allowed_types = ["obverse", "reverse", "edge", "detail"]
        if image_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Neplatný typ obrázku. Povolené: {', '.join(allowed_types)}"
            )
        
        # Zpracování a uložení obrázku
        image_data = await process_and_save_image(file, coin_id, image_type)
        
        # Pokud je nastaveno jako primary, zrušit primary u ostatních
        if is_primary:
            db.query(CoinImage).filter(CoinImage.coin_id == coin_id).update(
                {"is_primary": False}
            )
        
        # Vytvoření záznamu v databázi
        db_image = CoinImage(
            coin_id=coin_id,
            image_type=image_type,
            file_path=image_data["file_path"],
            file_size=image_data["file_size"],
            width=image_data["width"],
            height=image_data["height"],
            is_primary=is_primary
        )
        
        db.add(db_image)
        db.commit()
        db.refresh(db_image)
        
        return ImageUploadResponse(
            id=db_image.id,
            coin_id=db_image.coin_id,
            image_type=db_image.image_type,
            file_path=db_image.file_path,
            file_size=db_image.file_size,
            width=db_image.width,
            height=db_image.height,
            is_primary=db_image.is_primary,
            uploaded_at=db_image.uploaded_at,
            message="Obrázek byl úspěšně nahrán"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading image for coin {coin_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Chyba při nahrávání obrázku")


@router.get("/coin/{coin_id}", response_model=List[ImageResponse])
async def get_coin_images(coin_id: int, db: Session = Depends(get_db)):
    """
    Získání všech obrázků pro konkrétní minci
    """
    try:
        # Kontrola existence mince
        coin = db.query(Coin).filter(Coin.id == coin_id).first()
        if not coin:
            raise HTTPException(status_code=404, detail="Mince nenalezena")
        
        # Načtení obrázků
        images = db.query(CoinImage).filter(
            CoinImage.coin_id == coin_id
        ).order_by(CoinImage.is_primary.desc(), CoinImage.uploaded_at).all()
        
        return [
            ImageResponse(
                id=img.id,
                coin_id=img.coin_id,
                image_type=img.image_type,
                file_path=img.file_path,
                file_size=img.file_size,
                width=img.width,
                height=img.height,
                is_primary=img.is_primary,
                uploaded_at=img.uploaded_at
            )
            for img in images
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting images for coin {coin_id}: {e}")
        raise HTTPException(status_code=500, detail="Chyba při načítání obrázků")


@router.put("/{image_id}/primary")
async def set_primary_image(image_id: int, db: Session = Depends(get_db)):
    """
    Nastavení obrázku jako hlavního
    """
    try:
        # Najít obrázek
        image = db.query(CoinImage).filter(CoinImage.id == image_id).first()
        if not image:
            raise HTTPException(status_code=404, detail="Obrázek nenalezen")
        
        # Zrušit primary u všech obrázků této mince
        db.query(CoinImage).filter(CoinImage.coin_id == image.coin_id).update(
            {"is_primary": False}
        )
        
        # Nastavit jako primary
        image.is_primary = True
        db.commit()
        
        return {"message": "Obrázek byl nastaven jako hlavní"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting primary image {image_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Chyba při nastavování hlavního obrázku")


@router.delete("/{image_id}")
async def delete_image(image_id: int, db: Session = Depends(get_db)):
    """
    Smazání obrázku
    """
    try:
        # Najít obrázek
        image = db.query(CoinImage).filter(CoinImage.id == image_id).first()
        if not image:
            raise HTTPException(status_code=404, detail="Obrázek nenalezen")
        
        # Smazání fyzického souboru
        try:
            if os.path.exists(image.file_path):
                os.remove(image.file_path)
        except Exception as e:
            logger.warning(f"Failed to delete image file {image.file_path}: {e}")
        
        # Smazání z databáze
        db.delete(image)
        db.commit()
        
        return {"message": "Obrázek byl úspěšně smazán"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting image {image_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Chyba při mazání obrázku")


@router.post("/bulk-upload/{coin_id}")
async def bulk_upload_images(
    coin_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """
    Hromadné nahrání obrázků pro minci
    """
    try:
        # Kontrola existence mince
        coin = db.query(Coin).filter(Coin.id == coin_id).first()
        if not coin:
            raise HTTPException(status_code=404, detail="Mince nenalezena")
        
        # Omezení počtu souborů
        if len(files) > 10:
            raise HTTPException(
                status_code=400, 
                detail="Maximální počet souborů najednou je 10"
            )
        
        uploaded_images = []
        errors = []
        
        # Automatické přiřazení typů obrázků
        type_mapping = ["obverse", "reverse", "edge", "detail"]
        
        for i, file in enumerate(files):
            try:
                # Validace souboru
                if not validate_image_file(file):
                    errors.append(f"{file.filename}: Nepodporovaný typ souboru")
                    continue
                
                # Určení typu obrázku
                image_type = type_mapping[i] if i < len(type_mapping) else "detail"
                
                # Zpracování a uložení
                image_data = await process_and_save_image(file, coin_id, image_type)
                
                # Vytvoření záznamu v databázi
                db_image = CoinImage(
                    coin_id=coin_id,
                    image_type=image_type,
                    file_path=image_data["file_path"],
                    file_size=image_data["file_size"],
                    width=image_data["width"],
                    height=image_data["height"],
                    is_primary=(i == 0)  # První obrázek jako primary
                )
                
                db.add(db_image)
                uploaded_images.append({
                    "filename": file.filename,
                    "type": image_type,
                    "size": image_data["file_size"]
                })
                
            except Exception as e:
                errors.append(f"{file.filename}: {str(e)}")
        
        db.commit()
        
        return {
            "message": f"Nahráno {len(uploaded_images)} obrázků",
            "uploaded": uploaded_images,
            "errors": errors
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk uploading images for coin {coin_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Chyba při hromadném nahrávání obrázků")