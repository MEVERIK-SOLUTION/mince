import asyncio
import logging
import json
import hashlib
import pickle
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import os
import aiofiles
import redis.asyncio as redis
from sqlalchemy.orm import Session

from ..core.config import settings

logger = logging.getLogger(__name__)

class CacheBackend(Enum):
    """Typy cache backend"""
    MEMORY = "memory"
    REDIS = "redis"
    FILE = "file"
    DATABASE = "database"

@dataclass
class CacheEntry:
    """Struktura cache záznamu"""
    key: str
    value: Any
    timestamp: datetime
    ttl: timedelta
    access_count: int = 0
    last_access: datetime = None
    tags: List[str] = None

class APICacheService:
    """
    Služba pro cache externích API volání s podporou různých backend
    """
    
    def __init__(self):
        self.memory_cache = {}
        self.redis_client = None
        self.cache_backend = CacheBackend.MEMORY
        
        # Konfigurace cache
        self.cache_config = {
            'default_ttl': timedelta(hours=1),
            'max_memory_entries': 10000,
            'cleanup_interval': timedelta(minutes=30),
            'compression_enabled': True,
            'encryption_enabled': False
        }
        
        # TTL pro různé typy API
        self.api_ttl_config = {
            'coin_identification': timedelta(days=7),      # Identifikace se nemění často
            'price_data': timedelta(hours=1),              # Ceny se mění často
            'precious_metals': timedelta(minutes=30),      # Kovy se mění velmi často
            'numista_search': timedelta(days=1),           # Vyhledávání v katalogu
            'coingecko_prices': timedelta(minutes=15),     # Crypto ceny
            'exchange_rates': timedelta(hours=6),          # Směnné kurzy
            'image_features': timedelta(days=30),          # Příznaky obrázků
            'similarity_search': timedelta(hours=12)       # Vyhledávání podobnosti
        }
        
        # Statistiky cache
        self.cache_stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
            'evictions': 0,
            'total_requests': 0,
            'hit_rate': 0.0,
            'memory_usage': 0,
            'last_cleanup': None
        }
        
        # Inicializace cache backend
        self._initialize_cache_backend()
        
        # Spuštění cleanup úlohy
        asyncio.create_task(self._periodic_cleanup())
    
    def _initialize_cache_backend(self):
        """
        Inicializace cache backend na základě konfigurace
        """
        try:
            # Pokus o Redis připojení
            redis_url = getattr(settings, 'REDIS_URL', None)
            if redis_url:
                try:
                    self.redis_client = redis.from_url(redis_url)
                    self.cache_backend = CacheBackend.REDIS
                    logger.info("Redis cache backend initialized")
                    return
                except Exception as e:
                    logger.warning(f"Redis initialization failed: {str(e)}")
            
            # Fallback na memory cache
            self.cache_backend = CacheBackend.MEMORY
            logger.info("Memory cache backend initialized")
            
        except Exception as e:
            logger.error(f"Cache backend initialization failed: {str(e)}")
            self.cache_backend = CacheBackend.MEMORY
    
    async def get(self, key: str, api_type: str = None) -> Optional[Any]:
        """
        Získání hodnoty z cache
        """
        try:
            self.cache_stats['total_requests'] += 1
            
            # Normalizace klíče
            normalized_key = self._normalize_key(key)
            
            # Získání z příslušného backend
            if self.cache_backend == CacheBackend.REDIS:
                result = await self._get_from_redis(normalized_key)
            else:
                result = await self._get_from_memory(normalized_key)
            
            if result is not None:
                self.cache_stats['hits'] += 1
                
                # Aktualizace access statistik
                if self.cache_backend == CacheBackend.MEMORY and normalized_key in self.memory_cache:
                    entry = self.memory_cache[normalized_key]
                    entry.access_count += 1
                    entry.last_access = datetime.utcnow()
                
                logger.debug(f"Cache HIT for key: {key[:50]}...")
                return result
            else:
                self.cache_stats['misses'] += 1
                logger.debug(f"Cache MISS for key: {key[:50]}...")
                return None
                
        except Exception as e:
            logger.error(f"Cache get failed: {str(e)}")
            self.cache_stats['misses'] += 1
            return None
        finally:
            self._update_hit_rate()
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        api_type: str = None, 
        ttl: timedelta = None,
        tags: List[str] = None
    ) -> bool:
        """
        Uložení hodnoty do cache
        """
        try:
            # Normalizace klíče
            normalized_key = self._normalize_key(key)
            
            # Určení TTL
            if ttl is None:
                ttl = self.api_ttl_config.get(api_type, self.cache_config['default_ttl'])
            
            # Uložení do příslušného backend
            if self.cache_backend == CacheBackend.REDIS:
                success = await self._set_to_redis(normalized_key, value, ttl, tags)
            else:
                success = await self._set_to_memory(normalized_key, value, ttl, tags)
            
            if success:
                self.cache_stats['sets'] += 1
                logger.debug(f"Cache SET for key: {key[:50]}... (TTL: {ttl})")
            
            return success
            
        except Exception as e:
            logger.error(f"Cache set failed: {str(e)}")
            return False
    
    async def delete(self, key: str) -> bool:
        """
        Smazání hodnoty z cache
        """
        try:
            normalized_key = self._normalize_key(key)
            
            if self.cache_backend == CacheBackend.REDIS:
                success = await self._delete_from_redis(normalized_key)
            else:
                success = await self._delete_from_memory(normalized_key)
            
            if success:
                self.cache_stats['deletes'] += 1
                logger.debug(f"Cache DELETE for key: {key[:50]}...")
            
            return success
            
        except Exception as e:
            logger.error(f"Cache delete failed: {str(e)}")
            return False
    
    async def clear(self, pattern: str = None, api_type: str = None) -> int:
        """
        Vymazání cache podle vzoru nebo typu API
        """
        try:
            if self.cache_backend == CacheBackend.REDIS:
                return await self._clear_redis(pattern, api_type)
            else:
                return await self._clear_memory(pattern, api_type)
                
        except Exception as e:
            logger.error(f"Cache clear failed: {str(e)}")
            return 0
    
    async def get_or_set(
        self,
        key: str,
        fetch_function: callable,
        api_type: str = None,
        ttl: timedelta = None,
        tags: List[str] = None,
        *args,
        **kwargs
    ) -> Any:
        """
        Získání z cache nebo spuštění funkce a uložení výsledku
        """
        try:
            # Pokus o získání z cache
            cached_value = await self.get(key, api_type)
            if cached_value is not None:
                return cached_value
            
            # Cache miss - spuštění funkce
            if asyncio.iscoroutinefunction(fetch_function):
                value = await fetch_function(*args, **kwargs)
            else:
                value = fetch_function(*args, **kwargs)
            
            # Uložení do cache
            if value is not None:
                await self.set(key, value, api_type, ttl, tags)
            
            return value
            
        except Exception as e:
            logger.error(f"Get or set failed: {str(e)}")
            # Pokus o spuštění funkce i při chybě cache
            try:
                if asyncio.iscoroutinefunction(fetch_function):
                    return await fetch_function(*args, **kwargs)
                else:
                    return fetch_function(*args, **kwargs)
            except Exception as fetch_error:
                logger.error(f"Fetch function failed: {str(fetch_error)}")
                return None
    
    async def _get_from_redis(self, key: str) -> Optional[Any]:
        """
        Získání z Redis cache
        """
        try:
            if not self.redis_client:
                return None
            
            data = await self.redis_client.get(key)
            if data is None:
                return None
            
            # Deserializace
            return self._deserialize(data)
            
        except Exception as e:
            logger.warning(f"Redis get failed: {str(e)}")
            return None
    
    async def _set_to_redis(
        self, 
        key: str, 
        value: Any, 
        ttl: timedelta,
        tags: List[str] = None
    ) -> bool:
        """
        Uložení do Redis cache
        """
        try:
            if not self.redis_client:
                return False
            
            # Serializace
            serialized_data = self._serialize(value)
            
            # Uložení s TTL
            await self.redis_client.setex(
                key, 
                int(ttl.total_seconds()), 
                serialized_data
            )
            
            # Uložení tagů (pokud jsou zadány)
            if tags:
                for tag in tags:
                    await self.redis_client.sadd(f"tag:{tag}", key)
                    await self.redis_client.expire(f"tag:{tag}", int(ttl.total_seconds()))
            
            return True
            
        except Exception as e:
            logger.warning(f"Redis set failed: {str(e)}")
            return False
    
    async def _delete_from_redis(self, key: str) -> bool:
        """
        Smazání z Redis cache
        """
        try:
            if not self.redis_client:
                return False
            
            result = await self.redis_client.delete(key)
            return result > 0
            
        except Exception as e:
            logger.warning(f"Redis delete failed: {str(e)}")
            return False
    
    async def _clear_redis(self, pattern: str = None, api_type: str = None) -> int:
        """
        Vymazání Redis cache
        """
        try:
            if not self.redis_client:
                return 0
            
            if pattern:
                keys = await self.redis_client.keys(pattern)
            elif api_type:
                keys = await self.redis_client.keys(f"*{api_type}*")
            else:
                keys = await self.redis_client.keys("*")
            
            if keys:
                deleted = await self.redis_client.delete(*keys)
                return deleted
            
            return 0
            
        except Exception as e:
            logger.warning(f"Redis clear failed: {str(e)}")
            return 0
    
    async def _get_from_memory(self, key: str) -> Optional[Any]:
        """
        Získání z memory cache
        """
        try:
            if key not in self.memory_cache:
                return None
            
            entry = self.memory_cache[key]
            
            # Kontrola TTL
            if datetime.utcnow() - entry.timestamp > entry.ttl:
                del self.memory_cache[key]
                self.cache_stats['evictions'] += 1
                return None
            
            return entry.value
            
        except Exception as e:
            logger.warning(f"Memory get failed: {str(e)}")
            return None
    
    async def _set_to_memory(
        self, 
        key: str, 
        value: Any, 
        ttl: timedelta,
        tags: List[str] = None
    ) -> bool:
        """
        Uložení do memory cache
        """
        try:
            # Kontrola limitu paměti
            if len(self.memory_cache) >= self.cache_config['max_memory_entries']:
                await self._evict_lru_entries()
            
            # Vytvoření cache entry
            entry = CacheEntry(
                key=key,
                value=value,
                timestamp=datetime.utcnow(),
                ttl=ttl,
                tags=tags or []
            )
            
            self.memory_cache[key] = entry
            return True
            
        except Exception as e:
            logger.warning(f"Memory set failed: {str(e)}")
            return False
    
    async def _delete_from_memory(self, key: str) -> bool:
        """
        Smazání z memory cache
        """
        try:
            if key in self.memory_cache:
                del self.memory_cache[key]
                return True
            return False
            
        except Exception as e:
            logger.warning(f"Memory delete failed: {str(e)}")
            return False
    
    async def _clear_memory(self, pattern: str = None, api_type: str = None) -> int:
        """
        Vymazání memory cache
        """
        try:
            if not pattern and not api_type:
                count = len(self.memory_cache)
                self.memory_cache.clear()
                return count
            
            keys_to_delete = []
            
            for key in self.memory_cache.keys():
                if pattern and pattern in key:
                    keys_to_delete.append(key)
                elif api_type and api_type in key:
                    keys_to_delete.append(key)
            
            for key in keys_to_delete:
                del self.memory_cache[key]
            
            return len(keys_to_delete)
            
        except Exception as e:
            logger.warning(f"Memory clear failed: {str(e)}")
            return 0
    
    async def _evict_lru_entries(self, count: int = None):
        """
        Vyřazení nejméně používaných záznamů
        """
        try:
            if count is None:
                count = max(1, len(self.memory_cache) // 10)  # Vyřadit 10%
            
            # Seřazení podle posledního přístupu
            sorted_entries = sorted(
                self.memory_cache.items(),
                key=lambda x: x[1].last_access or x[1].timestamp
            )
            
            for i in range(min(count, len(sorted_entries))):
                key = sorted_entries[i][0]
                del self.memory_cache[key]
                self.cache_stats['evictions'] += 1
            
        except Exception as e:
            logger.warning(f"LRU eviction failed: {str(e)}")
    
    async def _periodic_cleanup(self):
        """
        Periodické čištění cache
        """
        while True:
            try:
                await asyncio.sleep(self.cache_config['cleanup_interval'].total_seconds())
                
                if self.cache_backend == CacheBackend.MEMORY:
                    await self._cleanup_memory_cache()
                
                self.cache_stats['last_cleanup'] = datetime.utcnow()
                
            except Exception as e:
                logger.error(f"Periodic cleanup failed: {str(e)}")
                await asyncio.sleep(300)  # Při chybě čekat 5 minut
    
    async def _cleanup_memory_cache(self):
        """
        Čištění memory cache od expirovaných záznamů
        """
        try:
            current_time = datetime.utcnow()
            expired_keys = []
            
            for key, entry in self.memory_cache.items():
                if current_time - entry.timestamp > entry.ttl:
                    expired_keys.append(key)
            
            for key in expired_keys:
                del self.memory_cache[key]
                self.cache_stats['evictions'] += 1
            
            if expired_keys:
                logger.info(f"Cleaned up {len(expired_keys)} expired cache entries")
            
        except Exception as e:
            logger.error(f"Memory cache cleanup failed: {str(e)}")
    
    def _normalize_key(self, key: str) -> str:
        """
        Normalizace cache klíče
        """
        try:
            # Hash dlouhých klíčů
            if len(key) > 250:
                return hashlib.sha256(key.encode()).hexdigest()
            
            # Odstranění problematických znaků
            normalized = key.replace(' ', '_').replace(':', '_').replace('/', '_')
            return normalized
            
        except Exception:
            # Fallback na hash
            return hashlib.sha256(key.encode()).hexdigest()
    
    def _serialize(self, value: Any) -> bytes:
        """
        Serializace hodnoty pro uložení
        """
        try:
            if self.cache_config['compression_enabled']:
                import gzip
                serialized = pickle.dumps(value)
                return gzip.compress(serialized)
            else:
                return pickle.dumps(value)
                
        except Exception as e:
            logger.error(f"Serialization failed: {str(e)}")
            return pickle.dumps(None)
    
    def _deserialize(self, data: bytes) -> Any:
        """
        Deserializace hodnoty z úložiště
        """
        try:
            if self.cache_config['compression_enabled']:
                import gzip
                decompressed = gzip.decompress(data)
                return pickle.loads(decompressed)
            else:
                return pickle.loads(data)
                
        except Exception as e:
            logger.error(f"Deserialization failed: {str(e)}")
            return None
    
    def _update_hit_rate(self):
        """
        Aktualizace hit rate statistiky
        """
        total = self.cache_stats['hits'] + self.cache_stats['misses']
        if total > 0:
            self.cache_stats['hit_rate'] = self.cache_stats['hits'] / total
    
    def get_cache_statistics(self) -> Dict:
        """
        Získání statistik cache
        """
        stats = self.cache_stats.copy()
        
        # Přidání informací o backend
        stats['backend'] = self.cache_backend.value
        stats['memory_entries'] = len(self.memory_cache) if self.cache_backend == CacheBackend.MEMORY else 0
        
        # Výpočet memory usage pro memory backend
        if self.cache_backend == CacheBackend.MEMORY:
            try:
                import sys
                total_size = 0
                for entry in self.memory_cache.values():
                    total_size += sys.getsizeof(entry.value)
                stats['memory_usage'] = total_size
            except Exception:
                stats['memory_usage'] = 0
        
        return stats
    
    def update_cache_config(self, new_config: Dict):
        """
        Aktualizace konfigurace cache
        """
        try:
            for key, value in new_config.items():
                if key in self.cache_config:
                    self.cache_config[key] = value
            
            logger.info(f"Cache config updated: {new_config}")
            
        except Exception as e:
            logger.error(f"Failed to update cache config: {str(e)}")
    
    def update_api_ttl_config(self, api_type: str, ttl: timedelta):
        """
        Aktualizace TTL pro konkrétní typ API
        """
        try:
            self.api_ttl_config[api_type] = ttl
            logger.info(f"TTL for {api_type} updated to {ttl}")
            
        except Exception as e:
            logger.error(f"Failed to update API TTL: {str(e)}")
    
    async def warm_cache(self, warm_functions: List[Dict]):
        """
        Předehřátí cache spuštěním funkcí
        """
        try:
            logger.info(f"Starting cache warm-up with {len(warm_functions)} functions")
            
            for func_config in warm_functions:
                try:
                    func = func_config['function']
                    key = func_config['key']
                    api_type = func_config.get('api_type')
                    args = func_config.get('args', [])
                    kwargs = func_config.get('kwargs', {})
                    
                    # Kontrola, zda už není v cache
                    if await self.get(key, api_type) is None:
                        await self.get_or_set(key, func, api_type, None, None, *args, **kwargs)
                        logger.debug(f"Cache warmed for key: {key[:50]}...")
                    
                except Exception as e:
                    logger.warning(f"Cache warm-up failed for function: {str(e)}")
                    continue
            
            logger.info("Cache warm-up completed")
            
        except Exception as e:
            logger.error(f"Cache warm-up failed: {str(e)}")

# Singleton instance
api_cache_service = APICacheService()

# Decorator pro automatické cache
def cached(api_type: str = None, ttl: timedelta = None, key_func: callable = None):
    """
    Decorator pro automatické cache API volání
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Generování cache klíče
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                cache_key = f"{func.__name__}_{hash(str(args) + str(sorted(kwargs.items())))}"
            
            # Použití cache
            return await api_cache_service.get_or_set(
                cache_key, func, api_type, ttl, None, *args, **kwargs
            )
        
        return wrapper
    return decorator