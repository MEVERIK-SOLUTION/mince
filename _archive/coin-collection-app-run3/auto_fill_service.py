import asyncio
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from .coin_identification import coin_identification_service
from .price_service import price_service
from ..models.coin import Coin
from ..core.config import settings

logger = logging.getLogger(__name__)

class AutoFillService:
    """
    Služba pro automatické předvyplnění formulářů na základě AI identifikace
    """
    
    def __init__(self):
        self.confidence_threshold = 0.7  # Minimální confidence pro auto-fill
        self.field_mapping = {
            # Mapování AI výsledků na databázové pole
            'name': 'name',
            'country': 'country',
            'year': 'year',
            'denomination': 'denomination',
            'currency': 'currency',
            'material': 'material',
            'weight': 'weight',
            'diameter': 'diameter',
            'thickness': 'thickness',
            'mint': 'mint',
            'mintage': 'mintage',
            'designer': 'designer',
            'edge': 'edge',
            'obverse_description': 'obverse_description',
            'reverse_description': 'reverse_description',
            'historical_context': 'historical_context',
            'rarity': 'rarity',
            'condition': 'condition'
        }
    
    async def analyze_and_fill_form(
        self, 
        image_paths: List[str], 
        user_input: Dict = None,
        db: Session = None
    ) -> Dict:
        """
        Analýza obrázků a automatické předvyplnění formuláře
        """
        try:
            # 1. AI identifikace mince
            async with coin_identification_service as identifier:
                if len(image_paths) == 1:
                    identification_result = await identifier.identify_coin(image_paths[0])
                else:
                    identification_result = await identifier.batch_identify_coins(image_paths)
            
            if not identification_result.get('success'):
                return {
                    'success': False,
                    'error': 'Identifikace mince selhala',
                    'details': identification_result.get('error')
                }
            
            # 2. Zpracování výsledků identifikace
            coin_data = identification_result.get('coin_data', {})
            confidence = identification_result.get('confidence', 0.0)
            
            # 3. Získání cenových údajů
            price_data = {}
            if confidence >= self.confidence_threshold:
                async with price_service as pricer:
                    # Vytvoření dočasného objektu pro cenový odhad
                    temp_coin = self._create_temp_coin(coin_data)
                    price_estimate = await pricer.estimate_coin_value(temp_coin, db)
                    
                    if price_estimate.get('success'):
                        price_data = {
                            'estimated_value': price_estimate.get('estimated_value'),
                            'confidence': price_estimate.get('confidence'),
                            'currency': price_estimate.get('currency', 'USD'),
                            'sources': price_estimate.get('sources', [])
                        }
            
            # 4. Kombinace s uživatelským vstupem
            final_data = self._merge_with_user_input(coin_data, user_input or {})
            
            # 5. Validace a čištění dat
            validated_data = self._validate_and_clean_data(final_data)
            
            # 6. Generování návrhů pro neidentifikovaná pole
            suggestions = self._generate_field_suggestions(validated_data, coin_data)
            
            return {
                'success': True,
                'form_data': validated_data,
                'price_data': price_data,
                'confidence': confidence,
                'suggestions': suggestions,
                'ai_source': identification_result.get('source', 'unknown'),
                'processing_time': identification_result.get('processing_time', 0),
                'metadata': {
                    'auto_filled_fields': list(validated_data.keys()),
                    'high_confidence_fields': [
                        field for field, value in validated_data.items() 
                        if self._get_field_confidence(field, coin_data) >= self.confidence_threshold
                    ],
                    'requires_verification': [
                        field for field, value in validated_data.items() 
                        if self._get_field_confidence(field, coin_data) < self.confidence_threshold
                    ]
                }
            }
            
        except Exception as e:
            logger.error(f"Auto-fill failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _create_temp_coin(self, coin_data: Dict) -> Coin:
        """
        Vytvoření dočasného objektu Coin pro cenový odhad
        """
        temp_coin = Coin()
        
        for ai_field, db_field in self.field_mapping.items():
            if ai_field in coin_data:
                setattr(temp_coin, db_field, coin_data[ai_field])
        
        return temp_coin
    
    def _merge_with_user_input(self, ai_data: Dict, user_data: Dict) -> Dict:
        """
        Sloučení AI dat s uživatelským vstupem (uživatel má prioritu)
        """
        merged_data = ai_data.copy()
        
        # Uživatelský vstup přepíše AI data
        for field, value in user_data.items():
            if value is not None and value != '':
                merged_data[field] = value
        
        return merged_data
    
    def _validate_and_clean_data(self, data: Dict) -> Dict:
        """
        Validace a čištění dat před předvyplněním
        """
        cleaned_data = {}
        
        for field, value in data.items():
            if field not in self.field_mapping:
                continue
            
            cleaned_value = self._clean_field_value(field, value)
            if cleaned_value is not None:
                cleaned_data[field] = cleaned_value
        
        return cleaned_data
    
    def _clean_field_value(self, field: str, value) -> any:
        """
        Čištění hodnoty konkrétního pole
        """
        if value is None or value == '':
            return None
        
        try:
            # Číselné hodnoty
            if field in ['year', 'denomination', 'weight', 'diameter', 'thickness', 'mintage']:
                if isinstance(value, str):
                    # Odstranění nečíselných znaků
                    cleaned = ''.join(c for c in value if c.isdigit() or c in '.,')
                    if cleaned:
                        return float(cleaned.replace(',', '.'))
                elif isinstance(value, (int, float)):
                    return float(value)
                return None
            
            # Textové hodnoty
            elif field in ['name', 'country', 'currency', 'material', 'mint', 'designer', 'edge']:
                return str(value).strip().title()
            
            # Dlouhé textové hodnoty
            elif field in ['obverse_description', 'reverse_description', 'historical_context']:
                return str(value).strip()
            
            # Speciální pole
            elif field == 'condition':
                # Normalizace stavu mince
                condition_mapping = {
                    'poor': 'Poor',
                    'fair': 'Fair', 
                    'good': 'Good',
                    'very good': 'Very Good',
                    'fine': 'Fine',
                    'very fine': 'Very Fine',
                    'extremely fine': 'Extremely Fine',
                    'about uncirculated': 'About Uncirculated',
                    'uncirculated': 'Uncirculated',
                    'proof': 'Proof'
                }
                
                value_lower = str(value).lower()
                for key, normalized in condition_mapping.items():
                    if key in value_lower:
                        return normalized
                
                return str(value).strip()
            
            elif field == 'rarity':
                # Normalizace vzácnosti
                rarity_mapping = {
                    'common': 'Common',
                    'uncommon': 'Uncommon',
                    'scarce': 'Scarce',
                    'rare': 'Rare',
                    'very rare': 'Very Rare',
                    'extremely rare': 'Extremely Rare'
                }
                
                value_lower = str(value).lower()
                for key, normalized in rarity_mapping.items():
                    if key in value_lower:
                        return normalized
                
                return str(value).strip()
            
            else:
                return str(value).strip()
                
        except Exception as e:
            logger.warning(f"Failed to clean field {field} with value {value}: {str(e)}")
            return None
    
    def _get_field_confidence(self, field: str, ai_data: Dict) -> float:
        """
        Získání confidence pro konkrétní pole
        """
        # Základní confidence podle typu pole
        base_confidence = {
            'name': 0.8,
            'country': 0.9,
            'year': 0.85,
            'denomination': 0.8,
            'currency': 0.9,
            'material': 0.7,
            'weight': 0.6,
            'diameter': 0.6,
            'thickness': 0.5,
            'mint': 0.6,
            'mintage': 0.5,
            'designer': 0.4,
            'edge': 0.6,
            'obverse_description': 0.7,
            'reverse_description': 0.7,
            'historical_context': 0.5,
            'rarity': 0.4,
            'condition': 0.3
        }
        
        return base_confidence.get(field, 0.5)
    
    def _generate_field_suggestions(self, validated_data: Dict, ai_data: Dict) -> Dict:
        """
        Generování návrhů pro pole, která nebyla automaticky vyplněna
        """
        suggestions = {}
        
        # Návrhy na základě existujících dat
        if 'country' in validated_data and 'currency' not in validated_data:
            currency_suggestions = self._suggest_currency_by_country(validated_data['country'])
            if currency_suggestions:
                suggestions['currency'] = currency_suggestions
        
        if 'year' in validated_data and 'historical_context' not in validated_data:
            historical_suggestions = self._suggest_historical_context(validated_data['year'])
            if historical_suggestions:
                suggestions['historical_context'] = historical_suggestions
        
        if 'material' in validated_data and 'weight' not in validated_data:
            weight_suggestions = self._suggest_weight_by_material(
                validated_data.get('material'),
                validated_data.get('diameter')
            )
            if weight_suggestions:
                suggestions['weight'] = weight_suggestions
        
        return suggestions
    
    def _suggest_currency_by_country(self, country: str) -> List[str]:
        """
        Návrh měny podle země
        """
        currency_mapping = {
            'United States': ['USD', 'Dollar'],
            'Czech Republic': ['CZK', 'Koruna'],
            'Germany': ['EUR', 'Euro', 'DM', 'Deutsche Mark'],
            'United Kingdom': ['GBP', 'Pound Sterling'],
            'France': ['EUR', 'Euro', 'Franc'],
            'Italy': ['EUR', 'Euro', 'Lira'],
            'Spain': ['EUR', 'Euro', 'Peseta'],
            'Austria': ['EUR', 'Euro', 'Schilling'],
            'Switzerland': ['CHF', 'Swiss Franc'],
            'Canada': ['CAD', 'Canadian Dollar'],
            'Australia': ['AUD', 'Australian Dollar'],
            'Japan': ['JPY', 'Yen'],
            'China': ['CNY', 'Yuan'],
            'Russia': ['RUB', 'Ruble'],
            'Poland': ['PLN', 'Zloty'],
            'Hungary': ['HUF', 'Forint'],
            'Slovakia': ['EUR', 'Euro', 'SKK', 'Slovak Koruna']
        }
        
        return currency_mapping.get(country, [])
    
    def _suggest_historical_context(self, year: int) -> List[str]:
        """
        Návrh historického kontextu podle roku
        """
        if year < 1500:
            return ["Medieval period", "Ancient coin", "Historical artifact"]
        elif year < 1800:
            return ["Early modern period", "Colonial era", "Pre-industrial"]
        elif year < 1900:
            return ["19th century", "Industrial revolution era", "Empire period"]
        elif year < 1950:
            return ["Early 20th century", "World War era", "Interwar period"]
        elif year < 2000:
            return ["Late 20th century", "Modern era", "Post-war period"]
        else:
            return ["21st century", "Contemporary", "Modern issue"]
    
    def _suggest_weight_by_material(self, material: str, diameter: float = None) -> List[float]:
        """
        Návrh hmotnosti podle materiálu a průměru
        """
        if not material:
            return []
        
        material_lower = material.lower()
        
        # Základní hustoty materiálů (g/cm³)
        densities = {
            'gold': 19.3,
            'silver': 10.5,
            'copper': 8.9,
            'bronze': 8.8,
            'brass': 8.5,
            'nickel': 8.9,
            'aluminum': 2.7,
            'zinc': 7.1,
            'steel': 7.8,
            'iron': 7.9
        }
        
        density = None
        for mat, dens in densities.items():
            if mat in material_lower:
                density = dens
                break
        
        if density and diameter:
            # Odhad hmotnosti pro standardní tloušťku mince (1-3mm)
            radius = diameter / 2 / 10  # převod na cm
            volumes = [3.14159 * radius * radius * thickness for thickness in [0.1, 0.2, 0.3]]  # cm³
            weights = [vol * density for vol in volumes]  # g
            
            return [round(w, 1) for w in weights]
        
        return []
    
    async def get_similar_coins_suggestions(
        self, 
        coin_data: Dict, 
        db: Session, 
        limit: int = 5
    ) -> List[Dict]:
        """
        Získání návrhů podobných mincí z databáze
        """
        try:
            query = db.query(Coin)
            
            # Filtrování podle dostupných kritérií
            if 'country' in coin_data:
                query = query.filter(Coin.country.ilike(f"%{coin_data['country']}%"))
            
            if 'year' in coin_data:
                year = coin_data['year']
                query = query.filter(Coin.year.between(year - 5, year + 5))
            
            if 'currency' in coin_data:
                query = query.filter(Coin.currency.ilike(f"%{coin_data['currency']}%"))
            
            if 'material' in coin_data:
                query = query.filter(Coin.material.ilike(f"%{coin_data['material']}%"))
            
            similar_coins = query.limit(limit).all()
            
            suggestions = []
            for coin in similar_coins:
                suggestions.append({
                    'id': coin.id,
                    'name': coin.name,
                    'country': coin.country,
                    'year': coin.year,
                    'denomination': coin.denomination,
                    'currency': coin.currency,
                    'current_value': coin.current_value,
                    'similarity_score': self._calculate_similarity_score(coin_data, coin)
                })
            
            # Seřazení podle podobnosti
            suggestions.sort(key=lambda x: x['similarity_score'], reverse=True)
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Failed to get similar coins: {str(e)}")
            return []
    
    def _calculate_similarity_score(self, target_data: Dict, coin: Coin) -> float:
        """
        Výpočet skóre podobnosti mezi cílovými daty a mincí
        """
        score = 0.0
        total_weight = 0.0
        
        # Váhy pro různá pole
        field_weights = {
            'country': 0.3,
            'year': 0.2,
            'currency': 0.2,
            'material': 0.15,
            'denomination': 0.1,
            'name': 0.05
        }
        
        for field, weight in field_weights.items():
            total_weight += weight
            
            target_value = target_data.get(field)
            coin_value = getattr(coin, field, None)
            
            if target_value and coin_value:
                if field == 'year':
                    # Číselné porovnání pro rok
                    year_diff = abs(target_value - coin_value)
                    field_score = max(0, 1 - (year_diff / 10))  # Penalizace za každých 10 let
                elif field == 'denomination':
                    # Číselné porovnání pro nominální hodnotu
                    if coin_value > 0:
                        ratio = min(target_value, coin_value) / max(target_value, coin_value)
                        field_score = ratio
                    else:
                        field_score = 0
                else:
                    # Textové porovnání
                    target_lower = str(target_value).lower()
                    coin_lower = str(coin_value).lower()
                    
                    if target_lower == coin_lower:
                        field_score = 1.0
                    elif target_lower in coin_lower or coin_lower in target_lower:
                        field_score = 0.7
                    else:
                        field_score = 0.0
                
                score += field_score * weight
        
        return score / total_weight if total_weight > 0 else 0.0

# Singleton instance
auto_fill_service = AutoFillService()