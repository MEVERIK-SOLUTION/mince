import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from celery import current_task
from sqlalchemy.orm import Session

from .celery_app import celery_app
from ..database import get_db
from ..models.user import User
from ..models.coin import Coin
from ..models.collection import Collection
from ..models.price_history import PriceHistory
from ..services.email_service import EmailService
from ..services.backup_service import BackupService
from ..services.calendar_service import CalendarService
from ..services.api_integrations import MultiAPIService
from ..scrapers.aurea_scraper import AureaScraper
from ..scrapers.antium_scraper import AntiumScraper
from ..scrapers.pesek_scraper import PesekScraper

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=3)
def scrape_auction_houses(self):
    """Periodické scrapování aukčních domů"""
    try:
        logger.info("Starting auction house scraping")
        
        scrapers = [
            AureaScraper(),
            AntiumScraper(), 
            PesekScraper()
        ]
        
        total_items = 0
        results = {}
        
        for scraper in scrapers:
            try:
                scraper_name = scraper.__class__.__name__
                logger.info(f"Scraping {scraper_name}")
                
                # Scraping posledních 24 hodin
                items = asyncio.run(scraper.scrape_recent_auctions(hours=24))
                
                results[scraper_name] = {
                    "items_found": len(items),
                    "status": "success"
                }
                
                total_items += len(items)
                
                # Aktualizace progress
                if hasattr(current_task, 'update_state'):
                    current_task.update_state(
                        state='PROGRESS',
                        meta={
                            'current_scraper': scraper_name,
                            'total_items': total_items,
                            'completed_scrapers': len([r for r in results.values() if r['status'] == 'success'])
                        }
                    )
                
            except Exception as e:
                logger.error(f"Error scraping {scraper_name}: {str(e)}")
                results[scraper_name] = {
                    "items_found": 0,
                    "status": "error",
                    "error": str(e)
                }
        
        logger.info(f"Auction scraping completed. Total items: {total_items}")
        
        return {
            "total_items": total_items,
            "scrapers": results,
            "completed_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Auction scraping failed: {str(e)}")
        raise self.retry(countdown=300, exc=e)  # Retry za 5 minut

@celery_app.task(bind=True, max_retries=3)
def update_coin_prices(self):
    """Aktualizace cen mincí z API"""
    try:
        logger.info("Starting coin price updates")
        
        db = next(get_db())
        api_service = MultiAPIService()
        
        # Získání mincí pro aktualizaci (např. oblíbené nebo nedávno aktualizované)
        coins = db.query(Coin).filter(
            Coin.is_favorite == True
        ).limit(1000).all()
        
        updated_count = 0
        error_count = 0
        
        for i, coin in enumerate(coins):
            try:
                # Aktualizace progress
                if hasattr(current_task, 'update_state') and i % 10 == 0:
                    current_task.update_state(
                        state='PROGRESS',
                        meta={
                            'current': i,
                            'total': len(coins),
                            'updated': updated_count,
                            'errors': error_count
                        }
                    )
                
                # Získání aktuální ceny
                search_query = f"{coin.name} {coin.country} {coin.year}"
                price_data = asyncio.run(api_service.get_coin_price(search_query))
                
                if price_data and price_data.get('current_price'):
                    old_price = coin.current_value
                    new_price = price_data['current_price']
                    
                    # Aktualizace ceny mince
                    coin.current_value = new_price
                    coin.updated_at = datetime.now()
                    
                    # Uložení do historie cen
                    price_history = PriceHistory(
                        coin_id=coin.id,
                        price=new_price,
                        source=price_data.get('source', 'api'),
                        recorded_at=datetime.now()
                    )
                    db.add(price_history)
                    
                    updated_count += 1
                    
                    # Log významných změn ceny
                    if old_price and abs(new_price - old_price) / old_price > 0.1:  # 10% změna
                        logger.info(f"Significant price change for coin {coin.id}: {old_price} -> {new_price}")
                
            except Exception as e:
                logger.error(f"Error updating price for coin {coin.id}: {str(e)}")
                error_count += 1
        
        db.commit()
        db.close()
        
        logger.info(f"Price update completed. Updated: {updated_count}, Errors: {error_count}")
        
        return {
            "total_coins": len(coins),
            "updated_count": updated_count,
            "error_count": error_count,
            "completed_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Price update failed: {str(e)}")
        raise self.retry(countdown=600, exc=e)  # Retry za 10 minut

