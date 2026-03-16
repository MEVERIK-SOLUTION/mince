from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta

from ...database import get_db
from ...services.price_update_scheduler import price_update_scheduler
from ...services.price_service import price_service
from ...core.auth import get_current_user, get_current_admin_user
from ...models.user import User
from ...models.coin import Coin, PriceHistory

router = APIRouter()

@router.get("/status")
async def get_update_status(
    current_user: User = Depends(get_current_user)
):
    """
    Získání stavu cenových aktualizací
    """
    try:
        status = await price_update_scheduler.get_update_status()
        return {
            "success": True,
            "status": status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při získávání stavu: {str(e)}")

@router.post("/force-update/{coin_id}")
async def force_update_coin(
    coin_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Vynucená aktualizace ceny konkrétní mince
    """
    try:
        # Kontrola existence mince
        coin = db.query(Coin).filter(Coin.id == coin_id).first()
        if not coin:
            raise HTTPException(status_code=404, detail="Mince nenalezena")
        
        # Spuštění aktualizace na pozadí
        background_tasks.add_task(price_update_scheduler.force_update_coin, coin_id)
        
        return {
            "success": True,
            "message": f"Aktualizace ceny mince '{coin.name}' byla spuštěna",
            "coin_id": coin_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při spuštění aktualizace: {str(e)}")

@router.post("/batch-update")
async def batch_update_coins(
    coin_ids: List[int],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dávková aktualizace cen více mincí
    """
    try:
        if len(coin_ids) > 100:
            raise HTTPException(status_code=400, detail="Maximálně 100 mincí najednou")
        
        # Kontrola existence mincí
        existing_coins = db.query(Coin).filter(Coin.id.in_(coin_ids)).all()
        existing_ids = [coin.id for coin in existing_coins]
        missing_ids = [coin_id for coin_id in coin_ids if coin_id not in existing_ids]
        
        if missing_ids:
            raise HTTPException(
                status_code=404, 
                detail=f"Mince nenalezeny: {missing_ids}"
            )
        
        # Spuštění dávkové aktualizace na pozadí
        async def batch_update_task():
            async with price_service as pricer:
                return await pricer.update_coin_prices(coin_ids, db)
        
        background_tasks.add_task(batch_update_task)
        
        return {
            "success": True,
            "message": f"Dávková aktualizace {len(coin_ids)} mincí byla spuštěna",
            "coin_count": len(coin_ids)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při dávkové aktualizaci: {str(e)}")

@router.get("/price-trends/{coin_id}")
async def get_price_trends(
    coin_id: int,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Získání cenových trendů pro minci
    """
    try:
        if days > 365:
            days = 365
        
        # Kontrola existence mince
        coin = db.query(Coin).filter(Coin.id == coin_id).first()
        if not coin:
            raise HTTPException(status_code=404, detail="Mince nenalezena")
        
        async with price_service as pricer:
            trends = await pricer.get_price_trends(coin_id, db, days)
        
        if not trends.get('success'):
            raise HTTPException(status_code=404, detail=trends.get('error', 'Žádná data'))
        
        return {
            "success": True,
            "coin_id": coin_id,
            "coin_name": coin.name,
            "trends": trends
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při získávání trendů: {str(e)}")

@router.get("/price-history/{coin_id}")
async def get_price_history(
    coin_id: int,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Získání historie cen mince
    """
    try:
        # Kontrola existence mince
        coin = db.query(Coin).filter(Coin.id == coin_id).first()
        if not coin:
            raise HTTPException(status_code=404, detail="Mince nenalezena")
        
        # Získání historie cen
        price_history = db.query(PriceHistory).filter(
            PriceHistory.coin_id == coin_id
        ).order_by(PriceHistory.created_at.desc()).offset(offset).limit(limit).all()
        
        # Celkový počet záznamů
        total_count = db.query(PriceHistory).filter(
            PriceHistory.coin_id == coin_id
        ).count()
        
        history_data = []
        for record in price_history:
            history_data.append({
                "id": record.id,
                "price": record.price,
                "currency": record.currency,
                "source": record.source,
                "confidence": record.confidence,
                "previous_price": record.previous_price,
                "created_at": record.created_at.isoformat(),
                "price_change": record.price - record.previous_price if record.previous_price else 0,
                "price_change_percent": (
                    ((record.price - record.previous_price) / record.previous_price * 100) 
                    if record.previous_price and record.previous_price > 0 else 0
                )
            })
        
        return {
            "success": True,
            "coin_id": coin_id,
            "coin_name": coin.name,
            "history": history_data,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": offset + limit < total_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při získávání historie: {str(e)}")

@router.get("/market-overview")
async def get_market_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Přehled trhu - statistiky cen a trendů
    """
    try:
        # Základní statistiky
        total_coins = db.query(Coin).count()
        coins_with_prices = db.query(Coin).filter(Coin.current_value.isnot(None)).count()
        
        # Nejdražší mince
        most_expensive = db.query(Coin).filter(
            Coin.current_value.isnot(None)
        ).order_by(Coin.current_value.desc()).limit(5).all()
        
        # Nedávno aktualizované mince
        recently_updated = db.query(Coin).filter(
            Coin.last_price_update.isnot(None)
        ).order_by(Coin.last_price_update.desc()).limit(10).all()
        
        # Cenové změny za posledních 24 hodin
        yesterday = datetime.utcnow() - timedelta(days=1)
        recent_changes = db.query(PriceHistory).filter(
            PriceHistory.created_at >= yesterday,
            PriceHistory.previous_price.isnot(None)
        ).all()
        
        # Výpočet statistik změn
        price_changes = []
        for change in recent_changes:
            if change.previous_price and change.previous_price > 0:
                change_percent = ((change.price - change.previous_price) / change.previous_price) * 100
                price_changes.append({
                    "coin_id": change.coin_id,
                    "change_percent": change_percent,
                    "change_absolute": change.price - change.previous_price
                })
        
        # Top gainers a losers
        price_changes.sort(key=lambda x: x["change_percent"], reverse=True)
        top_gainers = price_changes[:5]
        top_losers = price_changes[-5:]
        
        # Průměrná změna
        avg_change = sum(c["change_percent"] for c in price_changes) / len(price_changes) if price_changes else 0
        
        # Drahé kovy - aktuální ceny
        async with price_service as pricer:
            metal_prices = await pricer.get_precious_metal_prices()
        
        return {
            "success": True,
            "statistics": {
                "total_coins": total_coins,
                "coins_with_prices": coins_with_prices,
                "price_coverage_percent": (coins_with_prices / total_coins * 100) if total_coins > 0 else 0,
                "average_price_change_24h": avg_change,
                "total_price_updates_24h": len(recent_changes)
            },
            "most_expensive": [
                {
                    "id": coin.id,
                    "name": coin.name,
                    "country": coin.country,
                    "year": coin.year,
                    "current_value": coin.current_value,
                    "currency": coin.currency
                }
                for coin in most_expensive
            ],
            "recently_updated": [
                {
                    "id": coin.id,
                    "name": coin.name,
                    "current_value": coin.current_value,
                    "currency": coin.currency,
                    "last_update": coin.last_price_update.isoformat() if coin.last_price_update else None
                }
                for coin in recently_updated
            ],
            "top_gainers": top_gainers,
            "top_losers": top_losers,
            "precious_metals": metal_prices if metal_prices.get('success') else {}
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při získávání přehledu trhu: {str(e)}")

@router.post("/scheduler/start")
async def start_scheduler(
    current_user: User = Depends(get_current_admin_user)
):
    """
    Spuštění plánovače cenových aktualizací (pouze admin)
    """
    try:
        price_update_scheduler.start_scheduler()
        return {
            "success": True,
            "message": "Plánovač cenových aktualizací byl spuštěn"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při spuštění plánovače: {str(e)}")

@router.post("/scheduler/stop")
async def stop_scheduler(
    current_user: User = Depends(get_current_admin_user)
):
    """
    Zastavení plánovače cenových aktualizací (pouze admin)
    """
    try:
        price_update_scheduler.stop_scheduler()
        return {
            "success": True,
            "message": "Plánovač cenových aktualizací byl zastaven"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při zastavení plánovače: {str(e)}")

@router.put("/scheduler/config")
async def update_scheduler_config(
    config: Dict[str, Any],
    current_user: User = Depends(get_current_admin_user)
):
    """
    Aktualizace konfigurace plánovače (pouze admin)
    """
    try:
        price_update_scheduler.update_config(config)
        return {
            "success": True,
            "message": "Konfigurace plánovače byla aktualizována",
            "new_config": config
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při aktualizaci konfigurace: {str(e)}")

@router.get("/estimate-value/{coin_id}")
async def estimate_coin_value(
    coin_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Odhad hodnoty konkrétní mince
    """
    try:
        # Kontrola existence mince
        coin = db.query(Coin).filter(Coin.id == coin_id).first()
        if not coin:
            raise HTTPException(status_code=404, detail="Mince nenalezena")
        
        async with price_service as pricer:
            estimate = await pricer.estimate_coin_value(coin, db)
        
        if not estimate.get('success'):
            raise HTTPException(status_code=500, detail=estimate.get('error', 'Odhad se nezdařil'))
        
        return {
            "success": True,
            "coin_id": coin_id,
            "coin_name": coin.name,
            "estimate": estimate
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při odhadu hodnoty: {str(e)}")

@router.get("/price-alerts")
async def get_price_alerts(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Získání upozornění na významné změny cen
    """
    try:
        # Získání mincí s významnými změnami cen
        since_date = datetime.utcnow() - timedelta(days=days)
        
        # Subquery pro poslední cenu každé mince
        latest_prices = db.query(
            PriceHistory.coin_id,
            PriceHistory.price.label('latest_price'),
            PriceHistory.previous_price,
            PriceHistory.created_at
        ).filter(
            PriceHistory.created_at >= since_date,
            PriceHistory.previous_price.isnot(None)
        ).order_by(PriceHistory.created_at.desc()).all()
        
        alerts = []
        threshold = 0.05  # 5% změna
        
        for record in latest_prices:
            if record.previous_price and record.previous_price > 0:
                change_percent = abs(record.latest_price - record.previous_price) / record.previous_price
                
                if change_percent >= threshold:
                    coin = db.query(Coin).filter(Coin.id == record.coin_id).first()
                    if coin:
                        alerts.append({
                            "coin_id": coin.id,
                            "coin_name": coin.name,
                            "previous_price": record.previous_price,
                            "current_price": record.latest_price,
                            "change_percent": change_percent * 100,
                            "change_direction": "up" if record.latest_price > record.previous_price else "down",
                            "timestamp": record.created_at.isoformat()
                        })
        
        # Seřazení podle velikosti změny
        alerts.sort(key=lambda x: x["change_percent"], reverse=True)
        
        return {
            "success": True,
            "alerts": alerts[:20],  # Top 20 změn
            "period_days": days,
            "threshold_percent": threshold * 100
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při získávání upozornění: {str(e)}")