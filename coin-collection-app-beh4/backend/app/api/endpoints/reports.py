from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
import json

from ...database import get_db
from ...services.report_service import ReportService
from ...models.user import User
from ...core.auth import get_current_user

router = APIRouter()

@router.post("/collections/{collection_id}/reports/generate")
async def generate_collection_report(
    collection_id: int,
    report_type: str = Query("comprehensive", description="Typ reportu: comprehensive, financial, inventory, market_analysis"),
    format_type: str = Query("pdf", description="Formát výstupu: pdf, excel, json"),
    include_charts: bool = Query(True, description="Zahrnout grafy"),
    include_images: bool = Query(False, description="Zahrnout obrázky"),
    date_from: Optional[date] = Query(None, description="Datum od (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="Datum do (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generuje report kolekce v požadovaném formátu
    """
    try:
        report_service = ReportService(db)
        
        # Převod datumů
        date_range = None
        if date_from and date_to:
            date_range = (
                datetime.combine(date_from, datetime.min.time()),
                datetime.combine(date_to, datetime.max.time())
            )
        
        # Generování reportu
        result = report_service.generate_collection_report(
            collection_id=collection_id,
            report_type=report_type,
            date_range=date_range,
            include_charts=include_charts,
            include_images=include_images,
            format_type=format_type
        )
        
        if format_type in ["pdf", "excel"]:
            # Vrácení binárního souboru
            return Response(
                content=result["content"],
                media_type=result["content_type"],
                headers={
                    "Content-Disposition": f"attachment; filename={result['filename']}"
                }
            )
        else:
            # Vrácení JSON dat
            return result["content"]
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při generování reportu: {str(e)}")

@router.get("/collections/{collection_id}/reports/preview")
async def preview_collection_report(
    collection_id: int,
    report_type: str = Query("comprehensive", description="Typ reportu"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Náhled reportu kolekce (pouze JSON data bez generování PDF/Excel)
    """
    try:
        report_service = ReportService(db)
        
        result = report_service.generate_collection_report(
            collection_id=collection_id,
            report_type=report_type,
            include_charts=False,
            include_images=False,
            format_type="json"
        )
        
        return result["content"]
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při náhledu reportu: {str(e)}")

@router.post("/reports/comparison")
async def generate_comparison_report(
    collection_ids: List[int],
    comparison_type: str = Query("basic", description="Typ srovnání"),
    format_type: str = Query("json", description="Formát výstupu"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generuje srovnávací report mezi kolekcemi
    """
    try:
        if len(collection_ids) < 2:
            raise HTTPException(status_code=400, detail="Pro srovnání je potřeba alespoň 2 kolekce")
        
        if len(collection_ids) > 10:
            raise HTTPException(status_code=400, detail="Maximálně lze srovnat 10 kolekcí najednou")
        
        report_service = ReportService(db)
        
        result = report_service.generate_comparison_report(
            collection_ids=collection_ids,
            comparison_type=comparison_type
        )
        
        if format_type == "json":
            return result
        else:
            # Pro jiné formáty by se implementovalo generování PDF/Excel
            return result
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při generování srovnávacího reportu: {str(e)}")

@router.get("/collections/{collection_id}/reports/trends")
async def get_trend_analysis(
    collection_id: int,
    period_months: int = Query(12, description="Období v měsících", ge=1, le=60),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Analýza trendů kolekce za určité období
    """
    try:
        report_service = ReportService(db)
        
        result = report_service.generate_trend_analysis(
            collection_id=collection_id,
            period_months=period_months
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při analýze trendů: {str(e)}")

@router.get("/reports/templates")
async def get_report_templates(
    current_user: User = Depends(get_current_user)
):
    """
    Získání dostupných šablon reportů
    """
    templates = {
        "comprehensive": {
            "name": "Komplexní report",
            "description": "Úplný přehled kolekce včetně všech analýz",
            "sections": [
                "Základní informace",
                "Finanční přehled", 
                "Analýza podle zemí",
                "Analýza podle materiálů",
                "Top cenné mince",
                "Analýza stavu mincí",
                "Grafy a vizualizace"
            ],
            "formats": ["pdf", "excel", "json"],
            "estimated_time": "2-5 minut"
        },
        "financial": {
            "name": "Finanční analýza",
            "description": "Zaměření na finanční metriky a ROI",
            "sections": [
                "Finanční přehled",
                "ROI analýza",
                "Analýza podle roků pořízení",
                "Top/worst performers",
                "Analýza rizika"
            ],
            "formats": ["pdf", "excel", "json"],
            "estimated_time": "1-3 minuty"
        },
        "inventory": {
            "name": "Inventární report",
            "description": "Kompletní seznam mincí s detaily",
            "sections": [
                "Kompletní inventář",
                "Statistiky podle kategorií",
                "Mince bez hodnoty",
                "Oblíbené mince"
            ],
            "formats": ["pdf", "excel", "json"],
            "estimated_time": "1-2 minuty"
        },
        "market_analysis": {
            "name": "Tržní analýza",
            "description": "Analýza tržních trendů a doporučení",
            "sections": [
                "Tržní trendy",
                "Analýza podle materiálů",
                "Analýza vzácných mincí",
                "Investiční doporučení"
            ],
            "formats": ["pdf", "excel", "json"],
            "estimated_time": "2-4 minuty"
        }
    }
    
    return {
        "templates": templates,
        "supported_formats": {
            "pdf": {
                "name": "PDF",
                "description": "Profesionální report s grafy a tabulkami",
                "max_size_mb": 50
            },
            "excel": {
                "name": "Excel",
                "description": "Strukturovaná data v Excel sešitech",
                "max_size_mb": 25
            },
            "json": {
                "name": "JSON",
                "description": "Strukturovaná data pro další zpracování",
                "max_size_mb": 10
            }
        }
    }

@router.get("/collections/{collection_id}/reports/statistics")
async def get_report_statistics(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Základní statistiky pro rychlý přehled před generováním reportu
    """
    try:
        from ...models.coin import Coin
        from ...models.collection import Collection
        
        # Ověření existence kolekce
        collection = db.query(Collection).filter(Collection.id == collection_id).first()
        if not collection:
            raise HTTPException(status_code=404, detail="Kolekce nenalezena")
        
        # Základní statistiky
        coins = db.query(Coin).filter(Coin.collection_id == collection_id).all()
        
        total_coins = len(coins)
        coins_with_values = [coin for coin in coins if coin.current_value]
        coins_with_acquisition_prices = [coin for coin in coins if coin.acquisition_price]
        
        total_value = sum(coin.current_value for coin in coins_with_values)
        total_investment = sum(coin.acquisition_price for coin in coins_with_acquisition_prices)
        
        # Počty podle kategorií
        countries = set(coin.country for coin in coins)
        materials = set(coin.material for coin in coins)
        conditions = set(coin.condition for coin in coins)
        rarities = set(coin.rarity for coin in coins)
        
        # Rozsah roků
        years = [coin.year for coin in coins]
        year_range = (min(years), max(years)) if years else (None, None)
        
        statistics = {
            "collection_info": {
                "name": collection.name,
                "description": collection.description,
                "created_at": collection.created_at.isoformat()
            },
            "basic_stats": {
                "total_coins": total_coins,
                "coins_with_values": len(coins_with_values),
                "coins_with_acquisition_prices": len(coins_with_acquisition_prices),
                "total_value": total_value,
                "total_investment": total_investment,
                "profit_loss": total_value - total_investment,
                "data_completeness_percent": (len(coins_with_values) / total_coins * 100) if total_coins > 0 else 0
            },
            "diversity_stats": {
                "unique_countries": len(countries),
                "unique_materials": len(materials),
                "unique_conditions": len(conditions),
                "unique_rarities": len(rarities),
                "year_range": year_range
            },
            "report_recommendations": []
        }
        
        # Doporučení reportů
        if len(coins_with_values) >= 10:
            statistics["report_recommendations"].append({
                "type": "financial",
                "reason": "Dostatek dat pro finanční analýzu",
                "priority": "high"
            })
        
        if len(countries) >= 5:
            statistics["report_recommendations"].append({
                "type": "comprehensive",
                "reason": "Rozmanitá kolekce vhodná pro komplexní analýzu",
                "priority": "high"
            })
        
        if total_coins >= 50:
            statistics["report_recommendations"].append({
                "type": "inventory",
                "reason": "Velká kolekce vhodná pro inventární report",
                "priority": "medium"
            })
        
        return statistics
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při získávání statistik: {str(e)}")

@router.get("/reports/history")
async def get_report_history(
    limit: int = Query(20, description="Počet záznamů", ge=1, le=100),
    offset: int = Query(0, description="Offset", ge=0),
    collection_id: Optional[int] = Query(None, description="Filtr podle kolekce"),
    current_user: User = Depends(get_current_user)
):
    """
    Historie generovaných reportů (simulace - v reálné aplikaci by se ukládala do DB)
    """
    # Simulace historie reportů
    history = [
        {
            "id": 1,
            "collection_id": 1,
            "collection_name": "Evropské mince",
            "report_type": "comprehensive",
            "format": "pdf",
            "generated_at": "2024-01-15T10:30:00",
            "file_size_mb": 2.5,
            "status": "completed"
        },
        {
            "id": 2,
            "collection_id": 1,
            "collection_name": "Evropské mince",
            "report_type": "financial",
            "format": "excel",
            "generated_at": "2024-01-10T14:20:00",
            "file_size_mb": 1.2,
            "status": "completed"
        },
        {
            "id": 3,
            "collection_id": 2,
            "collection_name": "Americké mince",
            "report_type": "inventory",
            "format": "pdf",
            "generated_at": "2024-01-08T09:15:00",
            "file_size_mb": 3.1,
            "status": "completed"
        }
    ]
    
    # Filtrování podle kolekce
    if collection_id:
        history = [h for h in history if h["collection_id"] == collection_id]
    
    # Paginace
    total = len(history)
    history = history[offset:offset + limit]
    
    return {
        "history": history,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@router.delete("/reports/history/{report_id}")
async def delete_report_from_history(
    report_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Smazání reportu z historie (simulace)
    """
    # V reálné aplikaci by se smazal záznam z databáze a soubor z úložiště
    return {
        "message": f"Report {report_id} byl smazán z historie",
        "deleted_at": datetime.now().isoformat()
    }

@router.post("/reports/schedule")
async def schedule_report(
    collection_id: int,
    report_type: str,
    schedule_type: str = Query(..., description="daily, weekly, monthly"),
    format_type: str = Query("pdf", description="Formát reportu"),
    email_recipients: List[str] = Query([], description="Email příjemci"),
    current_user: User = Depends(get_current_user)
):
    """
    Naplánování automatického generování reportů (simulace)
    """
    if schedule_type not in ["daily", "weekly", "monthly"]:
        raise HTTPException(status_code=400, detail="Neplatný typ plánu")
    
    # Simulace vytvoření plánu
    schedule_id = 12345  # V reálné aplikaci by se uložilo do DB
    
    return {
        "schedule_id": schedule_id,
        "collection_id": collection_id,
        "report_type": report_type,
        "schedule_type": schedule_type,
        "format_type": format_type,
        "email_recipients": email_recipients,
        "next_execution": "2024-01-16T09:00:00",
        "status": "active",
        "created_at": datetime.now().isoformat()
    }

@router.get("/reports/schedules")
async def get_scheduled_reports(
    current_user: User = Depends(get_current_user)
):
    """
    Seznam naplánovaných reportů (simulace)
    """
    schedules = [
        {
            "schedule_id": 12345,
            "collection_id": 1,
            "collection_name": "Evropské mince",
            "report_type": "comprehensive",
            "schedule_type": "weekly",
            "format_type": "pdf",
            "email_recipients": ["user@example.com"],
            "next_execution": "2024-01-16T09:00:00",
            "last_execution": "2024-01-09T09:00:00",
            "status": "active",
            "created_at": "2024-01-01T10:00:00"
        }
    ]
    
    return {
        "schedules": schedules,
        "total": len(schedules)
    }

@router.delete("/reports/schedules/{schedule_id}")
async def delete_scheduled_report(
    schedule_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Zrušení naplánovaného reportu (simulace)
    """
    return {
        "message": f"Plán reportu {schedule_id} byl zrušen",
        "cancelled_at": datetime.now().isoformat()
    }