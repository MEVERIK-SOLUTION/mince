import asyncio
import aiohttp
import logging
from typing import Dict, List, Optional, Tuple
from PIL import Image
import io
import base64
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.coin import Coin
from ..schemas.coin import CoinCreate

logger = logging.getLogger(__name__)

class CoinIdentificationService:
    """
    Služba pro AI identifikaci mincí pomocí CoinScan API a dalších služeb
    """
    
    def __init__(self):
        self.coinscan_api_key = getattr(settings, 'COINSCAN_API_KEY', None)
        self.coinscan_base_url = "https://api.coinscan.ai/v1"
        self.session = None
        
        # Fallback identifikace pomocí vlastních algoritmů
        self.fallback_enabled = True
        
        # Cache pro výsledky identifikace
        self.cache = {}
        self.cache_ttl = timedelta(hours=24)
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
    
    def _prepare_image(self, image_data: bytes) -> Tuple[str, Dict]:
        """
        Příprava obrázku pro AI analýzu
        """
        try:
            # Otevření obrázku pomocí PIL
            image = Image.open(io.BytesIO(image_data))
            
            # Optimalizace velikosti pro API
            max_size = (1024, 1024)
            if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
                image.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # Konverze na RGB pokud je potřeba
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Konverze na base64
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=85)
            image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            # Metadata obrázku
            metadata = {
                'width': image.size[0],
                'height': image.size[1],
                'format': 'JPEG',
                'size_bytes': len(buffer.getvalue())
            }
            
            return image_base64, metadata
            
        except Exception as e:
            logger.error(f"Error preparing image: {str(e)}")
            raise ValueError(f"Nepodařilo se zpracovat obrázek: {str(e)}")
    
    async def _call_coinscan_api(self, image_base64: str, metadata: Dict) -> Dict:
        """
        Volání CoinScan AI API pro identifikaci mince
        """
        if not self.coinscan_api_key:
            raise ValueError("CoinScan API klíč není nakonfigurován")
        
        headers = {
            'Authorization': f'Bearer {self.coinscan_api_key}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'image': image_base64,
            'image_metadata': metadata,
            'analysis_type': 'full',  # full, basic, quick
            'include_confidence': True,
            'include_similar': True,
            'max_results': 5
        }
        
        try:
            async with self.session.post(
                f"{self.coinscan_base_url}/identify",
                json=payload,
                headers=headers,
                timeout=30
            ) as response:
                
                if response.status == 200:
                    result = await response.json()
                    return self._process_coinscan_response(result)
                elif response.status == 429:
                    # Rate limit - čekáme a zkusíme znovu
                    await asyncio.sleep(2)
                    raise Exception("Rate limit exceeded, zkuste později")
                else:
                    error_text = await response.text()
                    raise Exception(f"CoinScan API error: {response.status} - {error_text}")
                    
        except asyncio.TimeoutError:
            raise Exception("CoinScan API timeout")
        except Exception as e:
            logger.error(f"CoinScan API call failed: {str(e)}")
            raise
    
    def _process_coinscan_response(self, response: Dict) -> Dict:
        """
        Zpracování odpovědi z CoinScan API
        """
        results = []
        
        for match in response.get('matches', []):
            result = {
                'confidence': match.get('confidence', 0),
                'coin_data': {
                    'name': match.get('name', ''),
                    'country': match.get('country', ''),
                    'year': match.get('year'),
                    'denomination': match.get('denomination'),
                    'currency': match.get('currency', ''),
                    'material': match.get('material', ''),
                    'diameter': match.get('diameter'),
                    'weight': match.get('weight'),
                    'coin_type': match.get('type', ''),
                    'mint_mark': match.get('mint_mark', ''),
                    'rarity_score': match.get('rarity_score'),
                    'estimated_value': match.get('estimated_value'),
                    'description': match.get('description', ''),
                },
                'source': 'coinscan_ai',
                'external_id': match.get('id'),
                'similar_coins': match.get('similar_coins', [])
            }
            results.append(result)
        
        return {
            'success': True,
            'results': results,
            'analysis_metadata': {
                'processing_time': response.get('processing_time_ms', 0),
                'api_version': response.get('api_version', ''),
                'timestamp': datetime.utcnow().isoformat()
            }
        }
    
    async def _fallback_identification(self, image_data: bytes, metadata: Dict) -> Dict:
        """
        Fallback identifikace pomocí vlastních algoritmů
        """
        logger.info("Using fallback identification method")
        
        try:
            # Základní analýza obrázku
            image = Image.open(io.BytesIO(image_data))
            
            # Detekce kruhového tvaru (základní test pro minci)
            is_circular = self._detect_circular_shape(image)
            
            # Odhad velikosti na základě pixelů (velmi přibližný)
            estimated_diameter = self._estimate_diameter(image)
            
            # Detekce barev pro odhad materiálu
            dominant_colors = self._analyze_colors(image)
            material_guess = self._guess_material_from_colors(dominant_colors)
            
            # Základní výsledek
            result = {
                'confidence': 0.3,  # Nízká confidence pro fallback
                'coin_data': {
                    'name': 'Neidentifikovaná mince',
                    'country': '',
                    'material': material_guess,
                    'diameter': estimated_diameter,
                    'coin_type': 'Neznámý typ',
                    'description': f'Automaticky detekována {'kruhová' if is_circular else 'nekruhová'} mince'
                },
                'source': 'fallback_analysis',
                'analysis_details': {
                    'is_circular': is_circular,
                    'estimated_diameter': estimated_diameter,
                    'dominant_colors': dominant_colors,
                    'material_guess': material_guess
                }
            }
            
            return {
                'success': True,
                'results': [result],
                'analysis_metadata': {
                    'method': 'fallback',
                    'timestamp': datetime.utcnow().isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Fallback identification failed: {str(e)}")
            return {
                'success': False,
                'error': f'Fallback identifikace selhala: {str(e)}',
                'results': []
            }
    
    def _detect_circular_shape(self, image: Image.Image) -> bool:
        """
        Detekce kruhového tvaru mince
        """
        try:
            import cv2
            import numpy as np
            
            # Konverze PIL na OpenCV
            opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            gray = cv2.cvtColor(opencv_image, cv2.COLOR_BGR2GRAY)
            
            # Detekce kruhů pomocí HoughCircles
            circles = cv2.HoughCircles(
                gray,
                cv2.HOUGH_GRADIENT,
                dp=1,
                minDist=30,
                param1=50,
                param2=30,
                minRadius=20,
                maxRadius=0
            )
            
            return circles is not None and len(circles[0]) > 0
            
        except ImportError:
            # OpenCV není dostupné, použijeme základní heuristiku
            width, height = image.size
            aspect_ratio = width / height
            return 0.8 <= aspect_ratio <= 1.2  # Přibližně čtvercový = možná kruhový
        except Exception:
            return False
    
    def _estimate_diameter(self, image: Image.Image) -> Optional[float]:
        """
        Odhad průměru mince na základě velikosti obrázku
        """
        try:
            # Velmi hrubý odhad - předpokládáme standardní fotografování
            width, height = image.size
            avg_size = (width + height) / 2
            
            # Mapování velikosti obrázku na průměr mince (velmi přibližné)
            if avg_size < 200:
                return 15.0  # Malá mince
            elif avg_size < 400:
                return 20.0  # Střední mince
            elif avg_size < 600:
                return 25.0  # Větší mince
            else:
                return 30.0  # Velká mince
                
        except Exception:
            return None
    
    def _analyze_colors(self, image: Image.Image) -> List[Tuple[int, int, int]]:
        """
        Analýza dominantních barev v obrázku
        """
        try:
            # Zmenšení obrázku pro rychlejší analýzu
            image_small = image.resize((50, 50))
            
            # Získání všech pixelů
            pixels = list(image_small.getdata())
            
            # Počítání výskytu barev
            color_count = {}
            for pixel in pixels:
                if len(pixel) >= 3:  # RGB
                    rgb = pixel[:3]
                    color_count[rgb] = color_count.get(rgb, 0) + 1
            
            # Seřazení podle četnosti
            sorted_colors = sorted(color_count.items(), key=lambda x: x[1], reverse=True)
            
            # Vrácení top 5 barev
            return [color for color, count in sorted_colors[:5]]
            
        except Exception:
            return [(128, 128, 128)]  # Šedá jako fallback
    
    def _guess_material_from_colors(self, colors: List[Tuple[int, int, int]]) -> str:
        """
        Odhad materiálu na základě dominantních barev
        """
        if not colors:
            return "Neznámý"
        
        primary_color = colors[0]
        r, g, b = primary_color
        
        # Jednoduché heuristiky pro materiál
        if r > 180 and g > 150 and b < 100:  # Zlatavá
            return "Zlato"
        elif r > 150 and g > 150 and b > 150:  # Stříbrná
            return "Stříbro"
        elif r > 150 and g < 100 and b < 100:  # Měděná/bronzová
            return "Měď"
        elif r < 100 and g < 100 and b < 100:  # Tmavá
            return "Nikl"
        else:
            return "Slitina"
    
    async def identify_coin(self, image_data: bytes, use_cache: bool = True) -> Dict:
        """
        Hlavní metoda pro identifikaci mince
        """
        try:
            # Příprava obrázku
            image_base64, metadata = self._prepare_image(image_data)
            
            # Cache klíč
            cache_key = f"identify_{hash(image_base64)}"
            
            # Kontrola cache
            if use_cache and cache_key in self.cache:
                cached_result, timestamp = self.cache[cache_key]
                if datetime.utcnow() - timestamp < self.cache_ttl:
                    logger.info("Returning cached identification result")
                    return cached_result
            
            # Pokus o CoinScan API
            try:
                if self.coinscan_api_key:
                    result = await self._call_coinscan_api(image_base64, metadata)
                    
                    # Uložení do cache
                    if use_cache:
                        self.cache[cache_key] = (result, datetime.utcnow())
                    
                    return result
                else:
                    logger.warning("CoinScan API key not configured, using fallback")
                    
            except Exception as e:
                logger.error(f"CoinScan API failed: {str(e)}")
                if not self.fallback_enabled:
                    raise
            
            # Fallback identifikace
            result = await self._fallback_identification(image_data, metadata)
            
            # Uložení do cache
            if use_cache:
                self.cache[cache_key] = (result, datetime.utcnow())
            
            return result
            
        except Exception as e:
            logger.error(f"Coin identification failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'results': []
            }
    
    async def batch_identify(self, images_data: List[bytes], max_concurrent: int = 3) -> List[Dict]:
        """
        Batch identifikace více mincí současně
        """
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def identify_single(image_data: bytes) -> Dict:
            async with semaphore:
                return await self.identify_coin(image_data)
        
        tasks = [identify_single(image_data) for image_data in images_data]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Zpracování výsledků a výjimek
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    'success': False,
                    'error': str(result),
                    'image_index': i
                })
            else:
                result['image_index'] = i
                processed_results.append(result)
        
        return processed_results
    
    def get_confidence_explanation(self, confidence: float) -> str:
        """
        Vysvětlení úrovně spolehlivosti identifikace
        """
        if confidence >= 0.9:
            return "Velmi vysoká spolehlivost - téměř jistá identifikace"
        elif confidence >= 0.7:
            return "Vysoká spolehlivost - pravděpodobná správná identifikace"
        elif confidence >= 0.5:
            return "Střední spolehlivost - možná správná identifikace"
        elif confidence >= 0.3:
            return "Nízká spolehlivost - nejistá identifikace"
        else:
            return "Velmi nízká spolehlivost - identifikace neúspěšná"
    
    def clear_cache(self):
        """
        Vymazání cache identifikace
        """
        self.cache.clear()
        logger.info("Identification cache cleared")

# Singleton instance
coin_identification_service = CoinIdentificationService()