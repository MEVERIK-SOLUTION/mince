import asyncio
import json
from typing import List, Dict, Optional, Any, Set
from datetime import datetime, timedelta, date
from dataclasses import dataclass, asdict
import logging
from enum import Enum
import icalendar
from icalendar import Calendar, Event
import pytz
import re
from urllib.parse import urljoin
import aiohttp
from abc import ABC, abstractmethod

class EventType(Enum):
    AUCTION = "auction"
    EXHIBITION = "exhibition"
    CONFERENCE = "conference"
    FAIR = "fair"
    DEADLINE = "deadline"
    REMINDER = "reminder"

class EventStatus(Enum):
    SCHEDULED = "scheduled"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    POSTPONED = "postponed"

class ReminderType(Enum):
    EMAIL = "email"
    PUSH = "push"
    SMS = "sms"
    IN_APP = "in_app"

@dataclass
class AuctionEvent:
    id: str
    title: str
    description: str
    auction_house: str
    start_datetime: datetime
    end_datetime: Optional[datetime]
    location: str
    event_type: EventType
    status: EventStatus
    url: Optional[str]
    catalog_url: Optional[str]
    preview_dates: List[datetime]
    lot_count: Optional[int]
    featured_lots: List[Dict[str, Any]]
    categories: List[str]
    estimate_range: Optional[Dict[str, float]]  # {"min": 1000, "max": 50000}
    currency: str
    contact_info: Dict[str, str]
    images: List[str]
    tags: List[str]
    created_at: datetime
    updated_at: datetime
    source: str

@dataclass
class EventReminder:
    id: str
    user_id: str
    event_id: str
    reminder_type: ReminderType
    remind_at: datetime
    message: str
    is_sent: bool = False
    created_at: datetime = None

@dataclass
class UserPreferences:
    user_id: str
    preferred_auction_houses: List[str]
    interested_categories: List[str]
    price_range: Dict[str, float]
    reminder_settings: Dict[ReminderType, bool]
    timezone: str
    language: str

class EventScraper(ABC):
    """Abstraktní třída pro scrapování událostí"""
    
    @abstractmethod
    async def scrape_events(self, start_date: date, end_date: date) -> List[AuctionEvent]:
        pass