@celery_app.task(bind=True, max_retries=3)
def send_price_alerts(self):
    """Odesílání cenových alertů uživatelům"""
    try:
        logger.info("Starting price alerts")
        
        db = next(get_db())
        email_service = EmailService()
        
        # Získání uživatelů s povolenými notifikacemi
        users = db.query(User).filter(
            User.email_notifications == True
        ).all()
        
        alerts_sent = 0
        
        for user in users:
            try:
                # Získání mincí uživatele s významnými změnami ceny za posledních 24 hodin
                recent_changes = db.query(Coin, PriceHistory).join(
                    PriceHistory, Coin.id == PriceHistory.coin_id
                ).join(
                    Collection, Coin.collection_id == Collection.id
                ).filter(
                    Collection.user_id == user.id,
                    PriceHistory.recorded_at >= datetime.now() - timedelta(hours=24)
                ).all()
                
                if recent_changes:
                    # Příprava dat pro email
                    price_changes = []
                    for coin, price_history in recent_changes:
                        # Získání předchozí ceny
                        prev_price_record = db.query(PriceHistory).filter(
                            PriceHistory.coin_id == coin.id,
                            PriceHistory.recorded_at < price_history.recorded_at
                        ).order_by(PriceHistory.recorded_at.desc()).first()
                        
                        if prev_price_record:
                            change_percent = ((price_history.price - prev_price_record.price) / prev_price_record.price) * 100
                            
                            # Pouze významné změny (>5%)
                            if abs(change_percent) >= 5:
                                price_changes.append({
                                    "coin_name": coin.name,
                                    "old_price": prev_price_record.price,
                                    "new_price": price_history.price,
                                    "change_percent": change_percent,
                                    "change_type": "increase" if change_percent > 0 else "decrease"
                                })
                    
                    if price_changes:
                        # Odeslání emailu
                        asyncio.run(email_service.send_price_alert(
                            user.email,
                            user.full_name,
                            price_changes
                        ))
                        alerts_sent += 1
                
            except Exception as e:
                logger.error(f"Error sending price alert to user {user.id}: {str(e)}")
        
        db.close()
        
        logger.info(f"Price alerts completed. Sent: {alerts_sent}")
        
        return {
            "total_users": len(users),
            "alerts_sent": alerts_sent,
            "completed_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Price alerts failed: {str(e)}")
        raise self.retry(countdown=300, exc=e)

@celery_app.task(bind=True, max_retries=3)
def send_weekly_summaries(self):
    """Odesílání týdenních souhrnů"""
    try:
        logger.info("Starting weekly summaries")
        
        db = next(get_db())
        email_service = EmailService()
        
        # Získání uživatelů s povolenými notifikacemi
        users = db.query(User).filter(
            User.email_notifications == True
        ).all()
        
        summaries_sent = 0
        
        for user in users:
            try:
                # Statistiky za poslední týden
                week_ago = datetime.now() - timedelta(days=7)
                
                # Nové mince
                new_coins = db.query(Coin).join(Collection).filter(
                    Collection.user_id == user.id,
                    Coin.created_at >= week_ago
                ).count()
                
                # Celková hodnota kolekce
                total_value = db.query(func.sum(Coin.current_value)).join(Collection).filter(
                    Collection.user_id == user.id,
                    Coin.current_value.isnot(None)
                ).scalar() or 0
                
                # Počet kolekcí
                collections_count = db.query(Collection).filter(
                    Collection.user_id == user.id
                ).count()
                
                # Odeslání týdenního souhrnu
                asyncio.run(email_service.send_weekly_summary(
                    user.email,
                    user.full_name,
                    {
                        "new_coins": new_coins,
                        "total_value": total_value,
                        "collections_count": collections_count,
                        "week_start": week_ago.strftime("%d.%m.%Y"),
                        "week_end": datetime.now().strftime("%d.%m.%Y")
                    }
                ))
                summaries_sent += 1
                
            except Exception as e:
                logger.error(f"Error sending weekly summary to user {user.id}: {str(e)}")
        
        db.close()
        
        logger.info(f"Weekly summaries completed. Sent: {summaries_sent}")
        
        return {
            "total_users": len(users),
            "summaries_sent": summaries_sent,
            "completed_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Weekly summaries failed: {str(e)}")
        raise self.retry(countdown=300, exc=e)

