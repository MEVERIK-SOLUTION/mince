import asyncio
import re
from typing import List, Optional
from datetime import datetime
from urllib.parse import urljoin, urlparse
from .base_scraper import BaseScraper, CoinListing

class AntiumScraper(BaseScraper):
    """Scraper pro Antium aukce (antium.cz)"""
    
    def __init__(self, config):
        super().__init__(config)
        self.base_url = "https://www.antium.cz"
        self.auction_list_url = f"{self.base_url}/aukce"
        
    def get_source_name(self) -> str:
        return "Antium Aukce"

    async def get_auction_urls(self) -> List[str]:
        """Získá seznam aktivních aukcí"""
        auction_urls = []
        
        try:
            # Stáhne hlavní stránku aukcí
            content = await self.fetch_page(self.auction_list_url)
            if not content:
                return []
            
            soup = self.parse_html(content)
            
            # Hledá odkazy na aukce - Antium má specifickou strukturu
            auction_containers = soup.find_all(['div', 'article'], class_=re.compile(r'auction|aukce'))
            
            for container in auction_containers:
                links = container.find_all('a', href=True)
                for link in links:
                    href = link.get('href')
                    if href and ('/aukce/' in href or '/auction/' in href):
                        full_url = urljoin(self.base_url, href)
                        if full_url not in auction_urls:
                            auction_urls.append(full_url)
            
            # Pokud nenašel specifické kontejnery, hledá obecně
            if not auction_urls:
                all_links = soup.find_all('a', href=re.compile(r'/aukce/|/auction/'))
                for link in all_links:
                    href = link.get('href')
                    if href:
                        full_url = urljoin(self.base_url, href)
                        if full_url not in auction_urls:
                            auction_urls.append(full_url)
            
            # Omezí na posledních 5 aukcí
            return auction_urls[:5]
            
        except Exception as e:
            self.logger.error(f"Error getting auction URLs: {str(e)}")
            return []

    async def scrape_auction_page(self, auction_url: str) -> List[CoinListing]:
        """Scrapuje jednu aukci"""
        listings = []
        
        try:
            # Stáhne stránku aukce
            content = await self.fetch_page(auction_url)
            if not content:
                return []
            
            soup = self.parse_html(content)
            
            # Extrahuje informace o aukci
            auction_info = self.extract_auction_info(soup)
            
            # Antium může mít více stránek - hledá paginaci
            all_pages = await self.get_all_auction_pages(auction_url, soup)
            
            for page_url in all_pages:
                page_listings = await self.scrape_single_page(page_url, auction_info)
                listings.extend(page_listings)
            
        except Exception as e:
            self.logger.error(f"Error scraping auction {auction_url}: {str(e)}")
        
        return listings

    async def get_all_auction_pages(self, base_url: str, soup) -> List[str]:
        """Získá všechny stránky aukce (pagination)"""
        pages = [base_url]
        
        try:
            # Hledá pagination odkazy
            pagination = soup.find(['div', 'nav'], class_=re.compile(r'pag|page'))
            
            if pagination:
                page_links = pagination.find_all('a', href=True)
                for link in page_links:
                    href = link.get('href')
                    if href and re.search(r'page=\d+|strana=\d+', href):
                        full_url = urljoin(base_url, href)
                        if full_url not in pages:
                            pages.append(full_url)
            
            # Omezí na maximálně 10 stránek
            return pages[:10]
            
        except Exception as e:
            self.logger.warning(f"Error getting pagination: {str(e)}")
            return [base_url]

    async def scrape_single_page(self, page_url: str, auction_info: dict) -> List[CoinListing]:
        """Scrapuje jednu stránku aukce"""
        listings = []
        
        try:
            if page_url != auction_info.get('base_url'):
                content = await self.fetch_page(page_url)
                if not content:
                    return []
                soup = self.parse_html(content)
            else:
                soup = auction_info.get('soup')
            
            # Hledá položky aukce - Antium specifické selektory
            lot_selectors = [
                'div.lot-item',
                'div.auction-item', 
                'article.lot',
                'tr.lot-row',
                'div[data-lot]',
                '.item-card'
            ]
            
            lot_items = []
            for selector in lot_selectors:
                items = soup.select(selector)
                if items:
                    lot_items = items
                    break
            
            # Pokud nenašel specifické selektory, hledá obecně
            if not lot_items:
                lot_items = soup.find_all('div', class_=re.compile(r'item|lot|product'))
            
            for item in lot_items:
                try:
                    listing = await self.parse_lot_item(item, page_url, auction_info)
                    if listing:
                        listings.append(listing)
                except Exception as e:
                    self.logger.warning(f"Error parsing lot item: {str(e)}")
                    continue
            
        except Exception as e:
            self.logger.error(f"Error scraping page {page_url}: {str(e)}")
        
        return listings

    def extract_auction_info(self, soup) -> dict:
        """Extrahuje základní informace o aukci"""
        info = {
            'date': None,
            'title': None,
            'soup': soup,
            'base_url': None
        }
        
        try:
            # Hledá datum aukce - Antium formáty
            date_patterns = [
                r'(\d{1,2})\.(\d{1,2})\.(\d{4})',
                r'(\d{4})-(\d{1,2})-(\d{1,2})',
                r'(\d{1,2})/(\d{1,2})/(\d{4})'
            ]
            
            page_text = soup.get_text()
            for pattern in date_patterns:
                date_matches = re.findall(pattern, page_text)
                for match in date_matches:
                    try:
                        if '.' in pattern:  # DD.MM.YYYY
                            day, month, year = match
                        elif '-' in pattern:  # YYYY-MM-DD
                            year, month, day = match
                        else:  # DD/MM/YYYY
                            day, month, year = match
                            
                        info['date'] = datetime(int(year), int(month), int(day))
                        break
                    except ValueError:
                        continue
                if info['date']:
                    break
            
            # Hledá název aukce
            title_selectors = ['h1', '.auction-title', '.page-title', 'title']
            for selector in title_selectors:
                title_element = soup.select_one(selector)
                if title_element:
                    info['title'] = title_element.get_text(strip=True)
                    break
                
        except Exception as e:
            self.logger.warning(f"Error extracting auction info: {str(e)}")
        
        return info

    async def parse_lot_item(self, item_soup, page_url: str, auction_info: dict) -> Optional[CoinListing]:
        """Parsuje jednotlivou položku aukce"""
        try:
            # Extrahuje název - více možností pro Antium
            title_selectors = [
                '.lot-title', '.item-title', '.product-title',
                'h3', 'h4', 'h5', '.title', 'a[title]'
            ]
            
            title = None
            for selector in title_selectors:
                title_element = item_soup.select_one(selector)
                if title_element:
                    title = title_element.get_text(strip=True)
                    if title:
                        break
            
            if not title:
                # Fallback - vezme první link nebo text
                link = item_soup.find('a')
                if link:
                    title = link.get('title') or link.get_text(strip=True)
                else:
                    title = item_soup.get_text(strip=True)[:100]
            
            if not title or len(title) < 3:
                return None
            
            # Extrahuje popis
            description_selectors = [
                '.lot-description', '.item-description', '.description',
                'p', '.details', '.lot-details'
            ]
            
            description = title  # Default
            for selector in description_selectors:
                desc_element = item_soup.select_one(selector)
                if desc_element:
                    desc_text = desc_element.get_text(strip=True)
                    if len(desc_text) > len(description):
                        description = desc_text
            
            # Extrahuje číslo lotu
            lot_number = self.extract_lot_number(item_soup, title)
            
            # Extrahuje cenu - Antium specifické
            price, currency = self.extract_price_and_currency(item_soup)
            
            # Extrahuje obrázky
            images = self.extract_images(item_soup, self.base_url)
            
            # Extrahuje URL položky
            item_url = self.extract_item_url(item_soup, page_url)
            
            # Extrahuje další informace z textu
            full_text = item_soup.get_text()
            year = self.extract_year(full_text)
            condition = self.extract_condition_from_text(full_text)
            material = self.extract_material_from_text(full_text)
            country = self.extract_country_from_text(full_text)
            denomination = self.extract_denomination_from_text(full_text)
            
            return CoinListing(
                title=title,
                description=description,
                price=price,
                currency=currency,
                auction_house=self.get_source_name(),
                auction_date=auction_info.get('date'),
                lot_number=lot_number,
                condition=condition,
                material=material,
                year=year,
                country=country,
                denomination=denomination,
                images=images,
                url=item_url,
                scraped_at=datetime.now(),
                hash_id=""
            )
            
        except Exception as e:
            self.logger.warning(f"Error parsing lot item: {str(e)}")
            return None

    def extract_lot_number(self, item_soup, title: str) -> str:
        """Extrahuje číslo lotu - Antium specifické"""
        # Hledá v data atributech
        lot_attrs = ['data-lot', 'data-lot-id', 'data-id', 'id', 'data-item-id']
        for attr in lot_attrs:
            value = item_soup.get(attr)
            if value and str(value).isdigit():
                return str(value)
        
        # Hledá v CSS třídách
        classes = item_soup.get('class', [])
        for cls in classes:
            if 'lot-' in cls:
                lot_match = re.search(r'lot-(\d+)', cls)
                if lot_match:
                    return lot_match.group(1)
        
        # Hledá v textu
        lot_patterns = [
            r'(?:lot|položka|č\.?)\s*(\d+)',
            r'(\d+)\s*(?:lot|položka)',
            r'#(\d+)',
            r'ID:\s*(\d+)'
        ]
        
        for pattern in lot_patterns:
            match = re.search(pattern, title.lower())
            if match:
                return match.group(1)
        
        # Fallback
        import hashlib
        return hashlib.md5(title.encode()).hexdigest()[:8]

    def extract_price_and_currency(self, item_soup) -> tuple[Optional[float], str]:
        """Extrahuje cenu a měnu - Antium specifické"""
        price = None
        currency = 'CZK'
        
        # Hledá cenové elementy
        price_selectors = [
            '.price', '.lot-price', '.current-price', '.bid-price',
            '.amount', '.cost', '[data-price]'
        ]
        
        price_text = None
        for selector in price_selectors:
            price_element = item_soup.select_one(selector)
            if price_element:
                price_text = price_element.get_text(strip=True)
                break
        
        # Pokud nenašel specifický element, hledá v textu
        if not price_text:
            full_text = item_soup.get_text()
            price_patterns = [
                r'(\d+(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:Kč|CZK)',
                r'(\d+(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:€|EUR)',
                r'(\d+(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:\$|USD)',
                r'(?:Kč|CZK)\s*(\d+(?:\s?\d{3})*(?:[.,]\d{2})?)',
                r'(?:€|EUR)\s*(\d+(?:\s?\d{3})*(?:[.,]\d{2})?)',
                r'(?:\$|USD)\s*(\d+(?:\s?\d{3})*(?:[.,]\d{2})?)'
            ]
            
            for pattern in price_patterns:
                match = re.search(pattern, full_text)
                if match:
                    price_text = match.group(0)
                    break
        
        if price_text:
            # Určí měnu
            if '€' in price_text or 'EUR' in price_text:
                currency = 'EUR'
            elif '$' in price_text or 'USD' in price_text:
                currency = 'USD'
            
            # Extrahuje číselnou hodnotu
            price = self.extract_price(price_text)
        
        return price, currency

    def extract_item_url(self, item_soup, page_url: str) -> str:
        """Extrahuje URL položky"""
        # Hledá hlavní link položky
        link_selectors = [
            'a.lot-link', 'a.item-link', 'a.title-link',
            'h3 a', 'h4 a', '.title a', 'a[href*="lot"]'
        ]
        
        for selector in link_selectors:
            link = item_soup.select_one(selector)
            if link and link.get('href'):
                return urljoin(page_url, link.get('href'))
        
        # Fallback - první link
        first_link = item_soup.find('a', href=True)
        if first_link:
            return urljoin(page_url, first_link.get('href'))
        
        return page_url

    def extract_condition_from_text(self, text: str) -> Optional[str]:
        """Extrahuje stav z textu - rozšířené pro Antium"""
        text_lower = text.lower()
        
        # Antium specifické stavy
        conditions = {
            'unc': 'MS-60',
            'bu': 'MS-60',
            'proof': 'MS-65',
            'xf': 'AU-50',
            'vf': 'VF-20',
            'f': 'F-12',
            'g': 'G-4',
            'perfektní': 'MS-70',
            'výborný': 'MS-65',
            'velmi dobrý': 'AU-50',
            'dobrý': 'VF-20',
            'zachovalý': 'VF-20',
            'opotřebený': 'F-12',
            'poškozený': 'damaged',
            'nepoužitý': 'MS-60',
            'mincovní': 'MS-60'
        }
        
        for condition_key, condition_value in conditions.items():
            if condition_key in text_lower:
                return condition_value
        
        return None

    def extract_material_from_text(self, text: str) -> Optional[str]:
        """Extrahuje materiál z textu - rozšířené pro Antium"""
        text_lower = text.lower()
        
        materials = {
            'zlato': 'gold',
            'stříbro': 'silver', 
            'měď': 'copper',
            'bronz': 'bronze',
            'nikl': 'nickel',
            'hliník': 'aluminum',
            'zinek': 'zinc',
            'bimetalická': 'bimetallic',
            'platina': 'platinum',
            'palladium': 'palladium',
            'gold': 'gold',
            'silver': 'silver',
            'copper': 'copper',
            'bronze': 'bronze',
            'au': 'gold',
            'ag': 'silver',
            'cu': 'copper'
        }
        
        for material_key, material_value in materials.items():
            if material_key in text_lower:
                return material_value
        
        return None

    def extract_country_from_text(self, text: str) -> Optional[str]:
        """Extrahuje zemi z textu - rozšířené pro Antium"""
        text_lower = text.lower()
        
        countries = {
            'česk': 'CZ',
            'čsr': 'CZ',
            'československ': 'CZ',
            'slovensk': 'SK',
            'německ': 'DE',
            'rakousk': 'AT',
            'americk': 'US',
            'usa': 'US',
            'britsk': 'GB',
            'anglick': 'GB',
            'francouzsk': 'FR',
            'italsk': 'IT',
            'španělsk': 'ES',
            'rusk': 'RU',
            'sovětsk': 'RU',
            'čínsk': 'CN',
            'japonsk': 'JP',
            'polsk': 'PL',
            'maďarsk': 'HU'
        }
        
        for country_key, country_code in countries.items():
            if country_key in text_lower:
                return country_code
        
        return None

    def extract_denomination_from_text(self, text: str) -> Optional[str]:
        """Extrahuje nominální hodnotu z textu - rozšířené pro Antium"""
        denomination_patterns = [
            r'(\d+)\s*(?:kč|koruna|korun|haléř|haléřů|hal)',
            r'(\d+)\s*(?:€|euro|eur|cent|centů)',
            r'(\d+)\s*(?:\$|dolar|dollar|cent)',
            r'(\d+)\s*(?:marka|marek|pfennig)',
            r'(\d+)\s*(?:frank|franků)',
            r'(\d+)\s*(?:libra|liber|penny|pence)',
            r'(\d+)\s*(?:rubl|rublů|kopejka|kopejek)',
            r'(\d+)\s*(?:zlatník|zlatníků|krejcar|krejcarů)'
        ]
        
        text_lower = text.lower()
        
        for pattern in denomination_patterns:
            match = re.search(pattern, text_lower)
            if match:
                return match.group(0)
        
        return None