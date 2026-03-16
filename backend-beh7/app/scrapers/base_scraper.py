import asyncio
import aiohttp
import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
from bs4 import BeautifulSoup
import json
import time
import random
from urllib.parse import urljoin, urlparse
import hashlib

@dataclass
class CoinListing:
    """Struktura pro reprezentaci mince z aukce"""
    title: str
    description: str
    price: Optional[float]
    currency: str
    auction_house: str
    auction_date: Optional[datetime]
    lot_number: str
    condition: Optional[str]
    material: Optional[str]
    year: Optional[int]
    country: Optional[str]
    denomination: Optional[str]
    images: List[str]
    url: str
    scraped_at: datetime
    hash_id: str

    def __post_init__(self):
        """Generuje hash ID pro unikátní identifikaci"""
        if not self.hash_id:
            content = f"{self.auction_house}_{self.lot_number}_{self.title}_{self.price}"
            self.hash_id = hashlib.md5(content.encode()).hexdigest()

@dataclass
class ScrapingResult:
    """Výsledek scrapingu"""
    success: bool
    listings: List[CoinListing]
    errors: List[str]
    total_found: int
    processing_time: float
    source: str

class BaseScraper(ABC):
    """Základní třída pro všechny scrapery"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.session: Optional[aiohttp.ClientSession] = None
        self.logger = logging.getLogger(f"{self.__class__.__name__}")
        self.rate_limit_delay = config.get('rate_limit_delay', 1.0)
        self.max_retries = config.get('max_retries', 3)
        self.timeout = config.get('timeout', 30)
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ]

    async def __aenter__(self):
        """Async context manager entry"""
        await self.start_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close_session()

    async def start_session(self):
        """Inicializuje HTTP session"""
        connector = aiohttp.TCPConnector(
            limit=10,
            limit_per_host=5,
            ttl_dns_cache=300,
            use_dns_cache=True
        )
        
        timeout = aiohttp.ClientTimeout(total=self.timeout)
        
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={
                'User-Agent': random.choice(self.user_agents),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'cs,en-US;q=0.7,en;q=0.3',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
        )

    async def close_session(self):
        """Uzavře HTTP session"""
        if self.session:
            await self.session.close()

    async def fetch_page(self, url: str, retries: int = 0) -> Optional[str]:
        """Stáhne stránku s retry logikou"""
        try:
            await asyncio.sleep(self.rate_limit_delay + random.uniform(0, 0.5))
            
            async with self.session.get(url) as response:
                if response.status == 200:
                    content = await response.text()
                    self.logger.debug(f"Successfully fetched: {url}")
                    return content
                elif response.status == 429:  # Rate limited
                    if retries < self.max_retries:
                        wait_time = (2 ** retries) + random.uniform(0, 1)
                        self.logger.warning(f"Rate limited, waiting {wait_time}s before retry")
                        await asyncio.sleep(wait_time)
                        return await self.fetch_page(url, retries + 1)
                else:
                    self.logger.error(f"HTTP {response.status} for {url}")
                    return None
                    
        except asyncio.TimeoutError:
            if retries < self.max_retries:
                self.logger.warning(f"Timeout for {url}, retrying...")
                return await self.fetch_page(url, retries + 1)
            else:
                self.logger.error(f"Max retries exceeded for {url}")
                return None
        except Exception as e:
            self.logger.error(f"Error fetching {url}: {str(e)}")
            return None

    def parse_html(self, html: str) -> BeautifulSoup:
        """Parsuje HTML pomocí BeautifulSoup"""
        return BeautifulSoup(html, 'html.parser')

    def extract_price(self, price_text: str) -> Optional[float]:
        """Extrahuje číselnou hodnotu z textu ceny"""
        if not price_text:
            return None
            
        # Odstraní whitespace a převede na lowercase
        price_text = price_text.strip().lower()
        
        # Hledá číselné hodnoty
        import re
        price_match = re.search(r'[\d\s]+(?:[.,]\d+)?', price_text.replace(' ', ''))
        
        if price_match:
            try:
                price_str = price_match.group().replace(' ', '').replace(',', '.')
                return float(price_str)
            except ValueError:
                return None
        
        return None

    def extract_year(self, text: str) -> Optional[int]:
        """Extrahuje rok z textu"""
        if not text:
            return None
            
        import re
        year_match = re.search(r'\b(1[5-9]\d{2}|20[0-2]\d)\b', text)
        
        if year_match:
            year = int(year_match.group())
            current_year = datetime.now().year
            if 1500 <= year <= current_year:
                return year
        
        return None

    def normalize_condition(self, condition_text: str) -> Optional[str]:
        """Normalizuje popis stavu mince"""
        if not condition_text:
            return None
            
        condition_text = condition_text.lower().strip()
        
        # Mapování běžných stavů
        condition_mapping = {
            'unc': 'MS-60',
            'bu': 'MS-60',
            'proof': 'MS-65',
            'xf': 'AU-50',
            'vf': 'VF-20',
            'f': 'F-12',
            'vg': 'G-4',
            'g': 'G-4',
            'poor': 'damaged',
            'perfektní': 'MS-70',
            'výborný': 'MS-65',
            'velmi dobrý': 'AU-50',
            'dobrý': 'VF-20',
            'poškozený': 'damaged'
        }
        
        for key, value in condition_mapping.items():
            if key in condition_text:
                return value
                
        return condition_text

    def extract_images(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Extrahuje URL obrázků"""
        images = []
        
        # Hledá img tagy s různými atributy
        img_tags = soup.find_all('img')
        
        for img in img_tags:
            src = img.get('src') or img.get('data-src') or img.get('data-lazy')
            if src:
                # Převede relativní URL na absolutní
                full_url = urljoin(base_url, src)
                if self.is_valid_image_url(full_url):
                    images.append(full_url)
        
        return list(set(images))  # Odstraní duplicity

    def is_valid_image_url(self, url: str) -> bool:
        """Ověří, zda je URL platný obrázek"""
        if not url:
            return False
            
        # Kontrola přípony
        valid_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
        url_lower = url.lower()
        
        return any(url_lower.endswith(ext) for ext in valid_extensions)

    @abstractmethod
    async def get_auction_urls(self) -> List[str]:
        """Získá seznam URL aukcí k scrapování"""
        pass

    @abstractmethod
    async def scrape_auction_page(self, url: str) -> List[CoinListing]:
        """Scrapuje jednu stránku aukce"""
        pass

    @abstractmethod
    def get_source_name(self) -> str:
        """Vrací název zdroje"""
        pass

    async def scrape_all(self) -> ScrapingResult:
        """Hlavní metoda pro scraping všech aukcí"""
        start_time = time.time()
        all_listings = []
        errors = []
        
        try:
            self.logger.info(f"Starting scraping for {self.get_source_name()}")
            
            # Získá seznam URL
            auction_urls = await self.get_auction_urls()
            self.logger.info(f"Found {len(auction_urls)} auction URLs")
            
            # Scrapuje každou aukci
            for url in auction_urls:
                try:
                    listings = await self.scrape_auction_page(url)
                    all_listings.extend(listings)
                    self.logger.info(f"Scraped {len(listings)} listings from {url}")
                    
                except Exception as e:
                    error_msg = f"Error scraping {url}: {str(e)}"
                    self.logger.error(error_msg)
                    errors.append(error_msg)
            
            processing_time = time.time() - start_time
            
            result = ScrapingResult(
                success=len(errors) == 0,
                listings=all_listings,
                errors=errors,
                total_found=len(all_listings),
                processing_time=processing_time,
                source=self.get_source_name()
            )
            
            self.logger.info(f"Scraping completed: {len(all_listings)} listings, {len(errors)} errors")
            return result
            
        except Exception as e:
            processing_time = time.time() - start_time
            error_msg = f"Critical error in scraping: {str(e)}"
            self.logger.error(error_msg)
            
            return ScrapingResult(
                success=False,
                listings=[],
                errors=[error_msg],
                total_found=0,
                processing_time=processing_time,
                source=self.get_source_name()
            )

    async def test_connection(self) -> bool:
        """Testuje připojení k webu"""
        try:
            test_urls = await self.get_auction_urls()
            if test_urls:
                test_url = test_urls[0]
                content = await self.fetch_page(test_url)
                return content is not None
            return False
        except Exception as e:
            self.logger.error(f"Connection test failed: {str(e)}")
            return False

