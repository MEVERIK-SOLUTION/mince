import asyncio
import logging
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
import json
import os
from enum import Enum
import aiohttp
from sqlalchemy.orm import Session

from ..core.config import settings
from .coin_identification import coin_identification_service
from .price_service import price_service
from .image_search_service import image_search_service

logger = logging.getLogger(__name__)

class ServiceType(Enum):
    """Typy služeb s fallback podporou"""
    COIN_IDENTIFICATION = "coin_identification"
    PRICE_ESTIMATION = "price_estimation"
    IMAGE_SEARCH = "image_search"
    EXTERNAL_API = "external_api"

class FallbackStrategy(Enum):
    """Strategie fallback mechanismů"""
    RETRY = "retry"                    # Opakování s exponenciálním backoff
    ALTERNATIVE_API = "alternative"    # Použití alternativního API
    LOCAL_PROCESSING = "local"         # Lokální zpracování
    CACHED_RESULT = "cached"          # Použití cache
    DEGRADED_SERVICE = "degraded"     # Omezená funkcionalita

class FallbackService:
    """
    Služba pro správu fallback mechanismů při selhání API a služeb
    """
    
    def __init__(self):
        self.service_status = {}
        self.fallback_cache = {}
        self.retry_configs = {
            ServiceType.COIN_IDENTIFICATION: {
                'max_retries': 3,
                'base_delay': 1.0,
                'max_delay': 30.0,
                'exponential_base': 2.0
            },
            ServiceType.PRICE_ESTIMATION: {
                'max_retries': 2,
                'base_delay': 2.0,
                'max_delay': 60.0,
                'exponential_base': 2.0
            },
            ServiceType.IMAGE_SEARCH: {
                'max_retries': 2,
                'base_delay': 1.0,
                'max_delay': 15.0,
                'exponential_base': 1.5
            },
            ServiceType.EXTERNAL_API: {
                'max_retries': 3,
                'base_delay': 5.0,
                'max_delay': 120.0,
                'exponential_base': 2.0
            }
        }
        
        # Konfigurace alternativních služeb
        self.alternative_services = {
            ServiceType.COIN_IDENTIFICATION: [
                'local_cv_analysis',
                'image_similarity_search',
                'manual_feature_extraction'
            ],
            ServiceType.PRICE_ESTIMATION: [
                'historical_price_estimation',
                'material_value_calculation',
                'similar_coins_pricing'
            ],
            ServiceType.IMAGE_SEARCH: [
                'local_feature_matching',
                'basic_similarity_search'
            ]
        }
        
        # Cache pro fallback výsledky
        self.cache_ttl = {
            ServiceType.COIN_IDENTIFICATION: timedelta(hours=24),
            ServiceType.PRICE_ESTIMATION: timedelta(hours=6),
            ServiceType.IMAGE_SEARCH: timedelta(hours=12),
            ServiceType.EXTERNAL_API: timedelta(hours=1)
        }
        
        # Statistiky fallback operací
        self.fallback_stats = {
            'total_fallbacks': 0,
            'successful_fallbacks': 0,
            'failed_fallbacks': 0,
            'fallback_by_service': {},
            'fallback_by_strategy': {},
            'average_fallback_time': 0.0
        }
    
    async def execute_with_fallback(
        self,
        service_type: ServiceType,
        primary_function: callable,
        fallback_strategies: List[FallbackStrategy],
        *args,
        **kwargs
    ) -> Dict:
        """
        Spuštění funkce s fallback mechanismy
        """
        start_time = datetime.utcnow()
        
        try:
            # Pokus o primární službu
            result = await self._try_primary_service(
                service_type, primary_function, *args, **kwargs
            )
            
            if result.get('success'):
                self._update_service_status(service_type, True)
                return result
            
            # Primární služba selhala - spuštění fallback
            logger.warning(f"Primary service {service_type.value} failed, starting fallback")
            
            return await self._execute_fallback_strategies(
                service_type, fallback_strategies, start_time, *args, **kwargs
            )
            
        except Exception as e:
            logger.error(f"Execute with fallback failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'fallback_executed': False
            }
    
    async def _try_primary_service(
        self,
        service_type: ServiceType,
        primary_function: callable,
        *args,
        **kwargs
    ) -> Dict:
        """
        Pokus o spuštění primární služby
        """
        try:
            if asyncio.iscoroutinefunction(primary_function):
                result = await primary_function(*args, **kwargs)
            else:
                result = primary_function(*args, **kwargs)
            
            return result
            
        except Exception as e:
            logger.warning(f"Primary service {service_type.value} failed: {str(e)}")
            self._update_service_status(service_type, False, str(e))
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _execute_fallback_strategies(
        self,
        service_type: ServiceType,
        strategies: List[FallbackStrategy],
        start_time: datetime,
        *args,
        **kwargs
    ) -> Dict:
        """
        Spuštění fallback strategií
        """
        self.fallback_stats['total_fallbacks'] += 1
        
        for strategy in strategies:
            try:
                logger.info(f"Trying fallback strategy: {strategy.value} for {service_type.value}")
                
                result = await self._execute_strategy(
                    service_type, strategy, *args, **kwargs
                )
                
                if result.get('success'):
                    # Úspěšný fallback
                    processing_time = (datetime.utcnow() - start_time).total_seconds()
                    
                    self.fallback_stats['successful_fallbacks'] += 1
                    self._update_fallback_stats(service_type, strategy, processing_time)
                    
                    result['fallback_executed'] = True
                    result['fallback_strategy'] = strategy.value
                    result['fallback_time'] = processing_time
                    
                    return result
                
            except Exception as e:
                logger.warning(f"Fallback strategy {strategy.value} failed: {str(e)}")
                continue
        
        # Všechny fallback strategie selhaly
        self.fallback_stats['failed_fallbacks'] += 1
        
        return {
            'success': False,
            'error': 'Všechny fallback strategie selhaly',
            'fallback_executed': True,
            'attempted_strategies': [s.value for s in strategies]
        }
    
    async def _execute_strategy(
        self,
        service_type: ServiceType,
        strategy: FallbackStrategy,
        *args,
        **kwargs
    ) -> Dict:
        """
        Spuštění konkrétní fallback strategie
        """
        if strategy == FallbackStrategy.RETRY:
            return await self._retry_strategy(service_type, *args, **kwargs)
        
        elif strategy == FallbackStrategy.ALTERNATIVE_API:
            return await self._alternative_api_strategy(service_type, *args, **kwargs)
        
        elif strategy == FallbackStrategy.LOCAL_PROCESSING:
            return await self._local_processing_strategy(service_type, *args, **kwargs)
        
        elif strategy == FallbackStrategy.CACHED_RESULT:
            return await self._cached_result_strategy(service_type, *args, **kwargs)
        
        elif strategy == FallbackStrategy.DEGRADED_SERVICE:
            return await self._degraded_service_strategy(service_type, *args, **kwargs)
        
        else:
            return {
                'success': False,
                'error': f'Neznámá fallback strategie: {strategy.value}'
            }
    
    async def _retry_strategy(
        self,
        service_type: ServiceType,
        *args,
        **kwargs
    ) -> Dict:
        """
        Strategie opakování s exponenciálním backoff
        """
        config = self.retry_configs[service_type]
        
        for attempt in range(config['max_retries']):
            try:
                # Výpočet delay
                delay = min(
                    config['base_delay'] * (config['exponential_base'] ** attempt),
                    config['max_delay']
                )
                
                if attempt > 0:
                    logger.info(f"Retry attempt {attempt + 1} after {delay}s delay")
                    await asyncio.sleep(delay)
                
                # Pokus o spuštění původní služby
                if service_type == ServiceType.COIN_IDENTIFICATION:
                    result = await coin_identification_service.identify_coin(*args, **kwargs)
                elif service_type == ServiceType.PRICE_ESTIMATION:
                    async with price_service as pricer:
                        result = await pricer.estimate_coin_value(*args, **kwargs)
                elif service_type == ServiceType.IMAGE_SEARCH:
                    result = await image_search_service.search_similar_coins(*args, **kwargs)
                else:
                    return {'success': False, 'error': 'Nepodporovaný typ služby pro retry'}
                
                if result.get('success'):
                    return result
                
            except Exception as e:
                logger.warning(f"Retry attempt {attempt + 1} failed: {str(e)}")
                if attempt == config['max_retries'] - 1:
                    return {
                        'success': False,
                        'error': f'Retry strategy failed after {config["max_retries"]} attempts'
                    }
        
        return {
            'success': False,
            'error': 'Retry strategy exhausted'
        }
    
    async def _alternative_api_strategy(
        self,
        service_type: ServiceType,
        *args,
        **kwargs
    ) -> Dict:
        """
        Strategie použití alternativního API
        """
        alternatives = self.alternative_services.get(service_type, [])
        
        for alternative in alternatives:
            try:
                result = await self._call_alternative_service(
                    service_type, alternative, *args, **kwargs
                )
                
                if result.get('success'):
                    result['alternative_service'] = alternative
                    return result
                
            except Exception as e:
                logger.warning(f"Alternative service {alternative} failed: {str(e)}")
                continue
        
        return {
            'success': False,
            'error': 'Žádné alternativní API není dostupné'
        }
    
    async def _local_processing_strategy(
        self,
        service_type: ServiceType,
        *args,
        **kwargs
    ) -> Dict:
        """
        Strategie lokálního zpracování
        """
        try:
            if service_type == ServiceType.COIN_IDENTIFICATION:
                return await self._local_coin_identification(*args, **kwargs)
            
            elif service_type == ServiceType.PRICE_ESTIMATION:
                return await self._local_price_estimation(*args, **kwargs)
            
            elif service_type == ServiceType.IMAGE_SEARCH:
                return await self._local_image_search(*args, **kwargs)
            
            else:
                return {
                    'success': False,
                    'error': 'Lokální zpracování není podporováno pro tento typ služby'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'Lokální zpracování selhalo: {str(e)}'
            }
    
    async def _cached_result_strategy(
        self,
        service_type: ServiceType,
        *args,
        **kwargs
    ) -> Dict:
        """
        Strategie použití cache
        """
        try:
            # Vytvoření cache klíče
            cache_key = self._generate_cache_key(service_type, *args, **kwargs)
            
            # Kontrola cache
            if cache_key in self.fallback_cache:
                cached_data = self.fallback_cache[cache_key]
                
                # Kontrola TTL
                if datetime.utcnow() - cached_data['timestamp'] < self.cache_ttl[service_type]:
                    result = cached_data['result'].copy()
                    result['from_cache'] = True
                    result['cache_age'] = (datetime.utcnow() - cached_data['timestamp']).total_seconds()
                    
                    return result
            
            return {
                'success': False,
                'error': 'Žádný platný cache záznam nenalezen'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Cache strategie selhala: {str(e)}'
            }
    
    async def _degraded_service_strategy(
        self,
        service_type: ServiceType,
        *args,
        **kwargs
    ) -> Dict:
        """
        Strategie omezeného servisu
        """
        try:
            if service_type == ServiceType.COIN_IDENTIFICATION:
                return {
                    'success': True,
                    'coin_data': {
                        'name': 'Neidentifikovaná mince',
                        'confidence': 0.1
                    },
                    'degraded_service': True,
                    'message': 'Identifikace není dostupná - použijte manuální zadání'
                }
            
            elif service_type == ServiceType.PRICE_ESTIMATION:
                return {
                    'success': True,
                    'estimated_value': None,
                    'confidence': 0.0,
                    'degraded_service': True,
                    'message': 'Cenový odhad není dostupný'
                }
            
            elif service_type == ServiceType.IMAGE_SEARCH:
                return {
                    'success': True,
                    'results': [],
                    'degraded_service': True,
                    'message': 'Vyhledávání podle obrázků není dostupné'
                }
            
            else:
                return {
                    'success': False,
                    'error': 'Omezený servis není podporován pro tento typ služby'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'Omezený servis selhal: {str(e)}'
            }
    
    async def _call_alternative_service(
        self,
        service_type: ServiceType,
        alternative: str,
        *args,
        **kwargs
    ) -> Dict:
        """
        Volání alternativní služby
        """
        if service_type == ServiceType.COIN_IDENTIFICATION:
            if alternative == 'local_cv_analysis':
                return await self._local_cv_coin_analysis(*args, **kwargs)
            elif alternative == 'image_similarity_search':
                return await self._similarity_based_identification(*args, **kwargs)
            elif alternative == 'manual_feature_extraction':
                return await self._manual_feature_identification(*args, **kwargs)
        
        elif service_type == ServiceType.PRICE_ESTIMATION:
            if alternative == 'historical_price_estimation':
                return await self._historical_price_estimation(*args, **kwargs)
            elif alternative == 'material_value_calculation':
                return await self._material_value_estimation(*args, **kwargs)
            elif alternative == 'similar_coins_pricing':
                return await self._similar_coins_pricing(*args, **kwargs)
        
        return {
            'success': False,
            'error': f'Neznámá alternativní služba: {alternative}'
        }
    
    async def _local_coin_identification(self, image_path: str, **kwargs) -> Dict:
        """
        Lokální identifikace mince pomocí computer vision
        """
        try:
            # Použití fallback analýzy z coin_identification_service
            fallback_result = await coin_identification_service._fallback_identification(image_path)
            
            if fallback_result:
                return {
                    'success': True,
                    'coin_data': fallback_result,
                    'confidence': 0.3,  # Nižší confidence pro lokální analýzu
                    'source': 'local_cv_analysis',
                    'processing_time': 0
                }
            
            return {
                'success': False,
                'error': 'Lokální CV analýza selhala'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Lokální identifikace selhala: {str(e)}'
            }
    
    async def _local_price_estimation(self, coin, db: Session, **kwargs) -> Dict:
        """
        Lokální odhad ceny na základě dostupných dat
        """
        try:
            # Základní odhad na základě materiálu a rozměrů
            estimated_value = None
            
            if hasattr(coin, 'material') and hasattr(coin, 'weight') and coin.material and coin.weight:
                material_value = self._estimate_material_value(coin.material, coin.weight)
                if material_value:
                    estimated_value = material_value * 1.2  # Přirážka pro numismatickou hodnotu
            
            # Pokud není materiálový odhad, použij nominální hodnotu
            if not estimated_value and hasattr(coin, 'denomination') and coin.denomination:
                estimated_value = coin.denomination * 1.1
            
            if estimated_value:
                return {
                    'success': True,
                    'estimated_value': estimated_value,
                    'confidence': 0.2,
                    'currency': getattr(coin, 'currency', 'USD'),
                    'sources': ['local_estimation'],
                    'method': 'material_and_nominal_value'
                }
            
            return {
                'success': False,
                'error': 'Nedostatek dat pro lokální odhad ceny'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Lokální cenový odhad selhal: {str(e)}'
            }
    
    async def _local_image_search(self, query_image_path: str, db: Session, **kwargs) -> Dict:
        """
        Lokální vyhledávání obrázků pomocí základních příznaků
        """
        try:
            # Použití základní podobnosti bez pokročilých algoritmů
            results = []
            
            # Zde by byla implementace základního vyhledávání
            # Pro demonstraci vrátíme prázdné výsledky
            
            return {
                'success': True,
                'results': results,
                'total_found': len(results),
                'method': 'basic_local_search',
                'confidence': 0.3
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Lokální vyhledávání selhalo: {str(e)}'
            }
    
    def _estimate_material_value(self, material: str, weight: float) -> Optional[float]:
        """
        Odhad hodnoty na základě materiálu a hmotnosti
        """
        try:
            # Základní ceny materiálů (USD za gram)
            material_prices = {
                'gold': 60.0,
                'silver': 0.8,
                'platinum': 30.0,
                'palladium': 70.0,
                'copper': 0.01,
                'bronze': 0.01,
                'brass': 0.01,
                'nickel': 0.02
            }
            
            material_lower = material.lower()
            
            for mat, price_per_gram in material_prices.items():
                if mat in material_lower:
                    return weight * price_per_gram
            
            return None
            
        except Exception:
            return None
    
    def _generate_cache_key(self, service_type: ServiceType, *args, **kwargs) -> str:
        """
        Generování klíče pro cache
        """
        try:
            # Vytvoření hash z argumentů
            import hashlib
            
            key_data = {
                'service_type': service_type.value,
                'args': str(args),
                'kwargs': str(sorted(kwargs.items()))
            }
            
            key_string = json.dumps(key_data, sort_keys=True)
            return hashlib.md5(key_string.encode()).hexdigest()
            
        except Exception:
            return f"{service_type.value}_{datetime.utcnow().timestamp()}"
    
    def _update_service_status(self, service_type: ServiceType, success: bool, error: str = None):
        """
        Aktualizace stavu služby
        """
        self.service_status[service_type.value] = {
            'last_check': datetime.utcnow(),
            'status': 'healthy' if success else 'unhealthy',
            'error': error,
            'consecutive_failures': 0 if success else self.service_status.get(service_type.value, {}).get('consecutive_failures', 0) + 1
        }
    
    def _update_fallback_stats(self, service_type: ServiceType, strategy: FallbackStrategy, processing_time: float):
        """
        Aktualizace statistik fallback operací
        """
        # Statistiky podle služby
        if service_type.value not in self.fallback_stats['fallback_by_service']:
            self.fallback_stats['fallback_by_service'][service_type.value] = 0
        self.fallback_stats['fallback_by_service'][service_type.value] += 1
        
        # Statistiky podle strategie
        if strategy.value not in self.fallback_stats['fallback_by_strategy']:
            self.fallback_stats['fallback_by_strategy'][strategy.value] = 0
        self.fallback_stats['fallback_by_strategy'][strategy.value] += 1
        
        # Průměrný čas
        total_time = self.fallback_stats['average_fallback_time'] * (self.fallback_stats['successful_fallbacks'] - 1)
        total_time += processing_time
        self.fallback_stats['average_fallback_time'] = total_time / self.fallback_stats['successful_fallbacks']
    
    def get_service_health(self) -> Dict:
        """
        Získání zdravotního stavu služeb
        """
        return {
            'service_status': self.service_status.copy(),
            'fallback_stats': self.fallback_stats.copy(),
            'cache_size': len(self.fallback_cache),
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def clear_cache(self, service_type: Optional[ServiceType] = None):
        """
        Vymazání cache
        """
        if service_type:
            # Vymazání cache pro konkrétní službu
            keys_to_remove = [
                key for key in self.fallback_cache.keys()
                if service_type.value in key
            ]
            for key in keys_to_remove:
                del self.fallback_cache[key]
        else:
            # Vymazání celé cache
            self.fallback_cache.clear()
    
    def update_retry_config(self, service_type: ServiceType, config: Dict):
        """
        Aktualizace konfigurace retry mechanismu
        """
        if service_type in self.retry_configs:
            self.retry_configs[service_type].update(config)

# Singleton instance
fallback_service = FallbackService()