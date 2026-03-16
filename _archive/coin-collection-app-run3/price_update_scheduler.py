import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import schedule
import threading
import time

from ..database import SessionLocal
from ..models.coin import Coin, PriceHistory
from .price_service import price_service
from ..core.config import settings

logger = logging.getLogger(__name__)

class PriceUpdateScheduler:
    """
    Služba pro pravidelné aktualizace cen mincí
    """
    
    def __init__(self):
        self.is_running = False
        self.scheduler_thread = None
        self.update_intervals = {
            'hourly': timedelta(hours=1),
            'daily': timedelta(days=1),
            'weekly': timedelta(weeks=1),
            'monthly': timedelta(days=30)
        }
        
        # Konfigurace aktualizací
        self.config = {
            'precious_metals_interval': 'hourly',  # Drahé kovy se mění často
            'modern_coins_interval': 'daily',      # Moderní mince
            'historical_coins_interval': 'weekly', # Historické mince
            'rare_coins_interval': 'monthly',      # Vzácné mince
            'batch_size': 50,                      # Počet mincí v jedné dávce
            'max_concurrent_updates': 5,          # Maximální počet současných aktualizací
            'retry_failed_after': timedelta(hours=6),  # Opakování neúspěšných aktualizací
            'price_change_threshold': 0.05        # 5% změna pro notifikaci
        }
        
        self.update_stats = {
            'last_update': None,
            'total_updated': 0,
            'total_failed': 0,
            'current_batch': 0,
            'errors': []
        }
    
    def start_scheduler(self):
        """
        Spuštění plánovače aktualizací
        """
        if self.is_running:
            logger.warning("Price update scheduler is already running")
            return
        
        self.is_running = True
        
        # Naplánování různých typů aktualizací
        schedule.every().hour.do(self._update_precious_metals)
        schedule.every().day.at("02:00").do(self._update_modern_coins)
        schedule.every().week.do(self._update_historical_coins)
        schedule.every().month.do(self._update_rare_coins)
        
        # Čištění starých záznamů
        schedule.every().day.at("03:00").do(self._cleanup_old_price_history)
        
        # Spuštění plánovače v samostatném vlákně
        self.scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self.scheduler_thread.start()
        
        logger.info("Price update scheduler started")
    
    def stop_scheduler(self):
        """
        Zastavení plánovače aktualizací
        """
        self.is_running = False
        schedule.clear()
        
        if self.scheduler_thread:
            self.scheduler_thread.join(timeout=5)
        
        logger.info("Price update scheduler stopped")
    
    def _run_scheduler(self):
        """
        Hlavní smyčka plánovače
        """
        while self.is_running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Kontrola každou minutu
            except Exception as e:
                logger.error(f"Scheduler error: {str(e)}")
                time.sleep(300)  # Při chybě čekat 5 minut
    
    async def _update_precious_metals(self):
        """
        Aktualizace cen mincí z drahých kovů
        """
        logger.info("Starting precious metals price update")
        
        try:
            db = SessionLocal()
            
            # Mince z drahých kovů
            precious_metals = ['gold', 'silver', 'platinum', 'palladium']
            
            coins = db.query(Coin).filter(
                or_(*[Coin.material.ilike(f"%{metal}%") for metal in precious_metals]),
                or_(
                    Coin.last_price_update.is_(None),
                    Coin.last_price_update < datetime.utcnow() - self.update_intervals['hourly']
                )
            ).limit(self.config['batch_size']).all()
            
            if coins:
                await self._update_coin_batch(coins, db, "precious_metals")
            
        except Exception as e:
            logger.error(f"Precious metals update failed: {str(e)}")
            self.update_stats['errors'].append({
                'timestamp': datetime.utcnow(),
                'type': 'precious_metals',
                'error': str(e)
            })
        finally:
            db.close()
    
    async def _update_modern_coins(self):
        """
        Aktualizace cen moderních mincí (po roce 1950)
        """
        logger.info("Starting modern coins price update")
        
        try:
            db = SessionLocal()
            
            coins = db.query(Coin).filter(
                Coin.year >= 1950,
                or_(
                    Coin.last_price_update.is_(None),
                    Coin.last_price_update < datetime.utcnow() - self.update_intervals['daily']
                )
            ).limit(self.config['batch_size']).all()
            
            if coins:
                await self._update_coin_batch(coins, db, "modern_coins")
            
        except Exception as e:
            logger.error(f"Modern coins update failed: {str(e)}")
            self.update_stats['errors'].append({
                'timestamp': datetime.utcnow(),
                'type': 'modern_coins',
                'error': str(e)
            })
        finally:
            db.close()
    
    async def _update_historical_coins(self):
        """
        Aktualizace cen historických mincí (1800-1950)
        """
        logger.info("Starting historical coins price update")
        
        try:
            db = SessionLocal()
            
            coins = db.query(Coin).filter(
                and_(Coin.year >= 1800, Coin.year < 1950),
                or_(
                    Coin.last_price_update.is_(None),
                    Coin.last_price_update < datetime.utcnow() - self.update_intervals['weekly']
                )
            ).limit(self.config['batch_size']).all()
            
            if coins:
                await self._update_coin_batch(coins, db, "historical_coins")
            
        except Exception as e:
            logger.error(f"Historical coins update failed: {str(e)}")
            self.update_stats['errors'].append({
                'timestamp': datetime.utcnow(),
                'type': 'historical_coins',
                'error': str(e)
            })
        finally:
            db.close()
    
    async def _update_rare_coins(self):
        """
        Aktualizace cen vzácných mincí (před rokem 1800 nebo označené jako vzácné)
        """
        logger.info("Starting rare coins price update")
        
        try:
            db = SessionLocal()
            
            coins = db.query(Coin).filter(
                or_(
                    Coin.year < 1800,
                    Coin.rarity.in_(['Rare', 'Very Rare', 'Extremely Rare'])
                ),
                or_(
                    Coin.last_price_update.is_(None),
                    Coin.last_price_update < datetime.utcnow() - self.update_intervals['monthly']
                )
            ).limit(self.config['batch_size']).all()
            
            if coins:
                await self._update_coin_batch(coins, db, "rare_coins")
            
        except Exception as e:
            logger.error(f"Rare coins update failed: {str(e)}")
            self.update_stats['errors'].append({
                'timestamp': datetime.utcnow(),
                'type': 'rare_coins',
                'error': str(e)
            })
        finally:
            db.close()
    
    async def _update_coin_batch(self, coins: List[Coin], db: Session, update_type: str):
        """
        Aktualizace dávky mincí
        """
        coin_ids = [coin.id for coin in coins]
        
        logger.info(f"Updating {len(coins)} coins in {update_type} batch")
        
        try:
            async with price_service as pricer:
                results = await pricer.update_coin_prices(coin_ids, db)
            
            # Aktualizace timestampu
            for coin in coins:
                coin.last_price_update = datetime.utcnow()
            
            db.commit()
            
            # Aktualizace statistik
            self.update_stats['total_updated'] += results['updated']
            self.update_stats['total_failed'] += results['failed']
            self.update_stats['last_update'] = datetime.utcnow()
            
            logger.info(f"Batch {update_type} completed: {results['updated']} updated, {results['failed']} failed")
            
            # Kontrola významných změn cen
            await self._check_significant_price_changes(coins, db)
            
        except Exception as e:
            logger.error(f"Batch update failed for {update_type}: {str(e)}")
            self.update_stats['total_failed'] += len(coins)
            raise
    
    async def _check_significant_price_changes(self, coins: List[Coin], db: Session):
        """
        Kontrola významných změn cen a vytvoření notifikací
        """
        threshold = self.config['price_change_threshold']
        
        for coin in coins:
            try:
                # Získání posledních dvou cenových záznamů
                recent_prices = db.query(PriceHistory).filter(
                    PriceHistory.coin_id == coin.id
                ).order_by(PriceHistory.created_at.desc()).limit(2).all()
                
                if len(recent_prices) >= 2:
                    current_price = recent_prices[0].price
                    previous_price = recent_prices[1].price
                    
                    if previous_price > 0:
                        change_percent = abs(current_price - previous_price) / previous_price
                        
                        if change_percent >= threshold:
                            await self._create_price_alert(coin, current_price, previous_price, change_percent)
                
            except Exception as e:
                logger.warning(f"Failed to check price change for coin {coin.id}: {str(e)}")
    
    async def _create_price_alert(self, coin: Coin, current_price: float, previous_price: float, change_percent: float):
        """
        Vytvoření upozornění na významnou změnu ceny
        """
        try:
            change_direction = "vzrostla" if current_price > previous_price else "klesla"
            
            alert_data = {
                'coin_id': coin.id,
                'coin_name': coin.name,
                'previous_price': previous_price,
                'current_price': current_price,
                'change_percent': change_percent * 100,
                'change_direction': change_direction,
                'timestamp': datetime.utcnow()
            }
            
            logger.info(f"Price alert: {coin.name} - cena {change_direction} o {change_percent*100:.1f}%")
            
            # Zde by se mohlo poslat upozornění uživatelům
            # např. email, push notifikace, webhook, atd.
            
        except Exception as e:
            logger.error(f"Failed to create price alert: {str(e)}")
    
    def _cleanup_old_price_history(self):
        """
        Čištění starých cenových záznamů
        """
        try:
            db = SessionLocal()
            
            # Smazání záznamů starších než 2 roky
            cutoff_date = datetime.utcnow() - timedelta(days=730)
            
            deleted_count = db.query(PriceHistory).filter(
                PriceHistory.created_at < cutoff_date
            ).delete()
            
            db.commit()
            
            logger.info(f"Cleaned up {deleted_count} old price history records")
            
        except Exception as e:
            logger.error(f"Price history cleanup failed: {str(e)}")
        finally:
            db.close()
    
    async def force_update_coin(self, coin_id: int) -> Dict:
        """
        Vynucená aktualizace konkrétní mince
        """
        try:
            db = SessionLocal()
            
            coin = db.query(Coin).filter(Coin.id == coin_id).first()
            if not coin:
                return {
                    'success': False,
                    'error': 'Mince nenalezena'
                }
            
            async with price_service as pricer:
                results = await pricer.update_coin_prices([coin_id], db)
            
            coin.last_price_update = datetime.utcnow()
            db.commit()
            
            return {
                'success': True,
                'updated': results['updated'],
                'failed': results['failed'],
                'errors': results.get('errors', [])
            }
            
        except Exception as e:
            logger.error(f"Force update failed for coin {coin_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
        finally:
            db.close()
    
    async def get_update_status(self) -> Dict:
        """
        Získání stavu aktualizací
        """
        try:
            db = SessionLocal()
            
            # Statistiky z databáze
            total_coins = db.query(Coin).count()
            coins_with_prices = db.query(Coin).filter(Coin.current_value.isnot(None)).count()
            
            # Mince potřebující aktualizaci
            needs_update = db.query(Coin).filter(
                or_(
                    Coin.last_price_update.is_(None),
                    Coin.last_price_update < datetime.utcnow() - timedelta(days=7)
                )
            ).count()
            
            # Poslední aktualizace
            last_price_update = db.query(PriceHistory).order_by(
                PriceHistory.created_at.desc()
            ).first()
            
            return {
                'scheduler_running': self.is_running,
                'total_coins': total_coins,
                'coins_with_prices': coins_with_prices,
                'coverage_percent': (coins_with_prices / total_coins * 100) if total_coins > 0 else 0,
                'needs_update': needs_update,
                'last_update': self.update_stats['last_update'],
                'total_updated': self.update_stats['total_updated'],
                'total_failed': self.update_stats['total_failed'],
                'recent_errors': self.update_stats['errors'][-10:],  # Posledních 10 chyb
                'last_price_update': last_price_update.created_at if last_price_update else None
            }
            
        except Exception as e:
            logger.error(f"Failed to get update status: {str(e)}")
            return {
                'error': str(e)
            }
        finally:
            db.close()
    
    def update_config(self, new_config: Dict):
        """
        Aktualizace konfigurace plánovače
        """
        try:
            for key, value in new_config.items():
                if key in self.config:
                    self.config[key] = value
            
            logger.info(f"Scheduler config updated: {new_config}")
            
        except Exception as e:
            logger.error(f"Failed to update config: {str(e)}")

# Singleton instance
price_update_scheduler = PriceUpdateScheduler()

# Automatické spuštění při importu (pokud je povoleno)
if getattr(settings, 'AUTO_START_PRICE_SCHEDULER', True):
    price_update_scheduler.start_scheduler()