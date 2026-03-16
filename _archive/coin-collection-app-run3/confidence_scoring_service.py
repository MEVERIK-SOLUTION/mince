import logging
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score
import pickle
import os

from ..models.coin import Coin, CoinImage
from ..core.config import settings

logger = logging.getLogger(__name__)

class ConfidenceScoringService:
    """
    Služba pro vyhodnocování confidence score AI identifikací a zlepšování přesnosti
    """
    
    def __init__(self):
        self.confidence_model = None
        self.feature_weights = {
            'api_confidence': 0.3,          # Confidence z AI API
            'visual_consistency': 0.25,     # Konzistence vizuálních příznaků
            'metadata_completeness': 0.15,  # Úplnost metadat
            'historical_accuracy': 0.15,    # Historická přesnost podobných identifikací
            'cross_validation': 0.15        # Křížová validace s jinými zdroji
        }
        
        # Prahy pro klasifikaci confidence
        self.confidence_thresholds = {
            'very_high': 0.9,    # Velmi vysoká spolehlivost
            'high': 0.75,        # Vysoká spolehlivost
            'medium': 0.6,       # Střední spolehlivost
            'low': 0.4,          # Nízká spolehlivost
            'very_low': 0.0      # Velmi nízká spolehlivost
        }
        
        # Cache pro uložené modely
        self.model_cache_dir = "cache/confidence_models"
        os.makedirs(self.model_cache_dir, exist_ok=True)
        
        # Statistiky pro sledování výkonu
        self.performance_stats = {
            'total_evaluations': 0,
            'accuracy_history': [],
            'confidence_distribution': {},
            'last_model_update': None
        }
        
        # Načtení existujícího modelu
        self._load_confidence_model()
    
    def calculate_comprehensive_confidence(
        self, 
        identification_result: Dict, 
        coin_data: Dict,
        db: Session = None
    ) -> Dict:
        """
        Výpočet komplexního confidence score na základě více faktorů
        """
        try:
            confidence_factors = {}
            
            # 1. API Confidence
            api_confidence = identification_result.get('confidence', 0.0)
            confidence_factors['api_confidence'] = self._normalize_confidence(api_confidence)
            
            # 2. Vizuální konzistence
            visual_consistency = self._calculate_visual_consistency(
                identification_result, coin_data
            )
            confidence_factors['visual_consistency'] = visual_consistency
            
            # 3. Úplnost metadat
            metadata_completeness = self._calculate_metadata_completeness(coin_data)
            confidence_factors['metadata_completeness'] = metadata_completeness
            
            # 4. Historická přesnost
            if db:
                historical_accuracy = self._calculate_historical_accuracy(
                    coin_data, db
                )
                confidence_factors['historical_accuracy'] = historical_accuracy
            else:
                confidence_factors['historical_accuracy'] = 0.5  # Neutrální hodnota
            
            # 5. Křížová validace
            cross_validation = self._calculate_cross_validation_score(
                identification_result, coin_data
            )
            confidence_factors['cross_validation'] = cross_validation
            
            # Výpočet váženého průměru
            total_confidence = 0.0
            total_weight = 0.0
            
            for factor, weight in self.feature_weights.items():
                if factor in confidence_factors:
                    total_confidence += confidence_factors[factor] * weight
                    total_weight += weight
            
            final_confidence = total_confidence / total_weight if total_weight > 0 else 0.0
            
            # Klasifikace confidence
            confidence_level = self._classify_confidence_level(final_confidence)
            
            # Doporučení na základě confidence
            recommendations = self._generate_recommendations(
                final_confidence, confidence_factors
            )
            
            return {
                'final_confidence': final_confidence,
                'confidence_level': confidence_level,
                'confidence_factors': confidence_factors,
                'feature_weights': self.feature_weights,
                'recommendations': recommendations,
                'reliability_assessment': self._assess_reliability(final_confidence),
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Confidence calculation failed: {str(e)}")
            return {
                'final_confidence': 0.0,
                'confidence_level': 'very_low',
                'error': str(e)
            }
    
    def _normalize_confidence(self, confidence: float) -> float:
        """
        Normalizace confidence hodnoty do rozsahu 0-1
        """
        if confidence is None:
            return 0.0
        
        # Pokud je confidence již v rozsahu 0-1
        if 0 <= confidence <= 1:
            return confidence
        
        # Pokud je confidence v procentech (0-100)
        if 0 <= confidence <= 100:
            return confidence / 100.0
        
        # Jinak oříznutí na rozsah 0-1
        return max(0.0, min(1.0, confidence))
    
    def _calculate_visual_consistency(
        self, 
        identification_result: Dict, 
        coin_data: Dict
    ) -> float:
        """
        Výpočet konzistence vizuálních příznaků
        """
        try:
            consistency_score = 0.0
            factors_count = 0
            
            # Kontrola konzistence rozměrů
            if 'diameter' in coin_data and 'weight' in coin_data:
                diameter = coin_data['diameter']
                weight = coin_data['weight']
                
                # Očekávaný poměr hmotnost/průměr pro různé materiály
                expected_ratios = {
                    'gold': 0.8,
                    'silver': 0.4,
                    'copper': 0.35,
                    'bronze': 0.35,
                    'nickel': 0.4,
                    'aluminum': 0.1
                }
                
                material = coin_data.get('material', '').lower()
                expected_ratio = None
                
                for mat, ratio in expected_ratios.items():
                    if mat in material:
                        expected_ratio = ratio
                        break
                
                if expected_ratio and diameter > 0:
                    actual_ratio = weight / diameter
                    ratio_consistency = 1.0 - abs(actual_ratio - expected_ratio) / expected_ratio
                    consistency_score += max(0.0, ratio_consistency)
                    factors_count += 1
            
            # Kontrola konzistence roku a historického kontextu
            if 'year' in coin_data and 'country' in coin_data:
                year = coin_data['year']
                country = coin_data['country']
                
                # Základní historická validace
                if year and country:
                    historical_consistency = self._validate_historical_context(year, country)
                    consistency_score += historical_consistency
                    factors_count += 1
            
            # Kontrola konzistence měny a země
            if 'currency' in coin_data and 'country' in coin_data:
                currency_consistency = self._validate_currency_country_match(
                    coin_data['currency'], coin_data['country']
                )
                consistency_score += currency_consistency
                factors_count += 1
            
            return consistency_score / factors_count if factors_count > 0 else 0.5
            
        except Exception as e:
            logger.warning(f"Visual consistency calculation failed: {str(e)}")
            return 0.5
    
    def _calculate_metadata_completeness(self, coin_data: Dict) -> float:
        """
        Výpočet úplnosti metadat
        """
        try:
            # Základní povinná pole
            required_fields = ['name', 'country', 'year', 'denomination', 'currency']
            
            # Volitelná pole (zvyšují skóre)
            optional_fields = [
                'material', 'weight', 'diameter', 'thickness', 'mint', 
                'mintage', 'designer', 'edge', 'condition', 'rarity'
            ]
            
            # Popisná pole
            descriptive_fields = [
                'obverse_description', 'reverse_description', 'historical_context'
            ]
            
            # Výpočet skóre pro povinná pole
            required_score = 0.0
            for field in required_fields:
                if field in coin_data and coin_data[field]:
                    required_score += 1.0
            
            required_completeness = required_score / len(required_fields)
            
            # Výpočet skóre pro volitelná pole
            optional_score = 0.0
            for field in optional_fields:
                if field in coin_data and coin_data[field]:
                    optional_score += 1.0
            
            optional_completeness = optional_score / len(optional_fields)
            
            # Výpočet skóre pro popisná pole
            descriptive_score = 0.0
            for field in descriptive_fields:
                if field in coin_data and coin_data[field]:
                    # Delší popisy mají vyšší hodnotu
                    description_length = len(str(coin_data[field]))
                    field_score = min(1.0, description_length / 100.0)  # Normalizace na 100 znaků
                    descriptive_score += field_score
            
            descriptive_completeness = descriptive_score / len(descriptive_fields)
            
            # Vážený průměr
            total_completeness = (
                required_completeness * 0.6 +      # 60% váha pro povinná pole
                optional_completeness * 0.3 +      # 30% váha pro volitelná pole
                descriptive_completeness * 0.1     # 10% váha pro popisná pole
            )
            
            return total_completeness
            
        except Exception as e:
            logger.warning(f"Metadata completeness calculation failed: {str(e)}")
            return 0.5
    
    def _calculate_historical_accuracy(self, coin_data: Dict, db: Session) -> float:
        """
        Výpočet historické přesnosti na základě podobných identifikací
        """
        try:
            # Vyhledání podobných mincí v databázi
            similar_coins = db.query(Coin).filter(
                Coin.country == coin_data.get('country'),
                Coin.year.between(
                    coin_data.get('year', 0) - 5, 
                    coin_data.get('year', 0) + 5
                )
            ).limit(10).all()
            
            if not similar_coins:
                return 0.5  # Neutrální hodnota pokud nejsou podobné mince
            
            # Výpočet konzistence s existujícími daty
            consistency_scores = []
            
            for coin in similar_coins:
                coin_consistency = 0.0
                factors = 0
                
                # Porovnání materiálu
                if coin.material and coin_data.get('material'):
                    if coin.material.lower() == coin_data['material'].lower():
                        coin_consistency += 1.0
                    factors += 1
                
                # Porovnání měny
                if coin.currency and coin_data.get('currency'):
                    if coin.currency.lower() == coin_data['currency'].lower():
                        coin_consistency += 1.0
                    factors += 1
                
                # Porovnání rozměrů (s tolerancí)
                if coin.diameter and coin_data.get('diameter'):
                    diameter_diff = abs(coin.diameter - coin_data['diameter'])
                    if diameter_diff <= 2.0:  # Tolerance 2mm
                        coin_consistency += 1.0 - (diameter_diff / 2.0)
                    factors += 1
                
                if factors > 0:
                    consistency_scores.append(coin_consistency / factors)
            
            return np.mean(consistency_scores) if consistency_scores else 0.5
            
        except Exception as e:
            logger.warning(f"Historical accuracy calculation failed: {str(e)}")
            return 0.5
    
    def _calculate_cross_validation_score(
        self, 
        identification_result: Dict, 
        coin_data: Dict
    ) -> float:
        """
        Výpočet skóre křížové validace
        """
        try:
            validation_score = 0.0
            validation_count = 0
            
            # Validace pomocí fallback identifikace
            if 'fallback_analysis' in identification_result:
                fallback = identification_result['fallback_analysis']
                
                # Porovnání materiálu
                if 'estimated_material' in fallback and 'material' in coin_data:
                    fallback_material = fallback['estimated_material'].lower()
                    ai_material = coin_data['material'].lower()
                    
                    if fallback_material in ai_material or ai_material in fallback_material:
                        validation_score += 1.0
                    validation_count += 1
                
                # Porovnání tvaru (kruhová mince)
                if 'shape_analysis' in fallback:
                    shape_analysis = fallback['shape_analysis']
                    circularity = shape_analysis.get('circularity', 0)
                    
                    if circularity > 0.8:  # Vysoká kruhová podobnost
                        validation_score += 1.0
                    elif circularity > 0.6:
                        validation_score += 0.7
                    else:
                        validation_score += 0.3
                    
                    validation_count += 1
            
            # Validace konzistence mezi různými zdroji
            if 'source' in identification_result:
                source_confidence = identification_result.get('confidence', 0)
                if source_confidence > 0.8:
                    validation_score += 1.0
                elif source_confidence > 0.6:
                    validation_score += 0.8
                else:
                    validation_score += 0.5
                
                validation_count += 1
            
            return validation_score / validation_count if validation_count > 0 else 0.5
            
        except Exception as e:
            logger.warning(f"Cross validation calculation failed: {str(e)}")
            return 0.5
    
    def _validate_historical_context(self, year: int, country: str) -> float:
        """
        Validace historického kontextu
        """
        try:
            # Základní historická validace
            current_year = datetime.now().year
            
            # Kontrola rozumnosti roku
            if year < 500 or year > current_year:
                return 0.2  # Velmi nízká konzistence
            
            # Kontrola historických období pro různé země
            historical_periods = {
                'united states': (1792, current_year),
                'czech republic': (1993, current_year),
                'czechoslovakia': (1918, 1992),
                'germany': (1871, current_year),
                'austria-hungary': (1867, 1918),
                'roman empire': (27, 476),
                'byzantine empire': (330, 1453)
            }
            
            country_lower = country.lower()
            
            for hist_country, (start_year, end_year) in historical_periods.items():
                if hist_country in country_lower:
                    if start_year <= year <= end_year:
                        return 1.0  # Perfektní shoda
                    else:
                        return 0.3  # Historická nekonzistence
            
            # Pokud země není v seznamu, použij obecnou validaci
            if year >= 1800:
                return 0.9  # Moderní období
            elif year >= 1500:
                return 0.8  # Raně moderní období
            elif year >= 1000:
                return 0.7  # Středověk
            else:
                return 0.6  # Starověk
                
        except Exception as e:
            logger.warning(f"Historical context validation failed: {str(e)}")
            return 0.5
    
    def _validate_currency_country_match(self, currency: str, country: str) -> float:
        """
        Validace shody měny a země
        """
        try:
            currency_country_mapping = {
                'usd': ['united states', 'usa', 'america'],
                'eur': ['germany', 'france', 'italy', 'spain', 'austria', 'netherlands'],
                'czk': ['czech republic', 'czechia'],
                'gbp': ['united kingdom', 'england', 'britain'],
                'jpy': ['japan'],
                'cny': ['china'],
                'rub': ['russia'],
                'cad': ['canada'],
                'aud': ['australia'],
                'chf': ['switzerland'],
                'sek': ['sweden'],
                'nok': ['norway'],
                'dkk': ['denmark']
            }
            
            currency_lower = currency.lower()
            country_lower = country.lower()
            
            for curr, countries in currency_country_mapping.items():
                if curr in currency_lower:
                    for mapped_country in countries:
                        if mapped_country in country_lower:
                            return 1.0  # Perfektní shoda
            
            # Kontrola historických měn
            historical_currencies = {
                'dm': ['germany'],
                'franc': ['france'],
                'lira': ['italy'],
                'peseta': ['spain'],
                'schilling': ['austria'],
                'drachma': ['greece']
            }
            
            for hist_curr, countries in historical_currencies.items():
                if hist_curr in currency_lower:
                    for mapped_country in countries:
                        if mapped_country in country_lower:
                            return 0.9  # Vysoká shoda pro historické měny
            
            return 0.5  # Neutrální pokud není jasná shoda
            
        except Exception as e:
            logger.warning(f"Currency-country validation failed: {str(e)}")
            return 0.5
    
    def _classify_confidence_level(self, confidence: float) -> str:
        """
        Klasifikace úrovně confidence
        """
        for level, threshold in sorted(self.confidence_thresholds.items(), 
                                     key=lambda x: x[1], reverse=True):
            if confidence >= threshold:
                return level
        
        return 'very_low'
    
    def _generate_recommendations(
        self, 
        final_confidence: float, 
        confidence_factors: Dict
    ) -> List[str]:
        """
        Generování doporučení na základě confidence analýzy
        """
        recommendations = []
        
        # Doporučení na základě celkového confidence
        if final_confidence < 0.4:
            recommendations.append("Velmi nízká spolehlivost - doporučujeme manuální ověření")
            recommendations.append("Zvažte použití jiného obrázku nebo úhlu pohledu")
        elif final_confidence < 0.6:
            recommendations.append("Střední spolehlivost - doporučujeme kontrolu klíčových údajů")
        elif final_confidence < 0.8:
            recommendations.append("Dobrá spolehlivost - menší kontrola doporučena")
        else:
            recommendations.append("Vysoká spolehlivost - výsledky jsou pravděpodobně správné")
        
        # Specifická doporučení na základě jednotlivých faktorů
        if confidence_factors.get('visual_consistency', 0) < 0.5:
            recommendations.append("Nízká vizuální konzistence - zkontrolujte rozměry a materiál")
        
        if confidence_factors.get('metadata_completeness', 0) < 0.6:
            recommendations.append("Neúplná metadata - doplňte chybějící informace")
        
        if confidence_factors.get('historical_accuracy', 0) < 0.5:
            recommendations.append("Možná historická nekonzistence - ověřte rok a zemi původu")
        
        if confidence_factors.get('api_confidence', 0) < 0.6:
            recommendations.append("Nízká confidence z AI API - zvažte použití jiného obrázku")
        
        return recommendations
    
    def _assess_reliability(self, confidence: float) -> Dict:
        """
        Posouzení spolehlivosti výsledku
        """
        if confidence >= 0.9:
            return {
                'level': 'excellent',
                'description': 'Výborná spolehlivost - výsledky jsou velmi pravděpodobně správné',
                'action': 'accept',
                'color': 'green'
            }
        elif confidence >= 0.75:
            return {
                'level': 'good',
                'description': 'Dobrá spolehlivost - výsledky jsou pravděpodobně správné',
                'action': 'review',
                'color': 'lightgreen'
            }
        elif confidence >= 0.6:
            return {
                'level': 'moderate',
                'description': 'Střední spolehlivost - doporučujeme kontrolu',
                'action': 'verify',
                'color': 'yellow'
            }
        elif confidence >= 0.4:
            return {
                'level': 'low',
                'description': 'Nízká spolehlivost - nutná pečlivá kontrola',
                'action': 'manual_check',
                'color': 'orange'
            }
        else:
            return {
                'level': 'very_low',
                'description': 'Velmi nízká spolehlivost - doporučujeme manuální identifikaci',
                'action': 'manual_identification',
                'color': 'red'
            }
    
    def train_confidence_model(self, training_data: List[Dict]) -> Dict:
        """
        Trénování modelu pro predikci confidence
        """
        try:
            if len(training_data) < 10:
                return {
                    'success': False,
                    'error': 'Nedostatek trénovacích dat (minimum 10 vzorků)'
                }
            
            # Příprava trénovacích dat
            X = []
            y = []
            
            for sample in training_data:
                features = [
                    sample.get('api_confidence', 0),
                    sample.get('visual_consistency', 0),
                    sample.get('metadata_completeness', 0),
                    sample.get('historical_accuracy', 0),
                    sample.get('cross_validation', 0)
                ]
                
                X.append(features)
                y.append(sample.get('actual_accuracy', 0))  # Skutečná přesnost
            
            X = np.array(X)
            y = np.array(y)
            
            # Trénování Random Forest modelu
            self.confidence_model = RandomForestClassifier(
                n_estimators=100,
                random_state=42,
                max_depth=10
            )
            
            self.confidence_model.fit(X, y > 0.7)  # Binární klasifikace (vysoká/nízká přesnost)
            
            # Evaluace modelu
            predictions = self.confidence_model.predict(X)
            accuracy = accuracy_score(y > 0.7, predictions)
            
            # Uložení modelu
            model_path = os.path.join(self.model_cache_dir, 'confidence_model.pkl')
            with open(model_path, 'wb') as f:
                pickle.dump(self.confidence_model, f)
            
            # Aktualizace statistik
            self.performance_stats['last_model_update'] = datetime.utcnow()
            self.performance_stats['accuracy_history'].append(accuracy)
            
            return {
                'success': True,
                'model_accuracy': accuracy,
                'training_samples': len(training_data),
                'model_path': model_path
            }
            
        except Exception as e:
            logger.error(f"Model training failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _load_confidence_model(self):
        """
        Načtení existujícího confidence modelu
        """
        try:
            model_path = os.path.join(self.model_cache_dir, 'confidence_model.pkl')
            if os.path.exists(model_path):
                with open(model_path, 'rb') as f:
                    self.confidence_model = pickle.load(f)
                logger.info("Confidence model loaded successfully")
            
        except Exception as e:
            logger.warning(f"Failed to load confidence model: {str(e)}")
    
    def predict_confidence_with_model(self, confidence_factors: Dict) -> float:
        """
        Predikce confidence pomocí natrénovaného modelu
        """
        try:
            if self.confidence_model is None:
                return None
            
            features = np.array([[
                confidence_factors.get('api_confidence', 0),
                confidence_factors.get('visual_consistency', 0),
                confidence_factors.get('metadata_completeness', 0),
                confidence_factors.get('historical_accuracy', 0),
                confidence_factors.get('cross_validation', 0)
            ]])
            
            # Predikce pravděpodobnosti vysoké přesnosti
            probability = self.confidence_model.predict_proba(features)[0][1]
            
            return probability
            
        except Exception as e:
            logger.warning(f"Model prediction failed: {str(e)}")
            return None
    
    def get_confidence_statistics(self) -> Dict:
        """
        Získání statistik confidence scoring
        """
        return {
            'performance_stats': self.performance_stats.copy(),
            'feature_weights': self.feature_weights.copy(),
            'confidence_thresholds': self.confidence_thresholds.copy(),
            'model_available': self.confidence_model is not None
        }
    
    def update_feature_weights(self, new_weights: Dict):
        """
        Aktualizace vah pro výpočet confidence
        """
        try:
            for feature, weight in new_weights.items():
                if feature in self.feature_weights:
                    self.feature_weights[feature] = weight
            
            # Normalizace vah na součet 1.0
            total_weight = sum(self.feature_weights.values())
            if total_weight > 0:
                for feature in self.feature_weights:
                    self.feature_weights[feature] /= total_weight
            
            logger.info(f"Feature weights updated: {self.feature_weights}")
            
        except Exception as e:
            logger.error(f"Failed to update feature weights: {str(e)}")

# Singleton instance
confidence_scoring_service = ConfidenceScoringService()