class AureaEventScraper(EventScraper):
    """Scraper pro události z Aurea.cz"""
    
    def __init__(self):
        self.base_url = "https://www.aurea.cz"
        self.logger = logging.getLogger(__name__)
    
    async def scrape_events(self, start_date: date, end_date: date) -> List[AuctionEvent]:
        """Scrapuje události z Aurea"""
        events = []
        
        try:
            async with aiohttp.ClientSession() as session:
                # Získá seznam aukcí
                auctions_url = f"{self.base_url}/aukce"
                async with session.get(auctions_url) as response:
                    if response.status == 200:
                        content = await response.text()
                        events.extend(await self._parse_aurea_events(content, start_date, end_date))
                
                # Získá výstavy a další události
                events_url = f"{self.base_url}/akce"
                async with session.get(events_url) as response:
                    if response.status == 200:
                        content = await response.text()
                        events.extend(await self._parse_aurea_exhibitions(content, start_date, end_date))
        
        except Exception as e:
            self.logger.error(f"Error scraping Aurea events: {str(e)}")
        
        return events
    
    async def _parse_aurea_events(self, content: str, start_date: date, end_date: date) -> List[AuctionEvent]:
        """Parsuje aukční události z Aurea"""
        events = []
        
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(content, 'html.parser')
            
            # Hledá aukční bloky
            auction_blocks = soup.find_all(['div', 'article'], class_=re.compile(r'auction|aukce'))
            
            for block in auction_blocks:
                try:
                    event = await self._parse_single_aurea_auction(block)
                    if event and start_date <= event.start_datetime.date() <= end_date:
                        events.append(event)
                except Exception as e:
                    self.logger.warning(f"Error parsing Aurea auction block: {str(e)}")
                    continue
        
        except Exception as e:
            self.logger.error(f"Error parsing Aurea events: {str(e)}")
        
        return events
    
    async def _parse_single_aurea_auction(self, block) -> Optional[AuctionEvent]:
        """Parsuje jednotlivou aukci z Aurea"""
        try:
            # Extrahuje název
            title_elem = block.find(['h1', 'h2', 'h3'], string=re.compile(r'aukce|auction', re.I))
            if not title_elem:
                title_elem = block.find(['a', 'span'], class_=re.compile(r'title|name'))
            
            title = title_elem.get_text(strip=True) if title_elem else "Aurea Aukce"
            
            # Extrahuje datum
            date_text = self._extract_date_from_block(block)
            start_datetime = self._parse_czech_date(date_text) if date_text else datetime.now()
            
            # Extrahuje URL
            link_elem = block.find('a', href=True)
            event_url = urljoin(self.base_url, link_elem['href']) if link_elem else None
            
            # Extrahuje popis
            desc_elem = block.find(['p', 'div'], class_=re.compile(r'desc|content'))
            description = desc_elem.get_text(strip=True) if desc_elem else ""
            
            return AuctionEvent(
                id=f"aurea_{hash(title + str(start_datetime))}",
                title=title,
                description=description,
                auction_house="Aurea",
                start_datetime=start_datetime,
                end_datetime=start_datetime + timedelta(hours=4),  # Odhad délky aukce
                location="Praha, Česká republika",
                event_type=EventType.AUCTION,
                status=EventStatus.SCHEDULED,
                url=event_url,
                catalog_url=None,
                preview_dates=[],
                lot_count=None,
                featured_lots=[],
                categories=["Československé mince", "České mince", "Medaile"],
                estimate_range=None,
                currency="CZK",
                contact_info={"email": "info@aurea.cz", "phone": "+420 224 933 644"},
                images=[],
                tags=["aurea", "česká_numismatika"],
                created_at=datetime.now(),
                updated_at=datetime.now(),
                source="aurea.cz"
            )
        
        except Exception as e:
            self.logger.error(f"Error parsing single Aurea auction: {str(e)}")
            return None
    
    async def _parse_aurea_exhibitions(self, content: str, start_date: date, end_date: date) -> List[AuctionEvent]:
        """Parsuje výstavy z Aurea"""
        events = []
        # Implementace pro výstavy a další události
        return events
    
    def _extract_date_from_block(self, block) -> Optional[str]:
        """Extrahuje datum z HTML bloku"""
        date_patterns = [
            r'\d{1,2}\.\s*\d{1,2}\.\s*\d{4}',
            r'\d{1,2}/\d{1,2}/\d{4}',
            r'\d{4}-\d{1,2}-\d{1,2}'
        ]
        
        text = block.get_text()
        for pattern in date_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(0)
        
        return None
    
    def _parse_czech_date(self, date_str: str) -> datetime:
        """Parsuje české datum"""
        try:
            # Normalizuje formát
            date_str = re.sub(r'\s+', '', date_str)
            
            if '.' in date_str:
                parts = date_str.split('.')
                if len(parts) >= 3:
                    day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
                    return datetime(year, month, day, 10, 0)  # Default čas 10:00
            
            # Další formáty...
            return datetime.now()
        
        except Exception:
            return datetime.now()

