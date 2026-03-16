import asyncio
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import os
import json
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session

from .coin_identification import coin_identification_service
from .auto_fill_service import auto_fill_service
from .price_service import price_service
from ..models.coin import Coin
from ..core.config import settings

logger = logging.getLogger(__name__)

class BatchIdentificationService:
    """
    Služba pro dávkovou identifikaci více mincí současně
    """
    
    def __init__(self):
        self.max_concurrent_identifications = 5
        self.max_batch_size = 50
        self.progress_callbacks = {}
        
        # Konfigurace pro batch zpracování
        self.batch_config = {
            'chunk_size': 10,           # Počet mincí zpracovávaných současně
            'timeout_per_coin': 30,     # Timeout pro jednu minci (sekundy)
            'retry_failed': True,       # Opakovat neúspěšné identifikace
            'max_retries': 2,           # Maximální počet opakování
            'save_intermediate': True,   # Ukládat mezivýsledky
            'auto_fill_forms': True,    # Automatické předvyplnění formulářů
            'estimate_prices': True     # Odhad cen
        }
        
        # Statistiky batch operací
        self.batch_stats = {
            'total_batches': 0,
            'successful_identifications': 0,
            'failed_identifications': 0,
            'average_processing_time': 0.0,
            'last_batch_time': None
        }
    
    async def batch_identify_coins(
        self, 
        image_paths: List[str], 
        batch_id: str,
        db: Session = None,
        progress_callback: Optional[callable] = None
    ) -> Dict:
        """
        Dávková identifikace mincí z více obrázků
        """
        try:
            if len(image_paths) > self.max_batch_size:
                return {
                    'success': False,
                    'error': f'Maximální velikost dávky je {self.max_batch_size} obrázků'
                }
            
            start_time = datetime.utcnow()
            
            # Registrace progress callback
            if progress_callback:
                self.progress_callbacks[batch_id] = progress_callback
            
            # Inicializace výsledků
            results = {
                'batch_id': batch_id,
                'total_images': len(image_paths),
                'processed': 0,
                'successful': 0,
                'failed': 0,
                'results': [],
                'errors': [],
                'start_time': start_time.isoformat(),
                'processing_time': 0
            }
            
            # Rozdělení do chunků pro paralelní zpracování
            chunks = self._create_chunks(image_paths, self.batch_config['chunk_size'])
            
            # Zpracování chunků
            for chunk_index, chunk in enumerate(chunks):
                chunk_results = await self._process_chunk(
                    chunk, 
                    chunk_index, 
                    batch_id,
                    db
                )
                
                # Aktualizace výsledků
                results['processed'] += len(chunk)
                results['successful'] += chunk_results['successful']
                results['failed'] += chunk_results['failed']
                results['results'].extend(chunk_results['results'])
                results['errors'].extend(chunk_results['errors'])
                
                # Progress callback
                if progress_callback:
                    progress = {
                        'batch_id': batch_id,
                        'processed': results['processed'],
                        'total': results['total_images'],
                        'progress_percent': (results['processed'] / results['total_images']) * 100,
                        'current_chunk': chunk_index + 1,
                        'total_chunks': len(chunks)
                    }
                    await self._call_progress_callback(batch_id, progress)
            
            # Finalizace
            end_time = datetime.utcnow()
            processing_time = (end_time - start_time).total_seconds()
            
            results.update({
                'end_time': end_time.isoformat(),
                'processing_time': processing_time,
                'success': True,
                'success_rate': (results['successful'] / results['total_images']) * 100 if results['total_images'] > 0 else 0
            })
            
            # Aktualizace statistik
            self._update_batch_stats(results)
            
            # Uložení výsledků
            if self.batch_config['save_intermediate']:
                await self._save_batch_results(batch_id, results)
            
            # Vyčištění progress callback
            if batch_id in self.progress_callbacks:
                del self.progress_callbacks[batch_id]
            
            return results
            
        except Exception as e:
            logger.error(f"Batch identification failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'batch_id': batch_id
            }
    
    async def _process_chunk(
        self, 
        image_paths: List[str], 
        chunk_index: int, 
        batch_id: str,
        db: Session
    ) -> Dict:
        """
        Zpracování jednoho chunku obrázků
        """
        chunk_results = {
            'successful': 0,
            'failed': 0,
            'results': [],
            'errors': []
        }
        
        # Semafora pro omezení současných identifikací
        semaphore = asyncio.Semaphore(self.max_concurrent_identifications)
        
        async def process_single_image(image_path: str, image_index: int):
            async with semaphore:
                try:
                    # Identifikace mince
                    identification_result = await self._identify_single_coin(
                        image_path, 
                        f"{batch_id}_chunk{chunk_index}_img{image_index}"
                    )
                    
                    if identification_result['success']:
                        # Automatické předvyplnění formuláře
                        form_data = {}
                        if self.batch_config['auto_fill_forms']:
                            form_result = await auto_fill_service.analyze_and_fill_form(
                                image_paths=[image_path],
                                user_input={},
                                db=db
                            )
                            
                            if form_result.get('success'):
                                form_data = form_result.get('form_data', {})
                        
                        # Odhad ceny
                        price_data = {}
                        if self.batch_config['estimate_prices'] and form_data:
                            temp_coin = auto_fill_service._create_temp_coin(form_data)
                            async with price_service as pricer:
                                price_estimate = await pricer.estimate_coin_value(temp_coin, db)
                                if price_estimate.get('success'):
                                    price_data = price_estimate
                        
                        result = {
                            'image_path': image_path,
                            'image_index': image_index,
                            'identification': identification_result,
                            'form_data': form_data,
                            'price_estimate': price_data,
                            'processing_time': identification_result.get('processing_time', 0)
                        }
                        
                        chunk_results['results'].append(result)
                        chunk_results['successful'] += 1
                        
                    else:
                        chunk_results['failed'] += 1
                        chunk_results['errors'].append({
                            'image_path': image_path,
                            'image_index': image_index,
                            'error': identification_result.get('error', 'Neznámá chyba')
                        })
                
                except Exception as e:
                    chunk_results['failed'] += 1
                    chunk_results['errors'].append({
                        'image_path': image_path,
                        'image_index': image_index,
                        'error': str(e)
                    })
                    logger.error(f"Failed to process image {image_path}: {str(e)}")
        
        # Paralelní zpracování obrázků v chunku
        tasks = [
            process_single_image(image_path, chunk_index * self.batch_config['chunk_size'] + i)
            for i, image_path in enumerate(image_paths)
        ]
        
        await asyncio.gather(*tasks, return_exceptions=True)
        
        return chunk_results
    
    async def _identify_single_coin(self, image_path: str, coin_id: str) -> Dict:
        """
        Identifikace jedné mince s timeout a retry logikou
        """
        max_retries = self.batch_config['max_retries'] if self.batch_config['retry_failed'] else 1
        
        for attempt in range(max_retries):
            try:
                # Timeout pro identifikaci
                identification_task = coin_identification_service.identify_coin(image_path)
                result = await asyncio.wait_for(
                    identification_task, 
                    timeout=self.batch_config['timeout_per_coin']
                )
                
                if result.get('success'):
                    return result
                
                # Pokud neúspěšné a máme další pokusy
                if attempt < max_retries - 1:
                    logger.warning(f"Identification attempt {attempt + 1} failed for {image_path}, retrying...")
                    await asyncio.sleep(1)  # Krátká pauza před opakováním
                
            except asyncio.TimeoutError:
                logger.warning(f"Identification timeout for {image_path} (attempt {attempt + 1})")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2)  # Delší pauza po timeoutu
            
            except Exception as e:
                logger.error(f"Identification error for {image_path} (attempt {attempt + 1}): {str(e)}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(1)
        
        return {
            'success': False,
            'error': f'Identifikace selhala po {max_retries} pokusech'
        }
    
    def _create_chunks(self, items: List, chunk_size: int) -> List[List]:
        """
        Rozdělení seznamu do chunků
        """
        return [items[i:i + chunk_size] for i in range(0, len(items), chunk_size)]
    
    async def _call_progress_callback(self, batch_id: str, progress: Dict):
        """
        Volání progress callback
        """
        try:
            if batch_id in self.progress_callbacks:
                callback = self.progress_callbacks[batch_id]
                if asyncio.iscoroutinefunction(callback):
                    await callback(progress)
                else:
                    callback(progress)
        except Exception as e:
            logger.warning(f"Progress callback failed: {str(e)}")
    
    def _update_batch_stats(self, results: Dict):
        """
        Aktualizace statistik batch operací
        """
        try:
            self.batch_stats['total_batches'] += 1
            self.batch_stats['successful_identifications'] += results['successful']
            self.batch_stats['failed_identifications'] += results['failed']
            
            # Průměrný čas zpracování
            total_time = self.batch_stats['average_processing_time'] * (self.batch_stats['total_batches'] - 1)
            total_time += results['processing_time']
            self.batch_stats['average_processing_time'] = total_time / self.batch_stats['total_batches']
            
            self.batch_stats['last_batch_time'] = datetime.utcnow()
            
        except Exception as e:
            logger.warning(f"Failed to update batch stats: {str(e)}")
    
    async def _save_batch_results(self, batch_id: str, results: Dict):
        """
        Uložení výsledků batch operace
        """
        try:
            results_dir = "batch_results"
            os.makedirs(results_dir, exist_ok=True)
            
            filename = f"{batch_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            filepath = os.path.join(results_dir, filename)
            
            # Příprava dat pro JSON (odstranění non-serializable objektů)
            serializable_results = self._make_json_serializable(results)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(serializable_results, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Batch results saved to {filepath}")
            
        except Exception as e:
            logger.error(f"Failed to save batch results: {str(e)}")
    
    def _make_json_serializable(self, obj):
        """
        Převod objektu na JSON serializable formát
        """
        if isinstance(obj, dict):
            return {key: self._make_json_serializable(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._make_json_serializable(item) for item in obj]
        elif isinstance(obj, datetime):
            return obj.isoformat()
        elif hasattr(obj, '__dict__'):
            return self._make_json_serializable(obj.__dict__)
        else:
            return obj
    
    async def get_batch_status(self, batch_id: str) -> Dict:
        """
        Získání stavu batch operace
        """
        try:
            # Pokus o načtení uložených výsledků
            results_dir = "batch_results"
            if os.path.exists(results_dir):
                for filename in os.listdir(results_dir):
                    if filename.startswith(batch_id):
                        filepath = os.path.join(results_dir, filename)
                        with open(filepath, 'r', encoding='utf-8') as f:
                            return json.load(f)
            
            # Pokud není uloženo, zkontroluj aktivní operace
            if batch_id in self.progress_callbacks:
                return {
                    'batch_id': batch_id,
                    'status': 'processing',
                    'message': 'Batch operace probíhá'
                }
            
            return {
                'batch_id': batch_id,
                'status': 'not_found',
                'message': 'Batch operace nenalezena'
            }
            
        except Exception as e:
            logger.error(f"Failed to get batch status: {str(e)}")
            return {
                'batch_id': batch_id,
                'status': 'error',
                'error': str(e)
            }
    
    async def cancel_batch(self, batch_id: str) -> Dict:
        """
        Zrušení batch operace
        """
        try:
            if batch_id in self.progress_callbacks:
                del self.progress_callbacks[batch_id]
                return {
                    'success': True,
                    'message': f'Batch operace {batch_id} byla zrušena'
                }
            else:
                return {
                    'success': False,
                    'message': f'Batch operace {batch_id} není aktivní'
                }
                
        except Exception as e:
            logger.error(f"Failed to cancel batch: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_batch_statistics(self) -> Dict:
        """
        Získání statistik batch operací
        """
        return {
            'success': True,
            'statistics': self.batch_stats.copy(),
            'configuration': self.batch_config.copy(),
            'active_batches': len(self.progress_callbacks)
        }
    
    def update_batch_config(self, new_config: Dict):
        """
        Aktualizace konfigurace batch zpracování
        """
        try:
            for key, value in new_config.items():
                if key in self.batch_config:
                    self.batch_config[key] = value
            
            logger.info(f"Batch config updated: {new_config}")
            
        except Exception as e:
            logger.error(f"Failed to update batch config: {str(e)}")
    
    async def batch_identify_from_directory(
        self, 
        directory_path: str, 
        batch_id: str,
        file_extensions: List[str] = None,
        db: Session = None,
        progress_callback: Optional[callable] = None
    ) -> Dict:
        """
        Dávková identifikace všech obrázků ze složky
        """
        try:
            if not os.path.exists(directory_path):
                return {
                    'success': False,
                    'error': 'Složka neexistuje'
                }
            
            # Výchozí přípony obrázků
            if file_extensions is None:
                file_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp']
            
            # Získání všech obrázků ze složky
            image_paths = []
            for filename in os.listdir(directory_path):
                if any(filename.lower().endswith(ext) for ext in file_extensions):
                    image_paths.append(os.path.join(directory_path, filename))
            
            if not image_paths:
                return {
                    'success': False,
                    'error': 'Ve složce nebyly nalezeny žádné obrázky'
                }
            
            # Spuštění batch identifikace
            return await self.batch_identify_coins(
                image_paths=image_paths,
                batch_id=batch_id,
                db=db,
                progress_callback=progress_callback
            )
            
        except Exception as e:
            logger.error(f"Directory batch identification failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

# Singleton instance
batch_identification_service = BatchIdentificationService()