# Utility funkce pro práci se scrapery
class ScraperManager:
    """Správce všech scraperů"""
    
    def __init__(self):
        self.scrapers = {}
        self.logger = logging.getLogger("ScraperManager")

    def register_scraper(self, name: str, scraper_class, config: Dict[str, Any]):
        """Registruje nový scraper"""
        self.scrapers[name] = {
            'class': scraper_class,
            'config': config
        }

    async def run_all_scrapers(self) -> Dict[str, ScrapingResult]:
        """Spustí všechny registrované scrapery"""
        results = {}
        
        for name, scraper_info in self.scrapers.items():
            try:
                self.logger.info(f"Running scraper: {name}")
                
                async with scraper_info['class'](scraper_info['config']) as scraper:
                    result = await scraper.scrape_all()
                    results[name] = result
                    
            except Exception as e:
                self.logger.error(f"Error running scraper {name}: {str(e)}")
                results[name] = ScrapingResult(
                    success=False,
                    listings=[],
                    errors=[str(e)],
                    total_found=0,
                    processing_time=0,
                    source=name
                )
        
        return results

    async def run_scraper(self, name: str) -> Optional[ScrapingResult]:
        """Spustí konkrétní scraper"""
        if name not in self.scrapers:
            self.logger.error(f"Scraper {name} not found")
            return None
            
        try:
            scraper_info = self.scrapers[name]
            async with scraper_info['class'](scraper_info['config']) as scraper:
                return await scraper.scrape_all()
                
        except Exception as e:
            self.logger.error(f"Error running scraper {name}: {str(e)}")
            return ScrapingResult(
                success=False,
                listings=[],
                errors=[str(e)],
                total_found=0,
                processing_time=0,
                source=name
            )