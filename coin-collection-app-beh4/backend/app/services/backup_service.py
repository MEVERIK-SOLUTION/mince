import os
import json
import zipfile
import shutil
import tempfile
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import boto3
from botocore.exceptions import ClientError
import asyncio
import aiofiles
from pathlib import Path

from ..models.coin import Coin
from ..models.collection import Collection
from ..models.user import User
from ..models.coin_image import CoinImage
from ..core.config import settings

class BackupService:
    def __init__(self, db: Session):
        self.db = db
        self.backup_dir = Path(settings.BACKUP_DIRECTORY or "/tmp/backups")
        self.backup_dir.mkdir(exist_ok=True)
        
        # AWS S3 konfigurace (pokud je nastavena)
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION or 'eu-central-1'
            )
            self.s3_bucket = settings.S3_BACKUP_BUCKET
        else:
            self.s3_client = None
            self.s3_bucket = None
    
    async def create_full_backup(
        self,
        user_id: int,
        include_images: bool = True,
        compression_level: int = 6
    ) -> Dict[str, Any]:
        """
        Vytvoří kompletní zálohu všech dat uživatele
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"full_backup_{user_id}_{timestamp}"
        backup_path = self.backup_dir / f"{backup_name}.zip"
        
        try:
            # Získání dat uživatele
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError("Uživatel nenalezen")
            
            collections = self.db.query(Collection).filter(Collection.user_id == user_id).all()
            
            backup_data = {
                "backup_info": {
                    "created_at": datetime.now().isoformat(),
                    "backup_type": "full",
                    "user_id": user_id,
                    "version": "1.0",
                    "include_images": include_images
                },
                "user_data": {
                    "id": user.id,
                    "email": user.email,
                    "full_name": user.full_name,
                    "created_at": user.created_at.isoformat(),
                    "preferences": user.preferences or {}
                },
                "collections": [],
                "statistics": {
                    "total_collections": len(collections),
                    "total_coins": 0,
                    "total_images": 0
                }
            }
            
            # Vytvoření dočasného adresáře
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                # Zpracování kolekcí
                for collection in collections:
                    collection_data = await self._backup_collection(
                        collection, temp_path, include_images
                    )
                    backup_data["collections"].append(collection_data)
                    backup_data["statistics"]["total_coins"] += collection_data["coin_count"]
                    backup_data["statistics"]["total_images"] += collection_data["image_count"]
                
                # Uložení metadata
                metadata_path = temp_path / "backup_metadata.json"
                async with aiofiles.open(metadata_path, 'w', encoding='utf-8') as f:
                    await f.write(json.dumps(backup_data, ensure_ascii=False, indent=2))
                
                # Vytvoření ZIP archivu
                await self._create_zip_archive(temp_path, backup_path, compression_level)
            
            # Upload do S3 (pokud je nakonfigurováno)
            s3_url = None
            if self.s3_client and self.s3_bucket:
                s3_url = await self._upload_to_s3(backup_path, f"backups/{backup_name}.zip")
            
            backup_info = {
                "backup_id": backup_name,
                "file_path": str(backup_path),
                "file_size": backup_path.stat().st_size,
                "s3_url": s3_url,
                "created_at": datetime.now().isoformat(),
                "statistics": backup_data["statistics"],
                "include_images": include_images
            }
            
            return backup_info
            
        except Exception as e:
            # Vyčištění při chybě
            if backup_path.exists():
                backup_path.unlink()
            raise e
    
    async def create_collection_backup(
        self,
        collection_id: int,
        include_images: bool = True
    ) -> Dict[str, Any]:
        """
        Vytvoří zálohu konkrétní kolekce
        """
        collection = self.db.query(Collection).filter(Collection.id == collection_id).first()
        if not collection:
            raise ValueError("Kolekce nenalezena")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"collection_backup_{collection_id}_{timestamp}"
        backup_path = self.backup_dir / f"{backup_name}.zip"
        
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                # Záloha kolekce
                collection_data = await self._backup_collection(
                    collection, temp_path, include_images
                )
                
                # Metadata
                backup_metadata = {
                    "backup_info": {
                        "created_at": datetime.now().isoformat(),
                        "backup_type": "collection",
                        "collection_id": collection_id,
                        "version": "1.0",
                        "include_images": include_images
                    },
                    "collection": collection_data
                }
                
                metadata_path = temp_path / "backup_metadata.json"
                async with aiofiles.open(metadata_path, 'w', encoding='utf-8') as f:
                    await f.write(json.dumps(backup_metadata, ensure_ascii=False, indent=2))
                
                # Vytvoření ZIP
                await self._create_zip_archive(temp_path, backup_path)
            
            # Upload do S3
            s3_url = None
            if self.s3_client and self.s3_bucket:
                s3_url = await self._upload_to_s3(backup_path, f"backups/{backup_name}.zip")
            
            return {
                "backup_id": backup_name,
                "collection_id": collection_id,
                "collection_name": collection.name,
                "file_path": str(backup_path),
                "file_size": backup_path.stat().st_size,
                "s3_url": s3_url,
                "created_at": datetime.now().isoformat(),
                "coin_count": collection_data["coin_count"],
                "image_count": collection_data["image_count"],
                "include_images": include_images
            }
            
        except Exception as e:
            if backup_path.exists():
                backup_path.unlink()
            raise e
    
    async def _backup_collection(
        self,
        collection: Collection,
        temp_path: Path,
        include_images: bool
    ) -> Dict[str, Any]:
        """
        Zálohuje data jedné kolekce
        """
        coins = self.db.query(Coin).filter(Coin.collection_id == collection.id).all()
        
        collection_data = {
            "id": collection.id,
            "name": collection.name,
            "description": collection.description,
            "created_at": collection.created_at.isoformat(),
            "updated_at": collection.updated_at.isoformat(),
            "coin_count": len(coins),
            "image_count": 0,
            "coins": []
        }
        
        # Adresář pro obrázky kolekce
        if include_images:
            collection_images_dir = temp_path / "images" / f"collection_{collection.id}"
            collection_images_dir.mkdir(parents=True, exist_ok=True)
        
        # Zpracování mincí
        for coin in coins:
            coin_data = {
                "id": coin.id,
                "name": coin.name,
                "country": coin.country,
                "year": coin.year,
                "denomination": coin.denomination,
                "currency": coin.currency,
                "material": coin.material,
                "weight": coin.weight,
                "diameter": coin.diameter,
                "thickness": coin.thickness,
                "condition": coin.condition,
                "rarity": coin.rarity,
                "current_value": coin.current_value,
                "acquisition_date": coin.acquisition_date.isoformat() if coin.acquisition_date else None,
                "acquisition_price": coin.acquisition_price,
                "acquisition_source": coin.acquisition_source,
                "notes": coin.notes,
                "is_favorite": coin.is_favorite,
                "is_for_sale": coin.is_for_sale,
                "created_at": coin.created_at.isoformat(),
                "updated_at": coin.updated_at.isoformat(),
                "images": [],
                "tags": [tag.name for tag in coin.tags] if coin.tags else []
            }
            
            # Zpracování obrázků mince
            if include_images:
                coin_images = self.db.query(CoinImage).filter(CoinImage.coin_id == coin.id).all()
                
                for image in coin_images:
                    try:
                        # Kopírování obrázku
                        source_path = Path(image.file_path)
                        if source_path.exists():
                            image_filename = f"coin_{coin.id}_{image.id}_{source_path.name}"
                            dest_path = collection_images_dir / image_filename
                            
                            shutil.copy2(source_path, dest_path)
                            
                            coin_data["images"].append({
                                "id": image.id,
                                "filename": image_filename,
                                "original_filename": image.filename,
                                "file_size": image.file_size,
                                "image_type": image.image_type,
                                "is_primary": image.is_primary,
                                "description": image.description,
                                "created_at": image.created_at.isoformat()
                            })
                            
                            collection_data["image_count"] += 1
                    except Exception as e:
                        print(f"Chyba při kopírování obrázku {image.id}: {e}")
            
            collection_data["coins"].append(coin_data)
        
        return collection_data
    
    async def _create_zip_archive(
        self,
        source_dir: Path,
        output_path: Path,
        compression_level: int = 6
    ):
        """
        Vytvoří ZIP archiv z adresáře
        """
        with zipfile.ZipFile(
            output_path, 
            'w', 
            zipfile.ZIP_DEFLATED, 
            compresslevel=compression_level
        ) as zipf:
            for file_path in source_dir.rglob('*'):
                if file_path.is_file():
                    arcname = file_path.relative_to(source_dir)
                    zipf.write(file_path, arcname)
    
    async def _upload_to_s3(self, file_path: Path, s3_key: str) -> Optional[str]:
        """
        Nahraje soubor do S3
        """
        if not self.s3_client or not self.s3_bucket:
            return None
        
        try:
            self.s3_client.upload_file(
                str(file_path),
                self.s3_bucket,
                s3_key,
                ExtraArgs={
                    'ServerSideEncryption': 'AES256',
                    'StorageClass': 'STANDARD_IA'  # Infrequent Access pro zálohy
                }
            )
            
            return f"s3://{self.s3_bucket}/{s3_key}"
            
        except ClientError as e:
            print(f"Chyba při uploadu do S3: {e}")
            return None
    
    async def restore_from_backup(
        self,
        backup_file_path: str,
        user_id: int,
        restore_options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Obnoví data ze zálohy
        """
        backup_path = Path(backup_file_path)
        if not backup_path.exists():
            raise ValueError("Záložní soubor nenalezen")
        
        restore_strategy = restore_options.get("strategy", "merge")  # merge, replace, new_collection
        restore_images = restore_options.get("restore_images", True)
        collection_name_suffix = restore_options.get("collection_name_suffix", "_restored")
        
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                # Rozbalení ZIP archivu
                with zipfile.ZipFile(backup_path, 'r') as zipf:
                    zipf.extractall(temp_path)
                
                # Načtení metadat
                metadata_path = temp_path / "backup_metadata.json"
                if not metadata_path.exists():
                    raise ValueError("Neplatný formát zálohy - chybí metadata")
                
                async with aiofiles.open(metadata_path, 'r', encoding='utf-8') as f:
                    backup_metadata = json.loads(await f.read())
                
                backup_type = backup_metadata["backup_info"]["backup_type"]
                
                if backup_type == "full":
                    return await self._restore_full_backup(
                        backup_metadata, temp_path, user_id, restore_options
                    )
                elif backup_type == "collection":
                    return await self._restore_collection_backup(
                        backup_metadata, temp_path, user_id, restore_options
                    )
                else:
                    raise ValueError(f"Nepodporovaný typ zálohy: {backup_type}")
                    
        except Exception as e:
            raise e
    
    async def _restore_full_backup(
        self,
        backup_metadata: Dict[str, Any],
        temp_path: Path,
        user_id: int,
        restore_options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Obnoví kompletní zálohu uživatele
        """
        restore_strategy = restore_options.get("strategy", "merge")
        restored_collections = []
        restored_coins = 0
        restored_images = 0
        
        for collection_data in backup_metadata["collections"]:
            try:
                result = await self._restore_collection_data(
                    collection_data, temp_path, user_id, restore_options
                )
                restored_collections.append(result)
                restored_coins += result["restored_coins"]
                restored_images += result["restored_images"]
                
            except Exception as e:
                print(f"Chyba při obnovení kolekce {collection_data['name']}: {e}")
        
        return {
            "restore_type": "full",
            "restored_collections": len(restored_collections),
            "restored_coins": restored_coins,
            "restored_images": restored_images,
            "collections": restored_collections,
            "restored_at": datetime.now().isoformat()
        }
    
    async def _restore_collection_backup(
        self,
        backup_metadata: Dict[str, Any],
        temp_path: Path,
        user_id: int,
        restore_options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Obnoví zálohu kolekce
        """
        collection_data = backup_metadata["collection"]
        
        result = await self._restore_collection_data(
            collection_data, temp_path, user_id, restore_options
        )
        
        return {
            "restore_type": "collection",
            "collection": result,
            "restored_at": datetime.now().isoformat()
        }
    
    async def _restore_collection_data(
        self,
        collection_data: Dict[str, Any],
        temp_path: Path,
        user_id: int,
        restore_options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Obnoví data jedné kolekce
        """
        restore_strategy = restore_options.get("strategy", "merge")
        restore_images = restore_options.get("restore_images", True)
        collection_name_suffix = restore_options.get("collection_name_suffix", "_restored")
        
        # Najít nebo vytvořit kolekci
        if restore_strategy == "replace":
            # Najít existující kolekci podle názvu
            existing_collection = self.db.query(Collection).filter(
                and_(
                    Collection.user_id == user_id,
                    Collection.name == collection_data["name"]
                )
            ).first()
            
            if existing_collection:
                # Smazat existující mince
                self.db.query(Coin).filter(Coin.collection_id == existing_collection.id).delete()
                collection = existing_collection
            else:
                # Vytvořit novou kolekci
                collection = Collection(
                    user_id=user_id,
                    name=collection_data["name"],
                    description=collection_data["description"]
                )
                self.db.add(collection)
        
        elif restore_strategy == "new_collection":
            # Vždy vytvořit novou kolekci
            collection = Collection(
                user_id=user_id,
                name=collection_data["name"] + collection_name_suffix,
                description=collection_data["description"]
            )
            self.db.add(collection)
        
        else:  # merge
            # Najít existující nebo vytvořit novou
            existing_collection = self.db.query(Collection).filter(
                and_(
                    Collection.user_id == user_id,
                    Collection.name == collection_data["name"]
                )
            ).first()
            
            if existing_collection:
                collection = existing_collection
            else:
                collection = Collection(
                    user_id=user_id,
                    name=collection_data["name"],
                    description=collection_data["description"]
                )
                self.db.add(collection)
        
        self.db.flush()  # Získat ID kolekce
        
        restored_coins = 0
        restored_images = 0
        
        # Obnovení mincí
        for coin_data in collection_data["coins"]:
            try:
                # Kontrola duplicit při merge strategii
                if restore_strategy == "merge":
                    existing_coin = self.db.query(Coin).filter(
                        and_(
                            Coin.collection_id == collection.id,
                            Coin.name == coin_data["name"],
                            Coin.country == coin_data["country"],
                            Coin.year == coin_data["year"]
                        )
                    ).first()
                    
                    if existing_coin:
                        continue  # Přeskočit duplicitní minci
                
                # Vytvoření nové mince
                coin = Coin(
                    collection_id=collection.id,
                    name=coin_data["name"],
                    country=coin_data["country"],
                    year=coin_data["year"],
                    denomination=coin_data.get("denomination"),
                    currency=coin_data.get("currency"),
                    material=coin_data.get("material"),
                    weight=coin_data.get("weight"),
                    diameter=coin_data.get("diameter"),
                    thickness=coin_data.get("thickness"),
                    condition=coin_data.get("condition"),
                    rarity=coin_data.get("rarity"),
                    current_value=coin_data.get("current_value"),
                    acquisition_date=datetime.fromisoformat(coin_data["acquisition_date"]) if coin_data.get("acquisition_date") else None,
                    acquisition_price=coin_data.get("acquisition_price"),
                    acquisition_source=coin_data.get("acquisition_source"),
                    notes=coin_data.get("notes"),
                    is_favorite=coin_data.get("is_favorite", False),
                    is_for_sale=coin_data.get("is_for_sale", False)
                )
                
                self.db.add(coin)
                self.db.flush()  # Získat ID mince
                
                restored_coins += 1
                
                # Obnovení obrázků
                if restore_images and coin_data.get("images"):
                    images_dir = temp_path / "images" / f"collection_{collection_data['id']}"
                    
                    for image_data in coin_data["images"]:
                        try:
                            source_path = images_dir / image_data["filename"]
                            if source_path.exists():
                                # Vytvoření cílového adresáře
                                target_dir = Path(settings.UPLOAD_DIRECTORY) / "coins" / str(coin.id)
                                target_dir.mkdir(parents=True, exist_ok=True)
                                
                                # Kopírování obrázku
                                target_path = target_dir / image_data["original_filename"]
                                shutil.copy2(source_path, target_path)
                                
                                # Vytvoření záznamu v DB
                                coin_image = CoinImage(
                                    coin_id=coin.id,
                                    filename=image_data["original_filename"],
                                    file_path=str(target_path),
                                    file_size=image_data["file_size"],
                                    image_type=image_data["image_type"],
                                    is_primary=image_data["is_primary"],
                                    description=image_data.get("description")
                                )
                                
                                self.db.add(coin_image)
                                restored_images += 1
                                
                        except Exception as e:
                            print(f"Chyba při obnovení obrázku: {e}")
                
            except Exception as e:
                print(f"Chyba při obnovení mince {coin_data['name']}: {e}")
        
        self.db.commit()
        
        return {
            "collection_id": collection.id,
            "collection_name": collection.name,
            "restored_coins": restored_coins,
            "restored_images": restored_images,
            "strategy_used": restore_strategy
        }
    
    def list_backups(
        self,
        user_id: Optional[int] = None,
        backup_type: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Vypíše dostupné zálohy
        """
        backups = []
        
        # Lokální zálohy
        for backup_file in self.backup_dir.glob("*.zip"):
            try:
                # Parsování názvu souboru
                name_parts = backup_file.stem.split("_")
                if len(name_parts) >= 3:
                    file_user_id = int(name_parts[2])
                    file_backup_type = name_parts[0] + "_" + name_parts[1]  # full_backup nebo collection_backup
                    
                    if user_id and file_user_id != user_id:
                        continue
                    
                    if backup_type and file_backup_type != backup_type:
                        continue
                    
                    stat = backup_file.stat()
                    backups.append({
                        "backup_id": backup_file.stem,
                        "file_path": str(backup_file),
                        "file_size": stat.st_size,
                        "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        "backup_type": file_backup_type,
                        "user_id": file_user_id,
                        "storage_type": "local"
                    })
                    
            except (ValueError, IndexError):
                continue
        
        # Seřazení podle data vytvoření (nejnovější první)
        backups.sort(key=lambda x: x["created_at"], reverse=True)
        
        return backups[:limit]
    
    def delete_backup(self, backup_id: str) -> bool:
        """
        Smaže zálohu
        """
        backup_path = self.backup_dir / f"{backup_id}.zip"
        
        if backup_path.exists():
            backup_path.unlink()
            return True
        
        return False
    
    def cleanup_old_backups(
        self,
        retention_days: int = 30,
        keep_minimum: int = 5
    ) -> Dict[str, Any]:
        """
        Vyčistí staré zálohy
        """
        cutoff_date = datetime.now() - timedelta(days=retention_days)
        deleted_count = 0
        deleted_size = 0
        
        backups = self.list_backups()
        
        # Seřazení podle data (nejstarší první)
        backups.sort(key=lambda x: x["created_at"])
        
        # Ponechat minimální počet záloh
        if len(backups) <= keep_minimum:
            return {
                "deleted_count": 0,
                "deleted_size": 0,
                "message": f"Ponecháno {len(backups)} záloh (minimum: {keep_minimum})"
            }
        
        # Smazání starých záloh
        for backup in backups[:-keep_minimum]:  # Ponechat posledních N záloh
            backup_date = datetime.fromisoformat(backup["created_at"])
            
            if backup_date < cutoff_date:
                backup_path = Path(backup["file_path"])
                if backup_path.exists():
                    deleted_size += backup["file_size"]
                    backup_path.unlink()
                    deleted_count += 1
        
        return {
            "deleted_count": deleted_count,
            "deleted_size": deleted_size,
            "retention_days": retention_days,
            "kept_minimum": keep_minimum
        }
    
    async def verify_backup_integrity(self, backup_file_path: str) -> Dict[str, Any]:
        """
        Ověří integritu zálohy
        """
        backup_path = Path(backup_file_path)
        if not backup_path.exists():
            return {
                "valid": False,
                "error": "Záložní soubor nenalezen"
            }
        
        try:
            with zipfile.ZipFile(backup_path, 'r') as zipf:
                # Test integrity ZIP archivu
                bad_files = zipf.testzip()
                if bad_files:
                    return {
                        "valid": False,
                        "error": f"Poškozené soubory v archivu: {bad_files}"
                    }
                
                # Kontrola existence metadat
                file_list = zipf.namelist()
                if "backup_metadata.json" not in file_list:
                    return {
                        "valid": False,
                        "error": "Chybí metadata zálohy"
                    }
                
                # Načtení a validace metadat
                with zipf.open("backup_metadata.json") as f:
                    metadata = json.loads(f.read().decode('utf-8'))
                
                required_fields = ["backup_info", "backup_info.created_at", "backup_info.backup_type"]
                for field in required_fields:
                    keys = field.split(".")
                    current = metadata
                    for key in keys:
                        if key not in current:
                            return {
                                "valid": False,
                                "error": f"Chybí povinné pole: {field}"
                            }
                        current = current[key]
                
                # Kontrola konzistence dat
                backup_type = metadata["backup_info"]["backup_type"]
                
                if backup_type == "full":
                    if "collections" not in metadata:
                        return {
                            "valid": False,
                            "error": "Chybí data kolekcí v plné záloze"
                        }
                elif backup_type == "collection":
                    if "collection" not in metadata:
                        return {
                            "valid": False,
                            "error": "Chybí data kolekce"
                        }
                
                return {
                    "valid": True,
                    "backup_type": backup_type,
                    "created_at": metadata["backup_info"]["created_at"],
                    "file_count": len(file_list),
                    "compressed_size": backup_path.stat().st_size
                }
                
        except zipfile.BadZipFile:
            return {
                "valid": False,
                "error": "Neplatný ZIP archiv"
            }
        except json.JSONDecodeError:
            return {
                "valid": False,
                "error": "Neplatná metadata (JSON)"
            }
        except Exception as e:
            return {
                "valid": False,
                "error": f"Neočekávaná chyba: {str(e)}"
            }