@celery_app.task(bind=True, max_retries=3)
def cleanup_old_data(self):
    """Čištění starých dat"""
    try:
        logger.info("Starting data cleanup")
        
        db = next(get_db())
        
        # Čištění starých záznamů historie cen (starší než 1 rok)
        year_ago = datetime.now() - timedelta(days=365)
        
        deleted_price_history = db.query(PriceHistory).filter(
            PriceHistory.recorded_at < year_ago
        ).delete()
        
        # Čištění starých session záznamů (pokud existují)
        # deleted_sessions = db.query(UserSession).filter(
        #     UserSession.expires_at < datetime.now()
        # ).delete()
        
        # Čištění dočasných souborů
        import os
        import tempfile
        temp_dir = tempfile.gettempdir()
        cleanup_count = 0
        
        for filename in os.listdir(temp_dir):
            if filename.startswith("coin_collection_"):
                file_path = os.path.join(temp_dir, filename)
                try:
                    # Smazání souborů starších než 24 hodin
                    if os.path.getmtime(file_path) < (datetime.now() - timedelta(hours=24)).timestamp():
                        os.remove(file_path)
                        cleanup_count += 1
                except Exception as e:
                    logger.warning(f"Could not delete temp file {file_path}: {e}")
        
        db.commit()
        db.close()
        
        logger.info(f"Data cleanup completed. Price history: {deleted_price_history}, Temp files: {cleanup_count}")
        
        return {
            "deleted_price_history": deleted_price_history,
            "deleted_temp_files": cleanup_count,
            "completed_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Data cleanup failed: {str(e)}")
        raise self.retry(countdown=600, exc=e)

@celery_app.task(bind=True, max_retries=3)
def create_automatic_backups(self):
    """Vytváření automatických záloh"""
    try:
        logger.info("Starting automatic backups")
        
        db = next(get_db())
        backup_service = BackupService(db)
        
        # Získání uživatelů s povolenými automatickými zálohami
        users = db.query(User).filter(
            User.auto_backup_enabled == True
        ).all()
        
        backups_created = 0
        
        for user in users:
            try:
                # Vytvoření zálohy pro uživatele
                backup_info = asyncio.run(backup_service.create_full_backup(
                    user_id=user.id,
                    include_images=True,
                    compression_level=6
                ))
                
                logger.info(f"Backup created for user {user.id}: {backup_info['backup_id']}")
                backups_created += 1
                
            except Exception as e:
                logger.error(f"Error creating backup for user {user.id}: {str(e)}")
        
        # Čištění starých záloh
        cleanup_result = backup_service.cleanup_old_backups(
            retention_days=30,
            keep_minimum=5
        )
        
        db.close()
        
        logger.info(f"Automatic backups completed. Created: {backups_created}")
        
        return {
            "total_users": len(users),
            "backups_created": backups_created,
            "cleanup_result": cleanup_result,
            "completed_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Automatic backups failed: {str(e)}")
        raise self.retry(countdown=600, exc=e)