class CalendarService:
    """Hlavní služba pro správu kalendáře událostí"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.scrapers: List[EventScraper] = []
        self.events_cache: Dict[str, AuctionEvent] = {}
        self.reminders: Dict[str, List[EventReminder]] = {}
        self.user_preferences: Dict[str, UserPreferences] = {}
        
        # Přidá scrapery
        self.scrapers.append(AureaEventScraper())
        # Další scrapery...
    
    async def refresh_events(self, days_ahead: int = 90) -> int:
        """Obnoví události ze všech zdrojů"""
        start_date = date.today()
        end_date = start_date + timedelta(days=days_ahead)
        
        all_events = []
        
        # Paralelní scrapování ze všech zdrojů
        tasks = []
        for scraper in self.scrapers:
            task = asyncio.create_task(scraper.scrape_events(start_date, end_date))
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                self.logger.error(f"Scraper {i} failed: {str(result)}")
            elif isinstance(result, list):
                all_events.extend(result)
        
        # Aktualizuje cache
        for event in all_events:
            self.events_cache[event.id] = event
        
        self.logger.info(f"Refreshed {len(all_events)} events")
        return len(all_events)
    
    async def get_events(self, 
                        start_date: Optional[date] = None,
                        end_date: Optional[date] = None,
                        event_types: Optional[List[EventType]] = None,
                        auction_houses: Optional[List[str]] = None,
                        categories: Optional[List[str]] = None) -> List[AuctionEvent]:
        """Získá filtrované události"""
        
        if not start_date:
            start_date = date.today()
        if not end_date:
            end_date = start_date + timedelta(days=30)
        
        filtered_events = []
        
        for event in self.events_cache.values():
            # Filtr podle data
            if not (start_date <= event.start_datetime.date() <= end_date):
                continue
            
            # Filtr podle typu
            if event_types and event.event_type not in event_types:
                continue
            
            # Filtr podle aukčního domu
            if auction_houses and event.auction_house not in auction_houses:
                continue
            
            # Filtr podle kategorií
            if categories:
                if not any(cat in event.categories for cat in categories):
                    continue
            
            filtered_events.append(event)
        
        # Řazení podle data
        return sorted(filtered_events, key=lambda x: x.start_datetime)
    
    async def get_user_events(self, user_id: str, days_ahead: int = 30) -> List[AuctionEvent]:
        """Získá události podle uživatelských preferencí"""
        user_prefs = self.user_preferences.get(user_id)
        if not user_prefs:
            return await self.get_events(end_date=date.today() + timedelta(days=days_ahead))
        
        return await self.get_events(
            end_date=date.today() + timedelta(days=days_ahead),
            auction_houses=user_prefs.preferred_auction_houses,
            categories=user_prefs.interested_categories
        )
    
    async def create_reminder(self, user_id: str, event_id: str, 
                            reminder_type: ReminderType, 
                            minutes_before: int = 60,
                            custom_message: str = None) -> EventReminder:
        """Vytvoří připomínku události"""
        
        event = self.events_cache.get(event_id)
        if not event:
            raise ValueError(f"Event {event_id} not found")
        
        remind_at = event.start_datetime - timedelta(minutes=minutes_before)
        
        if not custom_message:
            custom_message = f"Připomínka: {event.title} začíná za {minutes_before} minut"
        
        reminder = EventReminder(
            id=f"reminder_{user_id}_{event_id}_{int(remind_at.timestamp())}",
            user_id=user_id,
            event_id=event_id,
            reminder_type=reminder_type,
            remind_at=remind_at,
            message=custom_message,
            created_at=datetime.now()
        )
        
        if user_id not in self.reminders:
            self.reminders[user_id] = []
        
        self.reminders[user_id].append(reminder)
        
        return reminder
    
    async def get_pending_reminders(self, cutoff_time: datetime = None) -> List[EventReminder]:
        """Získá připomínky k odeslání"""
        if not cutoff_time:
            cutoff_time = datetime.now()
        
        pending = []
        
        for user_reminders in self.reminders.values():
            for reminder in user_reminders:
                if (not reminder.is_sent and 
                    reminder.remind_at <= cutoff_time):
                    pending.append(reminder)
        
        return pending
    
    async def mark_reminder_sent(self, reminder_id: str):
        """Označí připomínku jako odeslanou"""
        for user_reminders in self.reminders.values():
            for reminder in user_reminders:
                if reminder.id == reminder_id:
                    reminder.is_sent = True
                    return
    
    async def set_user_preferences(self, user_id: str, preferences: UserPreferences):
        """Nastaví uživatelské preference"""
        self.user_preferences[user_id] = preferences
    
    async def get_calendar_feed(self, user_id: str = None, format: str = "ical") -> str:
        """Generuje kalendářní feed"""
        
        if user_id:
            events = await self.get_user_events(user_id, days_ahead=365)
        else:
            events = await self.get_events(end_date=date.today() + timedelta(days=365))
        
        if format.lower() == "ical":
            return self._generate_ical_feed(events)
        elif format.lower() == "json":
            return self._generate_json_feed(events)
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def _generate_ical_feed(self, events: List[AuctionEvent]) -> str:
        """Generuje iCal feed"""
        cal = Calendar()
        cal.add('prodid', '-//Coin Collection Manager//Calendar//CS')
        cal.add('version', '2.0')
        cal.add('calscale', 'GREGORIAN')
        cal.add('method', 'PUBLISH')
        cal.add('x-wr-calname', 'Numismatické události')
        cal.add('x-wr-caldesc', 'Kalendář aukčních a numismatických událostí')
        
        prague_tz = pytz.timezone('Europe/Prague')
        
        for event in events:
            cal_event = Event()
            cal_event.add('uid', f"{event.id}@coin-collection.app")
            cal_event.add('dtstart', prague_tz.localize(event.start_datetime))
            
            if event.end_datetime:
                cal_event.add('dtend', prague_tz.localize(event.end_datetime))
            else:
                cal_event.add('dtend', prague_tz.localize(event.start_datetime + timedelta(hours=2)))
            
            cal_event.add('summary', event.title)
            cal_event.add('description', self._format_event_description(event))
            cal_event.add('location', event.location)
            cal_event.add('categories', ','.join(event.categories))
            
            if event.url:
                cal_event.add('url', event.url)
            
            cal_event.add('status', 'CONFIRMED')
            cal_event.add('transp', 'OPAQUE')
            
            cal.add_component(cal_event)
        
        return cal.to_ical().decode('utf-8')
    
    def _generate_json_feed(self, events: List[AuctionEvent]) -> str:
        """Generuje JSON feed"""
        json_events = []
        
        for event in events:
            json_event = {
                "id": event.id,
                "title": event.title,
                "description": event.description,
                "start": event.start_datetime.isoformat(),
                "end": event.end_datetime.isoformat() if event.end_datetime else None,
                "location": event.location,
                "auction_house": event.auction_house,
                "type": event.event_type.value,
                "status": event.status.value,
                "url": event.url,
                "categories": event.categories,
                "tags": event.tags
            }
            json_events.append(json_event)
        
        return json.dumps({
            "calendar_name": "Numismatické události",
            "description": "Kalendář aukčních a numismatických událostí",
            "events": json_events,
            "generated_at": datetime.now().isoformat(),
            "total_events": len(json_events)
        }, ensure_ascii=False, indent=2)
    
    def _format_event_description(self, event: AuctionEvent) -> str:
        """Formátuje popis události pro kalendář"""
        description = event.description
        
        if event.lot_count:
            description += f"\n\nPočet položek: {event.lot_count}"
        
        if event.estimate_range:
            description += f"\nOdhad: {event.estimate_range['min']:,.0f} - {event.estimate_range['max']:,.0f} {event.currency}"
        
        if event.categories:
            description += f"\nKategorie: {', '.join(event.categories)}"
        
        if event.contact_info:
            description += f"\n\nKontakt:"
            for key, value in event.contact_info.items():
                description += f"\n{key}: {value}"
        
        if event.url:
            description += f"\n\nVíce informací: {event.url}"
        
        return description
    
    async def get_event_statistics(self, days_back: int = 30) -> Dict[str, Any]:
        """Získá statistiky událostí"""
        start_date = date.today() - timedelta(days=days_back)
        end_date = date.today()
        
        events = await self.get_events(start_date, end_date)
        
        stats = {
            "total_events": len(events),
            "by_type": {},
            "by_auction_house": {},
            "by_month": {},
            "upcoming_events": len([e for e in events if e.start_datetime.date() >= date.today()])
        }
        
        for event in events:
            # Podle typu
            event_type = event.event_type.value
            stats["by_type"][event_type] = stats["by_type"].get(event_type, 0) + 1
            
            # Podle aukčního domu
            house = event.auction_house
            stats["by_auction_house"][house] = stats["by_auction_house"].get(house, 0) + 1
            
            # Podle měsíce
            month_key = event.start_datetime.strftime("%Y-%m")
            stats["by_month"][month_key] = stats["by_month"].get(month_key, 0) + 1
        
        return stats

# Factory funkce
def create_calendar_service() -> CalendarService:
    """Vytvoří instanci kalendářní služby"""
    return CalendarService()

# Příklad použití
async def example_usage():
    """Příklad použití kalendářní služby"""
    calendar_service = create_calendar_service()
    
    # Obnoví události
    count = await calendar_service.refresh_events(days_ahead=60)
    print(f"Refreshed {count} events")
    
    # Získá nadcházející události
    upcoming = await calendar_service.get_events(
        start_date=date.today(),
        end_date=date.today() + timedelta(days=14)
    )
    
    print(f"Upcoming events in next 14 days: {len(upcoming)}")
    for event in upcoming[:5]:
        print(f"- {event.title} ({event.auction_house}) - {event.start_datetime.strftime('%d.%m.%Y %H:%M')}")
    
    # Vytvoří připomínku
    if upcoming:
        reminder = await calendar_service.create_reminder(
            user_id="user123",
            event_id=upcoming[0].id,
            reminder_type=ReminderType.EMAIL,
            minutes_before=120
        )
        print(f"Created reminder: {reminder.id}")
    
    # Generuje iCal feed
    ical_feed = await calendar_service.get_calendar_feed(format="ical")
    print(f"Generated iCal feed ({len(ical_feed)} characters)")

if __name__ == "__main__":
    asyncio.run(example_usage())