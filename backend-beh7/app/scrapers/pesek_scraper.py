import asyncio
import re
from typing import List, Optional
from datetime import datetime
from urllib.parse import urljoin, urlparse
from .base_scraper import BaseScraper, CoinListing

class PesekScraper(BaseScraper):
    """Scraper pro Pešek aukce (pesekaukce.cz)"""
    
    def __init__(self, config):
        super().__init__(config)
        self.base_url = "https://www.pesekaukce.cz"
        self.auction_list_url = f"{self.base_url}/aukce"
        
    def get_source_name(self) -> str:
        return "Pešek Aukce"

    async def get_auction_urls(self) -> List[str]:
        """Získá seznam aktivních aukcí"""
        auction_urls = []
        
        try:
            # Stáhne hlavní stránku aukcí
            content = await self.fetch_page(self.auction_list_url)
            if not content:
                # Zkusí alternativní URL
                alt_urls = [
                    f"{self.base_url}/aktualni-aukce",
                    f"{self.base_url}/probihajici-aukce",
                    f"{self.base_url}/online-aukce"
                ]
                
                for alt_url in alt_urls:
                    content = await self.fetch_page(alt_url)
                    if content:
                        break
                
                if not content:
                    return []
            
            soup = self.parse_html(content)
            
            # Pešek specifické selektory
            auction_selectors = [
                'a[href*="/aukce/"]',
                'a[href*="/auction/"]', 
                '.auction-link',
                '.aukce-odkaz'
            ]
            
            for selector in auction_selectors:
                links = soup.select(selector)
                for link in links:
                    href = link.get('href')
                    if href:
                        full_url = urljoin(self.base_url, href)
                        if full_url not in auction_urls and self.is_valid_auction_url(full_url):
                            auction_urls.append(full_url)
            
            # Pokud nenašel specifické selektory, hledá obecně
            if not auction_urls:
                all_links = soup.find_all('a', href=True)
                for link in all_links:
                    href = link.get('href')
                    if href and ('/aukce/' in href or '/auction/' in href):
                        full_url = urljoin(self.base_url, href)
                        if self.is_valid_auction_url(full_url) and full_url not in auction_urls:
                            auction_urls.append(full_url)
            
            # Omezí na posledních 5 aukcí
            return auction_urls[:5]
            
        except Exception as e:
            self.logger.error(f"Error getting auction URLs: {str(e)}")
            return []

    def is_valid_auction_url(self, url: str) -> bool:
        """Ověří, zda je URL platná aukce"""
        try:
            parsed = urlparse(url)
            path = parsed.path.lower()
            
            # Vyloučí nežádoucí URL
            excluded_patterns = [
                '/login', '/register', '/contact', '/about',
                '/help', '/faq', '/terms', '/privacy'
            ]
            
            for pattern in excluded_patterns:
                if pattern in path:
                    return False
            
            # Musí obsahovat aukci
            return '/aukce/' in path or '/auction/' in path
            
        except Exception:
            return False

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
            auction_info = self.extract_auction_info(soup, auction_url)
            
            # Pešek může mít katalog ve formátu PDF - zkusí najít
            pdf_catalog = await self.find_pdf_catalog(soup, auction_url)
            if pdf_catalog:
                self.logger.info(f"Found PDF catalog: {pdf_catalog}")
                # Pro PDF katalogy by bylo potřeba speciální zpracování
            
            # Scrapuje HTML obsah
            page_listings = await self.scrape_html_content(soup, auction_url, auction_info)
            listings.extend(page_listings)
            
            # Hledá další stránky
            additional_pages = await self.get_additional_pages(soup, auction_url)
            for page_url in additional_pages:
                try:
                    page_listings = await self.scrape_additional_page(page_url, auction_info)
                    listings.extend(page_listings)
                except Exception as e:
                    self.logger.warning(f"Error scraping additional page {page_url}: {str(e)}")
            
        except Exception as e:
            self.logger.error(f"Error scraping auction {auction_url}: {str(e)}")
        
        return listings

    def extract_auction_info(self, soup, auction_url: str) -> dict:
        """Extrahuje základní informace o aukci"""
        info = {
            'date': None,
            'title': None,
            'auction_number': None,
            'base_url': auction_url
        }
        
        try:
            # Hledá název aukce
            title_selectors = [
                'h1', '.auction-title', '.aukce-nazev', 
                '.page-title', '.main-title', 'title'
            ]
            
            for selector in title_selectors:
                title_element = soup.select_one(selector)
                if title_element:
                    title_text = title_element.get_text(strip=True)
                    if len(title_text) > 5:  # Rozumná délka
                        info['title'] = title_text
                        break
            
            # Hledá datum aukce - Pešek formáty
            page_text = soup.get_text()
            date_patterns = [
                r'(\d{1,2})\.(\d{1,2})\.(\d{4})',  # DD.MM.YYYY
                r'(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})',  # DD. MM. YYYY
                r'(\d{4})-(\d{1,2})-(\d{1,2})',  # YYYY-MM-DD
                r'(\d{1,2})/(\d{1,2})/(\d{4})'   # DD/MM/YYYY
            ]
            
            for pattern in date_patterns:
                matches = re.findall(pattern, page_text)
                for match in matches:
                    try:
                        if '.' in pattern:  # DD.MM.YYYY
                            day, month, year = match
                        elif '-' in pattern:  # YYYY-MM-DD
                            year, month, day = match
                        else:  # DD/MM/YYYY
                            day, month, year = match
                        
                        # Ověří rozumnost data
                        year_int = int(year)
                        current_year = datetime.now().year
                        if 2020 <= year_int <= current_year + 1:
                            info['date'] = datetime(year_int, int(month), int(day))
                            break
                    except (ValueError, TypeError):
                        continue
                if info['date']:
                    break
            
            # Hledá číslo aukce
            auction_number_patterns = [
                r'aukce\s*č\.\s*(\d+)',
                r'aukce\s*(\d+)',
                r'auction\s*(\d+)',
                r'#(\d+)'
            ]
            
            for pattern in auction_number_patterns:
                match = re.search(pattern, page_text.lower())
                if match:
                    info['auction_number'] = match.group(1)
                    break
                
        except Exception as e:
            self.logger.warning(f"Error extracting auction info: {str(e)}")
        
        return info

    async def find_pdf_catalog(self, soup, auction_url: str) -> Optional[str]:
        """Hledá PDF katalog aukce"""
        try:
            # Hledá odkazy na PDF
            pdf_links = soup.find_all('a', href=re.compile(r'\.pdf$', re.I))
            
            for link in pdf_links:
                href = link.get('href')
                link_text = link.get_text(strip=True).lower()
                
                # Kontroluje, zda je to katalog
                if any(keyword in link_text for keyword in ['katalog', 'catalog', 'seznam', 'list']):
                    return urljoin(auction_url, href)
            
            return None
            
        except Exception as e:
            self.logger.warning(f"Error finding PDF catalog: {str(e)}")
            return None

    async def scrape_html_content(self, soup, auction_url: str, auction_info: dict) -> List[CoinListing]:
        """Scrapuje HTML obsah aukce"""
        listings = []
        
        try:
            # Pešek specifické selektory pro položky
            lot_selectors = [
                '.lot-item', '.auction-item', '.item',
                '.polozka', '.lot', 'tr.lot-row',
                '[data-lot]', '.product-item'
            ]
            
            lot_items = []
            for selector in lot_selectors:
                items = soup.select(selector)
                if items:
                    lot_items = items
                    self.logger.debug(f"Found {len(items)} items with selector: {selector}")
                    break
            
            # Pokud nenašel specifické selektory, zkusí tabulky
            if not lot_items:
                lot_items = await self.scrape_table_format(soup)
            
            # Pokud stále nenašel, zkusí seznamy
            if not lot_items:
                lot_items = await self.scrape_list_format(soup)
            
            # Parsuje nalezené položky
            for item in lot_items:
                try:
                    listing = await self.parse_lot_item(item, auction_url, auction_info)
                    if listing:
                        listings.append(listing)
                except Exception as e:
                    self.logger.warning(f"Error parsing lot item: {str(e)}")
                    continue
            
        except Exception as e:
            self.logger.error(f"Error scraping HTML content: {str(e)}")
        
        return listings

    async def scrape_table_format(self, soup) -> List:
        """Scrapuje tabulkový formát"""
        table_rows = []
        
        try:
            tables = soup.find_all('table')
            for table in tables:
                rows = table.find_all('tr')
                
                # Přeskočí header řádky
                data_rows = []
                for row in rows[1:]:  # Přeskočí první řádek (header)
                    cells = row.find_all(['td', 'th'])
                    if len(cells) >= 2:  # Minimálně 2 sloupce
                        data_rows.append(row)
                
                if data_rows:
                    table_rows.extend(data_rows)
                    break  # Vezme první validní tabulku
            
        except Exception as e:
            self.logger.warning(f"Error scraping table format: {str(e)}")
        
        return table_rows

    async def scrape_list_format(self, soup) -> List:
        """Scrapuje formát seznamu"""
        list_items = []
        
        try:
            # Hledá seznamy
            lists = soup.find_all(['ul', 'ol'])
            for list_element in lists:
                items = list_element.find_all('li')
                
                # Filtruje položky s rozumným obsahem
                valid_items = []
                for item in items:
                    text = item.get_text(strip=True)
                    if len(text) > 10 and any(keyword in text.lower() for keyword in 
                                           ['mince', 'coin', 'kč', '€', '$', 'lot', 'položka']):
                        valid_items.append(item)
                
                if valid_items:
                    list_items.extend(valid_items)
            
        except Exception as e:
            self.logger.warning(f"Error scraping list format: {str(e)}")
        
        return list_items

    async def get_additional_pages(self, soup, base_url: str) -> List[str]:
        """Získá další stránky aukce"""
        additional_pages = []
        
        try:
            # Hledá pagination
            pagination_selectors = [
                '.pagination a', '.paging a', '.page-nav a',
                'a[href*="page="]', 'a[href*="strana="]'
            ]
            
            for selector in pagination_selectors:
                links = soup.select(selector)
                for link in links:
                    href = link.get('href')
                    if href:
                        full_url = urljoin(base_url, href)
                        if full_url != base_url and full_url not in additional_pages:
                            additional_pages.append(full_url)
            
            # Omezí na maximálně 5 dalších stránek
            return additional_pages[:5]
            
        except Exception as e:
            self.logger.warning(f"Error getting additional pages: {str(e)}")
            return []

    async def scrape_additional_page(self, page_url: str, auction_info: dict) -> List[CoinListing]:
        """Scrapuje další stránku"""
        try:
            content = await self.fetch_page(page_url)
            if not content:
                return []
            
            soup = self.parse_html(content)
            return await self.scrape_html_content(soup, page_url, auction_info)
            
        except Exception as e:
            self.logger.error(f"Error scraping additional page {page_url}: {str(e)}")
            return []

    async def parse_lot_item(self, item_soup, page_url: str, auction_info: dict) -> Optional[CoinListing]:
        """Parsuje jednotlivou položku aukce"""
        try:
            # Extrahuje název
            title = self.extract_title(item_soup)
            if not title or len(title) < 3:
                return None
            
            # Extrahuje popis
            description = self.extract_description(item_soup, title)
            
            # Extrahuje číslo lotu
            lot_number = self.extract_lot_number(item_soup, title)
            
            # Extrahuje cenu a měnu
            price, currency = self.extract_price_and_currency(item_soup)
            
            # Extrahuje obrázky
            images = self.extract_images(item_soup, self.base_url)
            
            # Extrahuje URL položky
            item_url = self.extract_item_url(item_soup, page_url)
            
            # Extrahuje další informace
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

    def extract_title(self, item_soup) -> Optional[str]:
        """Extrahuje název položky"""
        title_selectors = [
            '.title', '.lot-title', '.item-title', '.name',
            'h3', 'h4', 'h5', 'strong', 'b', 'a[title]'
        ]
        
        for selector in title_selectors:
            element = item_soup.select_one(selector)
            if element:
                title = element.get_text(strip=True)
                if title and len(title) > 3:
                    return title
        
        # Fallback - první link nebo text
        link = item_soup.find('a')
        if link:
            title = link.get('title') or link.get_text(strip=True)
            if title and len(title) > 3:
                return title
        
        # Poslední fallback - celý text (omezený)
        text = item_soup.get_text(strip=True)
        if text:
            return text[:100]
        
        return None

    def extract_description(self, item_soup, title: str) -> str:
        """Extrahuje popis položky"""
        description_selectors = [
            '.description', '.desc', '.details', '.lot-description',
            'p', '.content', '.text'
        ]
        
        best_description = title  # Default
        
        for selector in description_selectors:
            element = item_soup.select_one(selector)
            if element:
                desc_text = element.get_text(strip=True)
                if len(desc_text) > len(best_description):
                    best_description = desc_text
        
        return best_description

    def extract_lot_number(self, item_soup, title: str) -> str:
        """Extrahuje číslo lotu"""
        # Hledá v atributech
        lot_attrs = ['data-lot', 'data-lot-id', 'data-id', 'id', 'data-item']
        for attr in lot_attrs:
            value = item_soup.get(attr)
            if value and str(value).replace('-', '').replace('_', '').isdigit():
                return str(value)
        
        # Hledá v textu
        text = item_soup.get_text()
        lot_patterns = [
            r'(?:lot|položka|č\.?)\s*(\d+)',
            r'(\d+)\s*(?:lot|položka)',
            r'#(\d+)',
            r'ID:\s*(\d+)',
            r'(\d+)\s*-'  # Číslo následované pomlčkou
        ]
        
        for pattern in lot_patterns:
            match = re.search(pattern, text.lower())
            if match:
                return match.group(1)
        
        # Fallback
        import hashlib
        return hashlib.md5(title.encode()).hexdigest()[:8]

    def extract_price_and_currency(self, item_soup) -> tuple[Optional[float], str]:
        """Extrahuje cenu a měnu"""
        price = None
        currency = 'CZK'
        
        # Hledá cenové elementy
        price_selectors = [
            '.price', '.cena', '.amount', '.cost', '.bid',
            '[data-price]', '.current-price', '.starting-price'
        ]
        
        price_text = None
        for selector in price_selectors:
            element = item_soup.select_one(selector)
            if element:
                price_text = element.get_text(strip=True)
                break
        
        # Pokud nenašel, hledá v celém textu
        if not price_text:
            full_text = item_soup.get_text()
            price_patterns = [
                r'(\d+(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:Kč|CZK)',
                r'(\d+(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:€|EUR)',
                r'(\d+(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:\$|USD)',
                r'(?:od|from)\s*(\d+(?:\s?\d{3})*(?:[.,]\d{2})?)',
                r'(?:vyvolávací|starting)\s*(?:cena|price)?\s*(\d+(?:\s?\d{3})*(?:[.,]\d{2})?)'
            ]
            
            for pattern in price_patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    price_text = match.group(0)
                    break
        
        if price_text:
            # Určí měnu
            if '€' in price_text or 'EUR' in price_text.upper():
                currency = 'EUR'
            elif '$' in price_text or 'USD' in price_text.upper():
                currency = 'USD'
            
            # Extrahuje číselnou hodnotu
            price = self.extract_price(price_text)
        
        return price, currency

    def extract_item_url(self, item_soup, page_url: str) -> str:
        """Extrahuje URL položky"""
        # Hledá hlavní link
        link_selectors = [
            'a.item-link', 'a.lot-link', 'a.title-link',
            '.title a', '.name a', 'h3 a', 'h4 a'
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
        """Extrahuje stav z textu"""
        return self.normalize_condition(text)

    def extract_material_from_text(self, text: str) -> Optional[str]:
        """Extrahuje materiál z textu"""
        text_lower = text.lower()
        
        materials = {
            'zlato': 'gold', 'au': 'gold', 'gold': 'gold',
            'stříbro': 'silver', 'ag': 'silver', 'silver': 'silver',
            'měď': 'copper', 'cu': 'copper', 'copper': 'copper',
            'bronz': 'bronze', 'bronze': 'bronze',
            'nikl': 'nickel', 'ni': 'nickel', 'nickel': 'nickel',
            'hliník': 'aluminum', 'al': 'aluminum', 'aluminum': 'aluminum',
            'zinek': 'zinc', 'zn': 'zinc', 'zinc': 'zinc',
            'bimetalická': 'bimetallic', 'bimetallic': 'bimetallic',
            'platina': 'platinum', 'pt': 'platinum', 'platinum': 'platinum'
        }
        
        for material_key, material_value in materials.items():
            if material_key in text_lower:
                return material_value
        
        return None

    def extract_country_from_text(self, text: str) -> Optional[str]:
        """Extrahuje zemi z textu"""
        text_lower = text.lower()
        
        countries = {
            'česk': 'CZ', 'čsr': 'CZ', 'československ': 'CZ', 'bohemia': 'CZ',
            'slovensk': 'SK', 'slovakia': 'SK',
            'německ': 'DE', 'german': 'DE', 'deutschland': 'DE',
            'rakousk': 'AT', 'austria': 'AT', 'österreich': 'AT',
            'americk': 'US', 'usa': 'US', 'united states': 'US',
            'britsk': 'GB', 'anglick': 'GB', 'england': 'GB', 'britain': 'GB',
            'francouzsk': 'FR', 'france': 'FR', 'french': 'FR',
            'italsk': 'IT', 'italy': 'IT', 'italian': 'IT',
            'španělsk': 'ES', 'spain': 'ES', 'spanish': 'ES',
            'rusk': 'RU', 'russia': 'RU', 'soviet': 'RU', 'ussr': 'RU',
            'polsk': 'PL', 'poland': 'PL', 'polish': 'PL',
            'maďarsk': 'HU', 'hungary': 'HU', 'hungarian': 'HU'
        }
        
        for country_key, country_code in countries.items():
            if country_key in text_lower:
                return country_code
        
        return None

    def extract_denomination_from_text(self, text: str) -> Optional[str]:
        """Extrahuje nominální hodnotu z textu"""
        denomination_patterns = [
            r'(\d+)\s*(?:kč|koruna|korun|haléř|haléřů)',
            r'(\d+)\s*(?:€|euro|eur|cent|centů)',
            r'(\d+)\s*(?:\$|dolar|dollar)',
            r'(\d+)\s*(?:marka|marek|pfennig)',
            r'(\d+)\s*(?:frank|franků)',
            r'(\d+)\s*(?:libra|liber|pound|penny|pence)',
            r'(\d+)\s*(?:rubl|rublů|kopejka|kopejek)',
            r'(\d+)\s*(?:zlatník|zlatníků|dukát|dukátů)',
            r'(\d+)\s*(?:krejcar|krejcarů|groš|grošů)'
        ]
        
        text_lower = text.lower()
        
        for pattern in denomination_patterns:
            match = re.search(pattern, text_lower)
            if match:
                return match.group(0)
        
        return None