@celery_app.task(bind=True, max_retries=3)
def update_calendar_events(self):
    """Aktualizace kalendáře aukčních událostí"""
    try:
        logger.info("Starting calendar events update")
        
        calendar_service = CalendarService()
        
        # Aktualizace událostí ze všech zdrojů
        updated_events = asyncio.run(calendar_service.update_all_events())
        
        logger.info(f"Calendar events updated: {len(updated_events)} events")
        
        return {
            "updated_events": len(updated_events),
            "events": updated_events,
            "completed_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Calendar events update failed: {str(e)}")
        raise self.retry(countdown=300, exc=e)

@celery_app.task(bind=True, max_retries=3)
def generate_monthly_reports(self):
    """Generování měsíčních reportů"""
    try:
        logger.info("Starting monthly reports generation")
        
        db = next(get_db())
        email_service = EmailService()
        
        # Získání uživatelů s premium účty
        premium_users = db.query(User).filter(
            User.is_premium == True,
            User.email_notifications == True
        ).all()
        
        reports_generated = 0
        
        for user in premium_users:
            try:
                # Generování měsíčního reportu
                month_ago = datetime.now() - timedelta(days=30)
                
                # Statistiky za měsíc
                stats = {
                    "new_coins": db.query(Coin).join(Collection).filter(
                        Collection.user_id == user.id,
                        Coin.created_at >= month_ago
                    ).count(),
                    
                    "total_coins": db.query(Coin).join(Collection).filter(
                        Collection.user_id == user.id
                    ).count(),
                    
                    "total_value": db.query(func.sum(Coin.current_value)).join(Collection).filter(
                        Collection.user_id == user.id,
                        Coin.current_value.isnot(None)
                    ).scalar() or 0,
                    
                    "collections_count": db.query(Collection).filter(
                        Collection.user_id == user.id
                    ).count(),
                    
                    "month_start": month_ago.strftime("%d.%m.%Y"),
                    "month_end": datetime.now().strftime("%d.%m.%Y")
                }
                
                # Odeslání reportu
                asyncio.run(email_service.send_monthly_report(
                    user.email,
                    user.full_name,
                    stats
                ))
                
                reports_generated += 1
                
            except Exception as e:
                logger.error(f"Error generating monthly report for user {user.id}: {str(e)}")
        
        db.close()
        
        logger.info(f"Monthly reports completed. Generated: {reports_generated}")
        
        return {
            "total_users": len(premium_users),
            "reports_generated": reports_generated,
            "completed_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Monthly reports failed: {str(e)}")
        raise self.retry(countdown=600, exc=e)

# Pomocné úlohy pro monitoring
@celery_app.task
def system_health_check():
    """Kontrola zdraví systému"""
    try:
        db = next(get_db())
        
        # Test databázového připojení
        user_count = db.query(User).count()
        
        # Test Redis připojení (přes Celery broker)
        from celery import current_app
        i = current_app.control.inspect()
        stats = i.stats()
        
        db.close()
        
        return {
            "status": "healthy",
            "database": "connected",
            "users_count": user_count,
            "redis": "connected" if stats else "disconnected",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@celery_app.task
def get_system_statistics():
    """Získání systémových statistik"""
    try:
        db = next(get_db())
        
        stats = {
            "users": {
                "total": db.query(User).count(),
                "active": db.query(User).filter(User.is_active == True).count(),
                "premium": db.query(User).filter(User.is_premium == True).count()
            },
            "collections": {
                "total": db.query(Collection).count(),
                "with_coins": db.query(Collection).filter(Collection.coins.any()).count()
            },
            "coins": {
                "total": db.query(Coin).count(),
                "with_images": db.query(Coin).filter(Coin.images.any()).count(),
                "favorites": db.query(Coin).filter(Coin.is_favorite == True).count()
            },
            "timestamp": datetime.now().isoformat()
        }
        
        db.close()
        return stats
        
    except Exception as e:
        logger.error(f"Statistics collection failed: {str(e)}")
        return {"error": str(e), "timestamp": datetime.now().isoformat()}