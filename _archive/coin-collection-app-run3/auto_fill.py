from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import json
import tempfile
import os

from ...database import get_db
from ...services.auto_fill_service import auto_fill_service
from ...core.auth import get_current_user
from ...models.user import User

router = APIRouter()

@router.post("/analyze-images")
async def analyze_coin_images(
    images: List[UploadFile] = File(...),
    user_input: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Analýza obrázků mincí a automatické předvyplnění formuláře
    """
    if not images:
        raise HTTPException(status_code=400, detail="Nejméně jeden obrázek je vyžadován")
    
    if len(images) > 10:
        raise HTTPException(status_code=400, detail="Maximálně 10 obrázků najednou")
    
    temp_files = []
    try:
        # Uložení dočasných souborů
        image_paths = []
        for image in images:
            # Validace typu souboru
            if not image.content_type or not image.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail=f"Neplatný typ souboru: {image.filename}")
            
            # Vytvoření dočasného souboru
            suffix = os.path.splitext(image.filename)[1] if image.filename else '.jpg'
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            temp_files.append(temp_file.name)
            
            # Zápis obsahu
            content = await image.read()
            temp_file.write(content)
            temp_file.close()
            
            image_paths.append(temp_file.name)
        
        # Zpracování uživatelského vstupu
        user_data = {}
        if user_input:
            try:
                user_data = json.loads(user_input)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Neplatný JSON v user_input")
        
        # Analýza a automatické vyplnění
        result = await auto_fill_service.analyze_and_fill_form(
            image_paths=image_paths,
            user_input=user_data,
            db=db
        )
        
        if not result.get('success'):
            raise HTTPException(
                status_code=500, 
                detail=f"Analýza selhala: {result.get('error', 'Neznámá chyba')}"
            )
        
        # Získání návrhů podobných mincí
        similar_coins = await auto_fill_service.get_similar_coins_suggestions(
            coin_data=result['form_data'],
            db=db,
            limit=5
        )
        
        return {
            "success": True,
            "form_data": result['form_data'],
            "price_data": result.get('price_data', {}),
            "confidence": result['confidence'],
            "suggestions": result.get('suggestions', {}),
            "similar_coins": similar_coins,
            "metadata": result.get('metadata', {}),
            "ai_source": result.get('ai_source'),
            "processing_time": result.get('processing_time', 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při zpracování: {str(e)}")
    
    finally:
        # Vyčištění dočasných souborů
        for temp_file in temp_files:
            try:
                os.unlink(temp_file)
            except OSError:
                pass

@router.post("/suggest-similar")
async def suggest_similar_coins(
    coin_data: Dict[str, Any],
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Získání návrhů podobných mincí na základě zadaných dat
    """
    try:
        if limit > 20:
            limit = 20
        
        similar_coins = await auto_fill_service.get_similar_coins_suggestions(
            coin_data=coin_data,
            db=db,
            limit=limit
        )
        
        return {
            "success": True,
            "similar_coins": similar_coins,
            "count": len(similar_coins)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při hledání podobných mincí: {str(e)}")

@router.post("/validate-form-data")
async def validate_form_data(
    form_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """
    Validace dat formuláře před uložením
    """
    try:
        # Použití auto-fill služby pro validaci a čištění dat
        validated_data = auto_fill_service._validate_and_clean_data(form_data)
        
        # Generování návrhů pro chybějící pole
        suggestions = auto_fill_service._generate_field_suggestions(validated_data, form_data)
        
        # Kontrola povinných polí
        required_fields = ['name', 'country', 'year']
        missing_fields = [field for field in required_fields if field not in validated_data or not validated_data[field]]
        
        validation_errors = []
        
        # Specifické validace
        if 'year' in validated_data:
            year = validated_data['year']
            if year < 500 or year > 2030:
                validation_errors.append("Rok musí být mezi 500 a 2030")
        
        if 'weight' in validated_data:
            weight = validated_data['weight']
            if weight <= 0 or weight > 1000:
                validation_errors.append("Hmotnost musí být mezi 0 a 1000 gramů")
        
        if 'diameter' in validated_data:
            diameter = validated_data['diameter']
            if diameter <= 0 or diameter > 200:
                validation_errors.append("Průměr musí být mezi 0 a 200 mm")
        
        return {
            "success": len(validation_errors) == 0,
            "validated_data": validated_data,
            "suggestions": suggestions,
            "missing_required_fields": missing_fields,
            "validation_errors": validation_errors,
            "is_complete": len(missing_fields) == 0 and len(validation_errors) == 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při validaci: {str(e)}")

@router.get("/field-suggestions/{field_name}")
async def get_field_suggestions(
    field_name: str,
    query: Optional[str] = None,
    context: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Získání návrhů pro konkrétní pole formuláře
    """
    try:
        suggestions = []
        
        # Kontextová data pro lepší návrhy
        context_data = {}
        if context:
            try:
                context_data = json.loads(context)
            except json.JSONDecodeError:
                pass
        
        if field_name == "country":
            # Návrhy zemí na základě existujících dat
            from sqlalchemy import func
            countries = db.query(func.distinct(Coin.country)).filter(
                Coin.country.isnot(None)
            ).all()
            
            suggestions = [country[0] for country in countries if country[0]]
            
            if query:
                suggestions = [c for c in suggestions if query.lower() in c.lower()]
        
        elif field_name == "currency":
            if 'country' in context_data:
                suggestions = auto_fill_service._suggest_currency_by_country(context_data['country'])
            else:
                # Obecné návrhy měn
                from sqlalchemy import func
                currencies = db.query(func.distinct(Coin.currency)).filter(
                    Coin.currency.isnot(None)
                ).all()
                suggestions = [currency[0] for currency in currencies if currency[0]]
        
        elif field_name == "material":
            # Návrhy materiálů
            common_materials = [
                "Gold", "Silver", "Copper", "Bronze", "Brass", "Nickel", 
                "Aluminum", "Zinc", "Steel", "Iron", "Platinum", "Palladium",
                "Copper-Nickel", "Silver-Copper", "Gold-Silver", "Bimetallic"
            ]
            
            suggestions = common_materials
            if query:
                suggestions = [m for m in suggestions if query.lower() in m.lower()]
        
        elif field_name == "condition":
            # Standardní stavy mincí
            conditions = [
                "Poor", "Fair", "Good", "Very Good", "Fine", "Very Fine",
                "Extremely Fine", "About Uncirculated", "Uncirculated", "Proof"
            ]
            suggestions = conditions
        
        elif field_name == "rarity":
            # Úrovně vzácnosti
            rarities = ["Common", "Uncommon", "Scarce", "Rare", "Very Rare", "Extremely Rare"]
            suggestions = rarities
        
        elif field_name == "mint":
            # Návrhy mincoven na základě země
            if 'country' in context_data:
                country = context_data['country'].lower()
                mint_mapping = {
                    'united states': ['Philadelphia', 'Denver', 'San Francisco', 'West Point'],
                    'czech republic': ['Prague', 'Kremnica'],
                    'germany': ['Berlin', 'Munich', 'Stuttgart', 'Hamburg'],
                    'united kingdom': ['Royal Mint', 'London'],
                    'france': ['Paris', 'Monnaie de Paris'],
                    'italy': ['Rome', 'Milan'],
                    'austria': ['Vienna'],
                    'switzerland': ['Bern'],
                    'canada': ['Ottawa', 'Winnipeg'],
                    'australia': ['Perth', 'Melbourne', 'Sydney']
                }
                
                for country_key, mints in mint_mapping.items():
                    if country_key in country:
                        suggestions = mints
                        break
        
        # Filtrování podle query
        if query and suggestions:
            suggestions = [s for s in suggestions if query.lower() in s.lower()]
        
        # Omezení počtu návrhů
        suggestions = suggestions[:10]
        
        return {
            "success": True,
            "field": field_name,
            "suggestions": suggestions,
            "count": len(suggestions)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při získávání návrhů: {str(e)}")

@router.post("/auto-complete-form")
async def auto_complete_form(
    partial_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Automatické dokončení formuláře na základě částečných dat
    """
    try:
        # Generování návrhů pro chybějící pole
        suggestions = auto_fill_service._generate_field_suggestions(partial_data, partial_data)
        
        # Hledání podobných mincí pro inspiraci
        similar_coins = await auto_fill_service.get_similar_coins_suggestions(
            coin_data=partial_data,
            db=db,
            limit=3
        )
        
        # Automatické vyplnění na základě podobných mincí
        auto_filled = {}
        if similar_coins:
            best_match = similar_coins[0]  # Nejpodobnější mince
            
            # Pole, která můžeme automaticky vyplnit
            auto_fill_fields = ['material', 'mint', 'edge', 'designer']
            
            for field in auto_fill_fields:
                if field not in partial_data and field in best_match:
                    auto_filled[field] = best_match[field]
        
        return {
            "success": True,
            "suggestions": suggestions,
            "auto_filled": auto_filled,
            "similar_coins": similar_coins,
            "confidence": similar_coins[0]['similarity_score'] if similar_coins else 0.0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při automatickém dokončování: {str(e)}")