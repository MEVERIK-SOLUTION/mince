import asyncio
import aiohttp
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import json

from ..core.config import settings
from ..models.coin import Coin, PriceHistory

logger = logging.getLogger(__name__)

class PriceService:
    """
    Služba pro získávání cenových údajů z externích API
    """
    
    def __init__(self):
        self.numista_api_key = getattr(settings, 'NUMISTA_API_KEY', None)
        self.numista_base_url = "https://api.numista.com/v3"
        
        # Další cenové API
        self.coingecko_base_url = "https://api.coingecko.com/api/v3"
        self.pcgs_base_url = "https://api.pcgs.com/v1"
        
        self.session = None
        
        # Cache pro cenové údaje
        self.price_cache = {}
        self.cache_ttl = timedelta(hours=1)  # Ceny se aktualizují každou hodinu
        
        # Rate limiting
        self.rate_limits = {
            'numista': {'calls': 0, 'reset_time': datetime.utcnow()},
            'coingecko': {'calls': 0, 'reset_time': datetime.utcnow()},
            'pcgs': {'calls': 0, 'reset_time': datetime.utcnow()}
        }
        
        self.max_calls_per_hour = {
            'numista': 1000,
            'coingecko': 50,  # Free tier
            'pcgs': 100
        }
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
    
    def _check_rate_limit(self, api_name: str) -> bool:
        """
        Kontrola rate limitu pro dané API
        """
        now = datetime.utcnow()
        rate_info = self.rate_limits[api_name]
        
        # Reset počítadla každou hodinu
        if now - rate_info['reset_time'] > timedelta(hours=1):
            rate_info['calls'] = 0
            rate_info['reset_time'] = now
        
        # Kontrola limitu
        if rate_info['calls'] >= self.max_calls_per_hour[api_name]:
            return False
        
        rate_info['calls'] += 1
        return True
    
    async def _call_numista_api(self, endpoint: str, params: Dict = None) -> Dict:
        """
        Volání Numista API
        """
        if not self.numista_api_key:
            raise ValueError("Numista API klíč není nakonfigurován")
        
        if not self._check_rate_limit('numista'):
            raise Exception("Numista API rate limit exceeded")
        
        headers = {
            'Authorization': f'Bearer {self.numista_api_key}',
            'Content-Type': 'application/json'
        }
        
        url = f"{self.numista_base_url}/{endpoint}"
        
        try:
            async with self.session.get(
                url,
                params=params,
                headers=headers,
                timeout=15
            ) as response:
                
                if response.status == 200:
                    return await response.json()
                elif response.status == 429:
                    # Rate limit
                    retry_after = int(response.headers.get('Retry-After', 60))
                    raise Exception(f"Numista rate limit, zkuste za {retry_after} sekund")
                else:
                    error_text = await response.text()
                    raise Exception(f"Numista API error: {response.status} - {error_text}")
                    
        except asyncio.TimeoutError:
            raise Exception("Numista API timeout")
    
    async def _call_coingecko_api(self, endpoint: str, params: Dict = None) -> Dict:
        """
        Volání CoinGecko API (pro kryptoměny a některé mince)
        """
        if not self._check_rate_limit('coingecko'):
            raise Exception("CoinGecko API rate limit exceeded")
        
        url = f"{self.coingecko_base_url}/{endpoint}"
        
        try:
            async with self.session.get(
                url,
                params=params,
                timeout=10
            ) as response:
                
                if response.status == 200:
                    return await response.json()
                elif response.status == 429:
                    raise Exception("CoinGecko rate limit exceeded")
                else:
                    error_text = await response.text()
                    raise Exception(f"CoinGecko API error: {response.status} - {error_text}")
                    
        except asyncio.TimeoutError:
            raise Exception("CoinGecko API timeout")
    
    async def search_coin_on_numista(self, coin_data: Dict) -> List[Dict]:
        """
        Vyhledání mince na Numista
        """
        try:
            search_params = {
                'q': coin_data.get('name', ''),
                'country': coin_data.get('country', ''),
                'year': coin_data.get('year'),
                'denomination': coin_data.get('denomination'),
                'currency': coin_data.get('currency', ''),
                'limit': 10
            }
            
            # Odstranění prázdných parametrů
            search_params = {k: v for k, v in search_params.items() if v}
            
            result = await self._call_numista_api('coins/search', search_params)
            
            return result.get('coins', [])
            
        except Exception as e:
            logger.error(f"Numista search failed: {str(e)}")
            return []
    
    async def get_coin_price_from_numista(self, numista_id: str) -> Dict:
        """
        Získání cenových údajů konkrétní mince z Numista
        """
        try:
            # Základní informace o minci
            coin_info = await self._call_numista_api(f'coins/{numista_id}')
            
            # Cenové údaje
            price_info = await self._call_numista_api(f'coins/{numista_id}/prices')
            
            # Zpracování cenových údajů
            prices = {}
            for condition, price_data in price_info.get('prices', {}).items():
                if isinstance(price_data, dict):
                    prices[condition] = {
                        'value': price_data.get('value'),
                        'currency': price_data.get('currency', 'USD'),
                        'last_updated': price_data.get('last_updated'),
                        'source': 'numista'
                    }
            
            return {
                'success': True,
                'coin_info': coin_info,
                'prices': prices,
                'numista_id': numista_id,
                'last_updated': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get price from Numista: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'numista_id': numista_id
            }
    
    async def get_precious_metal_prices(self) -> Dict:
        """
        Získání aktuálních cen drahých kovů
        """
        try:
            # CoinGecko API pro ceny kovů
            metals = ['gold', 'silver', 'platinum', 'palladium']
            prices = {}
            
            for metal in metals:
                try:
                    result = await self._call_coingecko_api(
                        'simple/price',
                        {
                            'ids': metal,
                            'vs_currencies': 'usd,eur,czk',
                            'include_last_updated_at': 'true'
                        }
                    )
                    
                    if metal in result:
                        prices[metal] = result[metal]
                        
                except Exception as e:
                    logger.warning(f"Failed to get {metal} price: {str(e)}")
                    continue
            
            return {
                'success': True,
                'prices': prices,
                'timestamp': datetime.utcnow().isoformat(),
                'source': 'coingecko'
            }
            
        except Exception as e:
            logger.error(f"Failed to get metal prices: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def estimate_coin_value(self, coin: Coin, db: Session) -> Dict:
        """
        Odhad hodnoty mince na základě různých faktorů
        """
        try:
            estimated_value = None
            confidence = 0.0
            sources = []
            
            # 1. Pokus o vyhledání na Numista
            coin_data = {
                'name': coin.name,
                'country': coin.country,
                'year': coin.year,
                'denomination': coin.denomination,
                'currency': coin.currency
            }
            
            numista_results = await self.search_coin_on_numista(coin_data)
            
            if numista_results:
                # Najít nejlepší shodu
                best_match = numista_results[0]
                numista_price = await self.get_coin_price_from_numista(best_match['id'])
                
                if numista_price['success'] and numista_price['prices']:
                    # Použít cenu podle stavu mince
                    condition = coin.condition or 'VF'  # Very Fine jako default
                    
                    if condition in numista_price['prices']:
                        price_info = numista_price['prices'][condition]
                        estimated_value = price_info['value']
                        confidence = 0.8
                        sources.append('numista')
            
            # 2. Odhad na základě materiálu a drahých kovů
            if not estimated_value and coin.material:
                metal_prices = await self.get_precious_metal_prices()
                
                if metal_prices['success']:
                    material_value = self._estimate_material_value(
                        coin.material,
                        coin.weight,
                        metal_prices['prices']
                    )
                    
                    if material_value:
                        estimated_value = material_value
                        confidence = 0.4  # Nižší confidence pro materiálový odhad
                        sources.append('material_value')
            
            # 3. Historický odhad na základě podobných mincí
            if not estimated_value:
                historical_estimate = self._get_historical_estimate(coin, db)
                if historical_estimate:
                    estimated_value = historical_estimate
                    confidence = 0.3
                    sources.append('historical_data')
            
            # 4. Základní odhad podle nominální hodnoty
            if not estimated_value and coin.denomination:
                estimated_value = coin.denomination * 1.1  # Minimální přirážka
                confidence = 0.1
                sources.append('nominal_value')
            
            return {
                'success': True,
                'estimated_value': estimated_value,
                'confidence': confidence,
                'sources': sources,
                'currency': coin.currency or 'USD',
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Value estimation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _estimate_material_value(self, material: str, weight: Optional[float], metal_prices: Dict) -> Optional[float]:
        """
        Odhad hodnoty na základě materiálu a hmotnosti
        """
        if not weight:
            return None
        
        material_lower = material.lower()
        
        # Mapování materiálů na kovy
        material_mapping = {
            'zlato': 'gold',
            'gold': 'gold',
            'stříbro': 'silver',
            'silver': 'silver',
            'platina': 'platinum',
            'platinum': 'platinum',
            'palladium': 'palladium'
        }
        
        metal = None
        purity = 1.0  # Předpokládáme čistý kov
        
        for mat, met in material_mapping.items():
            if mat in material_lower:
                metal = met
                break
        
        # Odhad čistoty pro slitiny
        if 'slitina' in material_lower or 'alloy' in material_lower:
            purity = 0.5
        elif any(x in material_lower for x in ['925', 'sterling']):
            purity = 0.925
        elif any(x in material_lower for x in ['999', 'pure']):
            purity = 0.999
        
        if metal and metal in metal_prices:
            # Cena za gram (metal prices jsou obvykle za unci)
            price_per_ounce = metal_prices[metal].get('usd', 0)
            price_per_gram = price_per_ounce / 31.1035  # Převod z uncí na gramy
            
            material_value = weight * price_per_gram * purity
            
            # Přirážka pro numismatickou hodnotu (10-50%)
            numismatic_multiplier = 1.2
            
            return material_value * numismatic_multiplier
        
        return None
    
    def _get_historical_estimate(self, coin: Coin, db: Session) -> Optional[float]:
        """
        Odhad na základě historických dat podobných mincí
        """
        try:
            # Vyhledání podobných mincí v databázi
            similar_coins = db.query(Coin).filter(
                Coin.country == coin.country,
                Coin.currency == coin.currency,
                Coin.current_value.isnot(None)
            )
            
            if coin.year:
                # Mince z podobného období (±10 let)
                similar_coins = similar_coins.filter(
                    Coin.year.between(coin.year - 10, coin.year + 10)
                )
            
            similar_coins = similar_coins.limit(10).all()
            
            if similar_coins:
                values = [c.current_value for c in similar_coins if c.current_value]
                if values:
                    # Medián hodnot podobných mincí
                    values.sort()
                    median_value = values[len(values) // 2]
                    return median_value
            
            return None
            
        except Exception as e:
            logger.error(f"Historical estimate failed: {str(e)}")
            return None
    
    async def update_coin_prices(self, coin_ids: List[int], db: Session) -> Dict:
        """
        Aktualizace cen pro seznam mincí
        """
        results = {
            'updated': 0,
            'failed': 0,
            'errors': []
        }
        
        for coin_id in coin_ids:
            try:
                coin = db.query(Coin).filter(Coin.id == coin_id).first()
                if not coin:
                    continue
                
                # Odhad nové hodnoty
                value_estimate = await self.estimate_coin_value(coin, db)
                
                if value_estimate['success'] and value_estimate['estimated_value']:
                    # Aktualizace hodnoty mince
                    old_value = coin.current_value
                    coin.current_value = value_estimate['estimated_value']
                    
                    # Uložení do historie cen
                    price_history = PriceHistory(
                        coin_id=coin.id,
                        price=value_estimate['estimated_value'],
                        currency=value_estimate['currency'],
                        source=','.join(value_estimate['sources']),
                        confidence=value_estimate['confidence'],
                        previous_price=old_value,
                        created_at=datetime.utcnow()
                    )
                    
                    db.add(price_history)
                    db.commit()
                    
                    results['updated'] += 1
                    
                else:
                    results['failed'] += 1
                    if 'error' in value_estimate:
                        results['errors'].append(f"Coin {coin_id}: {value_estimate['error']}")
                
            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f"Coin {coin_id}: {str(e)}")
                logger.error(f"Failed to update price for coin {coin_id}: {str(e)}")
        
        return results
    
    async def get_price_trends(self, coin_id: int, db: Session, days: int = 30) -> Dict:
        """
        Získání cenových trendů pro minci
        """
        try:
            # Získání historických cen
            price_history = db.query(PriceHistory).filter(
                PriceHistory.coin_id == coin_id,
                PriceHistory.created_at >= datetime.utcnow() - timedelta(days=days)
            ).order_by(PriceHistory.created_at).all()
            
            if not price_history:
                return {
                    'success': False,
                    'error': 'Žádná historická data'
                }
            
            # Zpracování dat pro graf
            trend_data = []
            for record in price_history:
                trend_data.append({
                    'date': record.created_at.isoformat(),
                    'price': record.price,
                    'currency': record.currency,
                    'source': record.source,
                    'confidence': record.confidence
                })
            
            # Výpočet statistik
            prices = [record.price for record in price_history]
            current_price = prices[-1] if prices else 0
            min_price = min(prices) if prices else 0
            max_price = max(prices) if prices else 0
            avg_price = sum(prices) / len(prices) if prices else 0
            
            # Trend (růst/pokles)
            if len(prices) >= 2:
                price_change = prices[-1] - prices[0]
                price_change_percent = (price_change / prices[0]) * 100 if prices[0] > 0 else 0
            else:
                price_change = 0
                price_change_percent = 0
            
            return {
                'success': True,
                'trend_data': trend_data,
                'statistics': {
                    'current_price': current_price,
                    'min_price': min_price,
                    'max_price': max_price,
                    'avg_price': avg_price,
                    'price_change': price_change,
                    'price_change_percent': price_change_percent,
                    'data_points': len(trend_data)
                },
                'period_days': days
            }
            
        except Exception as e:
            logger.error(f"Failed to get price trends: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def clear_cache(self):
        """
        Vymazání cenové cache
        """
        self.price_cache.clear()
        logger.info("Price cache cleared")

# Singleton instance
price_service = PriceService()