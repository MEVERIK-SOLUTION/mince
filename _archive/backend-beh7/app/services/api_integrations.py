import asyncio
import aiohttp
import json
from typing import List, Dict, Optional, Any, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import logging
from abc import ABC, abstractmethod
import hashlib
import re
from urllib.parse import urljoin, quote

@dataclass
class CoinData:
    """Standardizovaná struktura dat o minci"""
    name: str
    country: str
    year: Optional[int]
    denomination: Optional[str]
    material: str
    weight: Optional[float]
    diameter: Optional[float]
    mintage: Optional[int]
    condition: Optional[str]
    current_value: Optional[float]
    currency: str
    description: str
    images: List[str]
    catalog_numbers: Dict[str, str]  # {"krause": "KM#123", "schön": "S#456"}
    rarity_score: Optional[float]
    historical_prices: List[Dict[str, Any]]
    source: str
    last_updated: datetime
    confidence_score: float  # 0-1, jak moc důvěryhodná jsou data

@dataclass
class APIConfig:
    """Konfigurace pro API"""
    name: str
    base_url: str
    api_key: Optional[str]
    rate_limit: int  # requests per minute
    timeout: int = 30
    headers: Dict[str, str] = None
    auth_type: str = "api_key"  # api_key, bearer, basic

class BaseAPI(ABC):
    """Základní třída pro API integrace"""
    
    def __init__(self, config: APIConfig):
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{config.name}")
        self.session: Optional[aiohttp.ClientSession] = None
        self.rate_limiter = asyncio.Semaphore(config.rate_limit)
        self.last_request_time = 0
        
    async def __aenter__(self):
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cleanup()
    
    async def initialize(self):
        """Inicializuje HTTP session"""
        headers = self.config.headers or {}
        
        if self.config.auth_type == "api_key" and self.config.api_key:
            headers["X-API-Key"] = self.config.api_key
        elif self.config.auth_type == "bearer" and self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        
        timeout = aiohttp.ClientTimeout(total=self.config.timeout)
        self.session = aiohttp.ClientSession(
            headers=headers,
            timeout=timeout
        )
    
    async def cleanup(self):
        """Ukončí HTTP session"""
        if self.session:
            await self.session.close()
    
    async def make_request(self, endpoint: str, params: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """Provede HTTP request s rate limiting"""
        async with self.rate_limiter:
            try:
                # Rate limiting - minimální interval mezi requesty
                current_time = asyncio.get_event_loop().time()
                time_since_last = current_time - self.last_request_time
                min_interval = 60 / self.config.rate_limit
                
                if time_since_last < min_interval:
                    await asyncio.sleep(min_interval - time_since_last)
                
                url = urljoin(self.config.base_url, endpoint)
                
                async with self.session.get(url, params=params) as response:
                    self.last_request_time = asyncio.get_event_loop().time()
                    
                    if response.status == 200:
                        return await response.json()
                    elif response.status == 429:  # Rate limit exceeded
                        self.logger.warning(f"Rate limit exceeded for {self.config.name}")
                        await asyncio.sleep(60)  # Wait 1 minute
                        return await self.make_request(endpoint, params)
                    else:
                        self.logger.error(f"API error {response.status}: {await response.text()}")
                        return None
                        
            except Exception as e:
                self.logger.error(f"Request failed: {str(e)}")
                return None
    
    @abstractmethod
    async def search_coin(self, query: str, filters: Dict[str, Any] = None) -> List[CoinData]:
        """Vyhledá mince podle dotazu"""
        pass
    
    @abstractmethod
    async def get_coin_details(self, coin_id: str) -> Optional[CoinData]:
        """Získá detaily konkrétní mince"""
        pass
    
    @abstractmethod
    async def get_price_history(self, coin_id: str, days: int = 365) -> List[Dict[str, Any]]:
        """Získá historii cen mince"""
        pass

class NumistaAPI(BaseAPI):
    """Integrace s Numista API (numista.com)"""
    
    def __init__(self, api_key: str):
        config = APIConfig(
            name="Numista",
            base_url="https://api.numista.com/",
            api_key=api_key,
            rate_limit=60,  # 60 requests per minute
            headers={"Accept": "application/json"}
        )
        super().__init__(config)
    
    async def search_coin(self, query: str, filters: Dict[str, Any] = None) -> List[CoinData]:
        """Vyhledá mince v Numista databázi"""
        try:
            params = {
                "q": query,
                "format": "json",
                "limit": 50
            }
            
            if filters:
                if "country" in filters:
                    params["country"] = filters["country"]
                if "year_from" in filters:
                    params["year_from"] = filters["year_from"]
                if "year_to" in filters:
                    params["year_to"] = filters["year_to"]
                if "material" in filters:
                    params["composition"] = filters["material"]
            
            response = await self.make_request("coins/search", params)
            if not response:
                return []
            
            coins = []
            for item in response.get("results", []):
                coin_data = await self._parse_numista_coin(item)
                if coin_data:
                    coins.append(coin_data)
            
            return coins
            
        except Exception as e:
            self.logger.error(f"Error searching Numista: {str(e)}")
            return []
    
    async def get_coin_details(self, coin_id: str) -> Optional[CoinData]:
        """Získá detaily mince z Numista"""
        try:
            response = await self.make_request(f"coins/{coin_id}")
            if response:
                return await self._parse_numista_coin(response)
            return None
            
        except Exception as e:
            self.logger.error(f"Error getting Numista coin details: {str(e)}")
            return None
    
    async def get_price_history(self, coin_id: str, days: int = 365) -> List[Dict[str, Any]]:
        """Získá historii cen z Numista"""
        try:
            params = {
                "days": days,
                "format": "json"
            }
            
            response = await self.make_request(f"coins/{coin_id}/prices", params)
            if not response:
                return []
            
            return response.get("prices", [])
            
        except Exception as e:
            self.logger.error(f"Error getting Numista price history: {str(e)}")
            return []
    
    async def _parse_numista_coin(self, data: Dict[str, Any]) -> Optional[CoinData]:
        """Parsuje data mince z Numista API"""
        try:
            return CoinData(
                name=data.get("title", ""),
                country=data.get("issuer", {}).get("name", ""),
                year=data.get("min_year"),
                denomination=data.get("face_value", ""),
                material=self._parse_composition(data.get("composition", [])),
                weight=data.get("weight"),
                diameter=data.get("size"),
                mintage=data.get("mintage"),
                condition=None,
                current_value=data.get("price", {}).get("value"),
                currency=data.get("price", {}).get("currency", "USD"),
                description=data.get("description", ""),
                images=[img.get("url", "") for img in data.get("images", [])],
                catalog_numbers={
                    "numista": str(data.get("id", "")),
                    "krause": data.get("krause_number", ""),
                    "schön": data.get("schon_number", "")
                },
                rarity_score=self._calculate_rarity_score(data),
                historical_prices=[],
                source="Numista",
                last_updated=datetime.now(),
                confidence_score=0.9
            )
            
        except Exception as e:
            self.logger.error(f"Error parsing Numista coin: {str(e)}")
            return None
    
    def _parse_composition(self, composition: List[Dict[str, Any]]) -> str:
        """Parsuje složení materiálu"""
        if not composition:
            return "Unknown"
        
        materials = []
        for comp in composition:
            material = comp.get("material", {}).get("name", "")
            percentage = comp.get("percentage")
            if material:
                if percentage:
                    materials.append(f"{material} ({percentage}%)")
                else:
                    materials.append(material)
        
        return ", ".join(materials) if materials else "Unknown"
    
    def _calculate_rarity_score(self, data: Dict[str, Any]) -> float:
        """Vypočítá skóre vzácnosti"""
        score = 0.5  # základní skóre
        
        mintage = data.get("mintage")
        if mintage:
            if mintage < 1000:
                score += 0.4
            elif mintage < 10000:
                score += 0.3
            elif mintage < 100000:
                score += 0.2
            elif mintage < 1000000:
                score += 0.1
        
        # Věk mince
        year = data.get("min_year")
        if year:
            age = datetime.now().year - year
            if age > 100:
                score += 0.1
        
        return min(score, 1.0)

class CoinGeckoAPI(BaseAPI):
    """Integrace s CoinGecko API pro kryptoměny a některé fyzické mince"""
    
    def __init__(self, api_key: Optional[str] = None):
        config = APIConfig(
            name="CoinGecko",
            base_url="https://api.coingecko.com/api/v3/",
            api_key=api_key,
            rate_limit=50 if api_key else 10,  # Pro API s klíčem vyšší limit
            headers={"Accept": "application/json"}
        )
        super().__init__(config)
    
    async def search_coin(self, query: str, filters: Dict[str, Any] = None) -> List[CoinData]:
        """Vyhledá mince v CoinGecko"""
        try:
            params = {"query": query}
            response = await self.make_request("search", params)
            
            if not response:
                return []
            
            coins = []
            for item in response.get("coins", []):
                # CoinGecko je primárně pro krypto, ale má i některé fyzické mince
                if self._is_physical_coin(item):
                    coin_data = await self._parse_coingecko_coin(item)
                    if coin_data:
                        coins.append(coin_data)
            
            return coins
            
        except Exception as e:
            self.logger.error(f"Error searching CoinGecko: {str(e)}")
            return []
    
    async def get_coin_details(self, coin_id: str) -> Optional[CoinData]:
        """Získá detaily mince z CoinGecko"""
        try:
            response = await self.make_request(f"coins/{coin_id}")
            if response and self._is_physical_coin(response):
                return await self._parse_coingecko_coin(response)
            return None
            
        except Exception as e:
            self.logger.error(f"Error getting CoinGecko coin details: {str(e)}")
            return None
    
    async def get_price_history(self, coin_id: str, days: int = 365) -> List[Dict[str, Any]]:
        """Získá historii cen z CoinGecko"""
        try:
            params = {
                "vs_currency": "usd",
                "days": days
            }
            
            response = await self.make_request(f"coins/{coin_id}/market_chart", params)
            if not response:
                return []
            
            prices = []
            for timestamp, price in response.get("prices", []):
                prices.append({
                    "date": datetime.fromtimestamp(timestamp / 1000),
                    "price": price,
                    "currency": "USD"
                })
            
            return prices
            
        except Exception as e:
            self.logger.error(f"Error getting CoinGecko price history: {str(e)}")
            return []
    
    def _is_physical_coin(self, data: Dict[str, Any]) -> bool:
        """Určí, zda se jedná o fyzickou minci"""
        name = data.get("name", "").lower()
        symbol = data.get("symbol", "").lower()
        
        # Klíčová slova pro fyzické mince
        physical_keywords = [
            "gold", "silver", "platinum", "palladium",
            "bullion", "coin", "eagle", "maple", "krugerrand",
            "britannia", "panda", "philharmonic"
        ]
        
        return any(keyword in name or keyword in symbol for keyword in physical_keywords)
    
    async def _parse_coingecko_coin(self, data: Dict[str, Any]) -> Optional[CoinData]:
        """Parsuje data mince z CoinGecko API"""
        try:
            return CoinData(
                name=data.get("name", ""),
                country=self._extract_country_from_name(data.get("name", "")),
                year=None,  # CoinGecko obvykle neobsahuje rok
                denomination=data.get("symbol", "").upper(),
                material=self._extract_material_from_name(data.get("name", "")),
                weight=None,
                diameter=None,
                mintage=None,
                condition=None,
                current_value=data.get("market_data", {}).get("current_price", {}).get("usd"),
                currency="USD",
                description=data.get("description", {}).get("en", ""),
                images=[data.get("image", {}).get("large", "")],
                catalog_numbers={"coingecko": data.get("id", "")},
                rarity_score=None,
                historical_prices=[],
                source="CoinGecko",
                last_updated=datetime.now(),
                confidence_score=0.7  # Nižší pro fyzické mince na CoinGecko
            )
            
        except Exception as e:
            self.logger.error(f"Error parsing CoinGecko coin: {str(e)}")
            return None
    
    def _extract_country_from_name(self, name: str) -> str:
        """Extrahuje zemi z názvu mince"""
        name_lower = name.lower()
        
        countries = {
            "american": "US", "eagle": "US", "liberty": "US",
            "canadian": "CA", "maple": "CA",
            "australian": "AU", "kangaroo": "AU",
            "british": "GB", "britannia": "GB",
            "south african": "ZA", "krugerrand": "ZA",
            "austrian": "AT", "philharmonic": "AT",
            "chinese": "CN", "panda": "CN"
        }
        
        for keyword, country_code in countries.items():
            if keyword in name_lower:
                return country_code
        
        return "Unknown"
    
    def _extract_material_from_name(self, name: str) -> str:
        """Extrahuje materiál z názvu"""
        name_lower = name.lower()
        
        if "gold" in name_lower:
            return "Gold"
        elif "silver" in name_lower:
            return "Silver"
        elif "platinum" in name_lower:
            return "Platinum"
        elif "palladium" in name_lower:
            return "Palladium"
        
        return "Unknown"

class UCoinAPI(BaseAPI):
    """Integrace s uCoin.net API"""
    
    def __init__(self, api_key: Optional[str] = None):
        config = APIConfig(
            name="uCoin",
            base_url="https://ucoin.net/api/v2/",
            api_key=api_key,
            rate_limit=30,
            headers={"Accept": "application/json"}
        )
        super().__init__(config)
    
    async def search_coin(self, query: str, filters: Dict[str, Any] = None) -> List[CoinData]:
        """Vyhledá mince v uCoin databázi"""
        try:
            params = {
                "search": query,
                "limit": 50
            }
            
            if filters:
                if "country" in filters:
                    params["country"] = filters["country"]
                if "year" in filters:
                    params["year"] = filters["year"]
            
            response = await self.make_request("coins/search", params)
            if not response:
                return []
            
            coins = []
            for item in response.get("coins", []):
                coin_data = await self._parse_ucoin_coin(item)
                if coin_data:
                    coins.append(coin_data)
            
            return coins
            
        except Exception as e:
            self.logger.error(f"Error searching uCoin: {str(e)}")
            return []
    
    async def get_coin_details(self, coin_id: str) -> Optional[CoinData]:
        """Získá detaily mince z uCoin"""
        try:
            response = await self.make_request(f"coins/{coin_id}")
            if response:
                return await self._parse_ucoin_coin(response)
            return None
            
        except Exception as e:
            self.logger.error(f"Error getting uCoin coin details: {str(e)}")
            return None
    
    async def get_price_history(self, coin_id: str, days: int = 365) -> List[Dict[str, Any]]:
        """uCoin nemá price history API"""
        return []
    
    async def _parse_ucoin_coin(self, data: Dict[str, Any]) -> Optional[CoinData]:
        """Parsuje data mince z uCoin API"""
        try:
            return CoinData(
                name=data.get("title", ""),
                country=data.get("country", {}).get("name", ""),
                year=data.get("year"),
                denomination=data.get("denomination", ""),
                material=data.get("material", ""),
                weight=data.get("weight"),
                diameter=data.get("diameter"),
                mintage=data.get("mintage"),
                condition=None,
                current_value=data.get("price"),
                currency=data.get("currency", "USD"),
                description=data.get("description", ""),
                images=[img.get("url", "") for img in data.get("images", [])],
                catalog_numbers={
                    "ucoin": str(data.get("id", "")),
                    "krause": data.get("krause", "")
                },
                rarity_score=data.get("rarity_score"),
                historical_prices=[],
                source="uCoin",
                last_updated=datetime.now(),
                confidence_score=0.8
            )
            
        except Exception as e:
            self.logger.error(f"Error parsing uCoin coin: {str(e)}")
            return None

class CoinArchivesAPI(BaseAPI):
    """Integrace s CoinArchives.com API pro aukční data"""
    
    def __init__(self, api_key: str):
        config = APIConfig(
            name="CoinArchives",
            base_url="https://www.coinarchives.com/api/",
            api_key=api_key,
            rate_limit=20,
            headers={"Accept": "application/json"}
        )
        super().__init__(config)
    
    async def search_coin(self, query: str, filters: Dict[str, Any] = None) -> List[CoinData]:
        """Vyhledá mince v CoinArchives"""
        try:
            params = {
                "q": query,
                "format": "json",
                "limit": 50
            }
            
            if filters:
                if "price_min" in filters:
                    params["price_min"] = filters["price_min"]
                if "price_max" in filters:
                    params["price_max"] = filters["price_max"]
                if "date_from" in filters:
                    params["date_from"] = filters["date_from"]
                if "date_to" in filters:
                    params["date_to"] = filters["date_to"]
            
            response = await self.make_request("search", params)
            if not response:
                return []
            
            coins = []
            for item in response.get("results", []):
                coin_data = await self._parse_coinarchives_coin(item)
                if coin_data:
                    coins.append(coin_data)
            
            return coins
            
        except Exception as e:
            self.logger.error(f"Error searching CoinArchives: {str(e)}")
            return []
    
    async def get_coin_details(self, coin_id: str) -> Optional[CoinData]:
        """Získá detaily mince z CoinArchives"""
        try:
            response = await self.make_request(f"lots/{coin_id}")
            if response:
                return await self._parse_coinarchives_coin(response)
            return None
            
        except Exception as e:
            self.logger.error(f"Error getting CoinArchives coin details: {str(e)}")
            return None
    
    async def get_price_history(self, coin_id: str, days: int = 365) -> List[Dict[str, Any]]:
        """Získá historii prodejů z CoinArchives"""
        try:
            params = {
                "coin_id": coin_id,
                "days": days
            }
            
            response = await self.make_request("price_history", params)
            if not response:
                return []
            
            return response.get("sales", [])
            
        except Exception as e:
            self.logger.error(f"Error getting CoinArchives price history: {str(e)}")
            return []
    
    async def _parse_coinarchives_coin(self, data: Dict[str, Any]) -> Optional[CoinData]:
        """Parsuje data mince z CoinArchives API"""
        try:
            return CoinData(
                name=data.get("description", ""),
                country=data.get("country", ""),
                year=data.get("year"),
                denomination=data.get("denomination", ""),
                material=data.get("metal", ""),
                weight=None,
                diameter=None,
                mintage=None,
                condition=data.get("grade", ""),
                current_value=data.get("realized_price"),
                currency=data.get("currency", "USD"),
                description=data.get("full_description", ""),
                images=[img.get("url", "") for img in data.get("images", [])],
                catalog_numbers={
                    "coinarchives": str(data.get("lot_id", "")),
                    "krause": data.get("krause_number", "")
                },
                rarity_score=None,
                historical_prices=data.get("price_history", []),
                source="CoinArchives",
                last_updated=datetime.now(),
                confidence_score=0.95  # Vysoká důvěryhodnost pro aukční data
            )
            
        except Exception as e:
            self.logger.error(f"Error parsing CoinArchives coin: {str(e)}")
            return None

class APIAggregator:
    """Agregátor pro kombinování dat z více API"""
    
    def __init__(self):
        self.apis: List[BaseAPI] = []
        self.logger = logging.getLogger(__name__)
    
    def add_api(self, api: BaseAPI):
        """Přidá API do agregátoru"""
        self.apis.append(api)
    
    async def search_coins(self, query: str, filters: Dict[str, Any] = None) -> List[CoinData]:
        """Vyhledá mince napříč všemi API"""
        all_coins = []
        
        # Paralelní vyhledávání ve všech API
        tasks = []
        for api in self.apis:
            task = asyncio.create_task(api.search_coin(query, filters))
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                self.logger.error(f"API {self.apis[i].config.name} failed: {str(result)}")
            elif isinstance(result, list):
                all_coins.extend(result)
        
        # Deduplikace a řazení podle confidence score
        unique_coins = self._deduplicate_coins(all_coins)
        return sorted(unique_coins, key=lambda x: x.confidence_score, reverse=True)
    
    async def get_comprehensive_coin_data(self, coin_identifiers: Dict[str, str]) -> Optional[CoinData]:
        """Získá kompletní data o minci z více zdrojů"""
        coin_data_list = []
        
        # Získá data z každého API
        for api in self.apis:
            api_name = api.config.name.lower()
            if api_name in coin_identifiers:
                coin_id = coin_identifiers[api_name]
                try:
                    coin_data = await api.get_coin_details(coin_id)
                    if coin_data:
                        coin_data_list.append(coin_data)
                except Exception as e:
                    self.logger.error(f"Error getting data from {api_name}: {str(e)}")
        
        if not coin_data_list:
            return None
        
        # Sloučí data z více zdrojů
        return self._merge_coin_data(coin_data_list)
    
    def _deduplicate_coins(self, coins: List[CoinData]) -> List[CoinData]:
        """Odstraní duplicitní mince"""
        seen_hashes = set()
        unique_coins = []
        
        for coin in coins:
            # Vytvoří hash z klíčových vlastností
            coin_hash = self._create_coin_hash(coin)
            if coin_hash not in seen_hashes:
                seen_hashes.add(coin_hash)
                unique_coins.append(coin)
        
        return unique_coins
    
    def _create_coin_hash(self, coin: CoinData) -> str:
        """Vytvoří hash pro identifikaci mince"""
        key_data = f"{coin.name}_{coin.country}_{coin.year}_{coin.denomination}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def _merge_coin_data(self, coin_data_list: List[CoinData]) -> CoinData:
        """Sloučí data o minci z více zdrojů"""
        if len(coin_data_list) == 1:
            return coin_data_list[0]
        
        # Vezme první minci jako základ
        merged = coin_data_list[0]
        
        # Sloučí data z ostatních zdrojů
        for coin in coin_data_list[1:]:
            # Doplní chybějící informace
            if not merged.weight and coin.weight:
                merged.weight = coin.weight
            if not merged.diameter and coin.diameter:
                merged.diameter = coin.diameter
            if not merged.mintage and coin.mintage:
                merged.mintage = coin.mintage
            if not merged.current_value and coin.current_value:
                merged.current_value = coin.current_value
            
            # Sloučí obrázky
            for image in coin.images:
                if image and image not in merged.images:
                    merged.images.append(image)
            
            # Sloučí katalogová čísla
            merged.catalog_numbers.update(coin.catalog_numbers)
            
            # Sloučí historické ceny
            merged.historical_prices.extend(coin.historical_prices)
            
            # Aktualizuje confidence score (průměr)
            merged.confidence_score = (merged.confidence_score + coin.confidence_score) / 2
        
        # Aktualizuje zdroj
        sources = [coin.source for coin in coin_data_list]
        merged.source = ", ".join(set(sources))
        
        return merged

# Factory funkce pro vytvoření API instancí
def create_api_aggregator() -> APIAggregator:
    """Vytvoří agregátor s nakonfigurovanými API"""
    aggregator = APIAggregator()
    
    # Numista API
    numista_key = os.getenv("NUMISTA_API_KEY")
    if numista_key:
        aggregator.add_api(NumistaAPI(numista_key))
    
    # CoinGecko API
    coingecko_key = os.getenv("COINGECKO_API_KEY")
    aggregator.add_api(CoinGeckoAPI(coingecko_key))
    
    # uCoin API
    ucoin_key = os.getenv("UCOIN_API_KEY")
    if ucoin_key:
        aggregator.add_api(UCoinAPI(ucoin_key))
    
    # CoinArchives API
    coinarchives_key = os.getenv("COINARCHIVES_API_KEY")
    if coinarchives_key:
        aggregator.add_api(CoinArchivesAPI(coinarchives_key))
    
    return aggregator

# Příklad použití
async def example_usage():
    """Příklad použití API agregátoru"""
    aggregator = create_api_aggregator()
    
    # Inicializace všech API
    for api in aggregator.apis:
        await api.initialize()
    
    try:
        # Vyhledání mincí
        coins = await aggregator.search_coins(
            query="1 koruna 1932",
            filters={"country": "CZ", "year_from": 1930, "year_to": 1935}
        )
        
        print(f"Found {len(coins)} coins")
        for coin in coins[:5]:  # Prvních 5 výsledků
            print(f"- {coin.name} ({coin.source}) - {coin.confidence_score}")
        
        # Získání kompletních dat
        if coins:
            comprehensive_data = await aggregator.get_comprehensive_coin_data({
                "numista": "12345",
                "ucoin": "67890"
            })
            
            if comprehensive_data:
                print(f"Comprehensive data: {comprehensive_data.name}")
    
    finally:
        # Ukončení všech API
        for api in aggregator.apis:
            await api.cleanup()

if __name__ == "__main__":
    import os
    asyncio.run(example_usage())