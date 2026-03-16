import asyncio
import re
from typing import List, Optional
from datetime import datetime
from urllib.parse import urljoin, urlparse
from .base_scraper import BaseScraper, CoinListing

class AureaScraper(BaseScraper):
    """Scraper pro Aurea numismatika (aurea.cz)"""
    
    def __init__(self, config):
        super().__init__(config)
        self.base_url = "https://www.aurea.cz"
        self.auction_list_url = f"{self.base_url}/aukce"
        
    def get_source_name(self) -> str:
        return "Aurea Numismatika"

    async def get_auction_urls(self) -> List[str]:
        """Získá seznam aktivních aukcí"""
        auction_urls = []
        
        try:
            # Stáhne hlavní stránku aukcí
            content = await self.fetch_page(self.auction_list_url)
            if not content:
                return []
            
            soup = self.parse_html(content)
            
            # Hledá odkazy na aukce
            auction_links = soup.find_all('a', href=re.compile(r'/aukce/\d+'))
            
            for link in auction_links:
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
            
            # Hledá položky aukce
            lot_items = soup.find_all('div', class_=['lot-item', 'auction-item', 'item'])
            
            for item in lot_items:
                try:
                    listing = await self.parse_lot_item(item, auction_url, auction_info)
                    if listing:
                        listings.append(listing)
                except Exception as e:
                    self.logger.warning(f"Error parsing lot item: {str(e)}")
                    continue
            
            # Pokud nenašel položky, zkusí jiný selektor
            if not listings:
                listings = await self.scrape_alternative_format(soup, auction_url, auction_info)
            
        except Exception as e:
            self.logger.error(f"Error scraping auction {auction_url}: {str(e)}")
        
        return listings

    def extract_auction_info(self, soup) -> dict:
        """Extrahuje základní informace o aukci"""
        info = {
            'date': None,
            'title': None
        }
        
        try:
            # Hledá datum aukce
            date_elements = soup.find_all(text=re.compile(r'\d{1,2}\.\d{1,2}\.\d{4}'))
            for date_text in date_elements:
                date_match = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{4})', date_text)
                if date_match:
                    day, month, year = date_match.groups()
                    try:
                        info['date'] = datetime(int(year), int(month), int(day))
                        break
                    except ValueError:
                        continue
            
            # Hledá název aukce
            title_element = soup.find('h1') or soup.find('title')
            if title_element:
                info['title'] = title_element.get_text(strip=True)
                
        except Exception as e:
            self.logger.warning(f"Error extracting auction info: {str(e)}")
        
        return info

    async def parse_lot_item(self, item_soup, auction_url: str, auction_info: dict) -> Optional[CoinListing]:
        """Parsuje jednotlivou položku aukce"""
        try:
            # Extrahuje název
            title_element = item_soup.find(['h3', 'h4', 'h5', '.title', '.lot-title'])
            if not title_element:
                title_element = item_soup.find('a')
            
            if not title_element:
                return None
                
            title = title_element.get_text(strip=True)
            
            # Extrahuje popis
            description_element = item_soup.find(['p', '.description', '.lot-description'])
            description = description_element.get_text(strip=True) if description_element else title
            
            # Extrahuje číslo lotu
            lot_number = self.extract_lot_number(item_soup, title)
            
            # Extrahuje cenu
            price_element = item_soup.find(text=re.compile(r'\d+\s*(?:Kč|CZK|€|EUR|\$|USD)'))
            price = None
            currency = 'CZK'
            
            if price_element:
                price_text = str(price_element).strip()
                price = self.extract_price(price_text)
                
                if '€' in price_text or 'EUR' in price_text:
                    currency = 'EUR'
                elif '$' in price_text or 'USD' in price_text:
                    currency = 'USD'
            
            # Extrahuje obrázky
            images = self.extract_images(item_soup, self.base_url)
            
            # Extrahuje URL položky
            item_link = item_soup.find('a')
            item_url = urljoin(auction_url, item_link.get('href')) if item_link else auction_url
            
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
                hash_id=""  # Bude vygenerováno v __post_init__
            )
            
        except Exception as e:
            self.logger.warning(f"Error parsing lot item: {str(e)}")
            return None

    def extract_lot_number(self, item_soup, title: str) -> str:
        """Extrahuje číslo lotu"""
        # Hledá v atributech
        lot_attrs = ['data-lot', 'data-id', 'id']
        for attr in lot_attrs:
            value = item_soup.get(attr)
            if value:
                return str(value)
        
        # Hledá v textu
        lot_match = re.search(r'(?:lot|položka|č\.?)\s*(\d+)', title.lower())
        if lot_match:
            return lot_match.group(1)
        
        # Fallback - použije hash z názvu
        import hashlib
        return hashlib.md5(title.encode()).hexdigest()[:8]

    def extract_condition_from_text(self, text: str) -> Optional[str]:
        """Extrahuje stav z textu"""
        text_lower = text.lower()
        
        conditions = {
            'unc': 'MS-60',
            'bu': 'MS-60', 
            'proof': 'MS-65',
            'xf': 'AU-50',
            'vf': 'VF-20',
            'f': 'F-12',
            'perfektní': 'MS-70',
            'výborný': 'MS-65',
            'velmi dobrý': 'AU-50',
            'dobrý': 'VF-20'
        }
        
        for condition_key, condition_value in conditions.items():
            if condition_key in text_lower:
                return condition_value
        
        return None

    def extract_material_from_text(self, text: str) -> Optional[str]:
        """Extrahuje materiál z textu"""
        text_lower = text.lower()
        
        materials = {
            'zlato': 'gold',
            'stříbro': 'silver',
            'měď': 'copper',
            'bronz': 'bronze',
            'nikl': 'nickel',
            'hliník': 'aluminum',
            'gold': 'gold',
            'silver': 'silver',
            'copper': 'copper',
            'bronze': 'bronze'
        }
        
        for material_key, material_value in materials.items():
            if material_key in text_lower:
                return material_value
        
        return None

    def extract_country_from_text(self, text: str) -> Optional[str]:
        """Extrahuje zemi z textu"""
        text_lower = text.lower()
        
        countries = {
            'česk': 'CZ',
            'slovensk': 'SK', 
            'německ': 'DE',
            'rakousk': 'AT',
            'americk': 'US',
            'britsk': 'GB',
            'francouzsk': 'FR',
            'italsk': 'IT',
            'španělsk': 'ES',
            'rusk': 'RU',
            'čínsk': 'CN',
            'japonsk': 'JP'
        }
        
        for country_key, country_code in countries.items():
            if country_key in text_lower:
                return country_code
        
        return None

    def extract_denomination_from_text(self, text: str) -> Optional[str]:
        """Extrahuje nominální hodnotu z textu"""
        # Hledá vzory jako "10 Kč", "1 dolar", "5 euro"
        denomination_patterns = [
            r'(\d+)\s*(?:kč|koruna|korun)',
            r'(\d+)\s*(?:€|euro|eur)',
            r'(\d+)\s*(?:\$|dolar|dollar)',
            r'(\d+)\s*(?:haléř|hal)',
            r'(\d+)\s*(?:cent|penny|pence)'
        ]
        
        text_lower = text.lower()
        
        for pattern in denomination_patterns:
            match = re.search(pattern, text_lower)
            if match:
                return match.group(0)
        
        return None

    async def scrape_alternative_format(self, soup, auction_url: str, auction_info: dict) -> List[CoinListing]:
        """Alternativní způsob scrapingu pro jiný formát stránky"""
        listings = []
        
        try:
            # Hledá tabulky s položkami
            tables = soup.find_all('table')
            
            for table in tables:
                rows = table.find_all('tr')[1:]  # Přeskočí header
                
                for row in rows:
                    cells = row.find_all(['td', 'th'])
                    if len(cells) >= 3:  # Minimálně 3 sloupce
                        try:
                            listing = self.parse_table_row(cells, auction_url, auction_info)
                            if listing:
                                listings.append(listing)
                        except Exception as e:
                            self.logger.warning(f"Error parsing table row: {str(e)}")
                            continue
            
            # Hledá seznamy
            if not listings:
                lists = soup.find_all(['ul', 'ol'])
                for list_element in lists:
                    items = list_element.find_all('li')
                    for item in items:
                        try:
                            listing = await self.parse_list_item(item, auction_url, auction_info)
                            if listing:
                                listings.append(listing)
                        except Exception as e:
                            continue
                            
        except Exception as e:
            self.logger.error(f"Error in alternative scraping: {str(e)}")
        
        return listings

    def parse_table_row(self, cells, auction_url: str, auction_info: dict) -> Optional[CoinListing]:
        """Parsuje řádek tabulky"""
        try:
            # Předpokládá formát: [Lot, Popis, Cena]
            lot_number = cells[0].get_text(strip=True)
            title = cells[1].get_text(strip=True)
            price_text = cells[2].get_text(strip=True) if len(cells) > 2 else ""
            
            if not title:
                return None
            
            price = self.extract_price(price_text)
            
            return CoinListing(
                title=title,
                description=title,
                price=price,
                currency='CZK',
                auction_house=self.get_source_name(),
                auction_date=auction_info.get('date'),
                lot_number=lot_number,
                condition=None,
                material=None,
                year=self.extract_year(title),
                country=self.extract_country_from_text(title),
                denomination=self.extract_denomination_from_text(title),
                images=[],
                url=auction_url,
                scraped_at=datetime.now(),
                hash_id=""
            )
            
        except Exception as e:
            self.logger.warning(f"Error parsing table row: {str(e)}")
            return None

    async def parse_list_item(self, item_soup, auction_url: str, auction_info: dict) -> Optional[CoinListing]:
        """Parsuje položku seznamu"""
        try:
            text = item_soup.get_text(strip=True)
            if len(text) < 10:  # Příliš krátký text
                return None
            
            # Hledá cenu v textu
            price = self.extract_price(text)
            
            return CoinListing(
                title=text[:100],  # Omezí délku
                description=text,
                price=price,
                currency='CZK',
                auction_house=self.get_source_name(),
                auction_date=auction_info.get('date'),
                lot_number=str(hash(text))[:8],
                condition=self.extract_condition_from_text(text),
                material=self.extract_material_from_text(text),
                year=self.extract_year(text),
                country=self.extract_country_from_text(text),
                denomination=self.extract_denomination_from_text(text),
                images=self.extract_images(item_soup, self.base_url),
                url=auction_url,
                scraped_at=datetime.now(),
                hash_id=""
            )
            
        except Exception as e:
            self.logger.warning(f"Error parsing list item: {str(e)}")
            return None