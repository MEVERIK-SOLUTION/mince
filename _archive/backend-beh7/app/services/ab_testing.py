import json
import hashlib
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
import asyncio
import logging
from abc import ABC, abstractmethod

class ExperimentStatus(Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"

class VariantType(Enum):
    CONTROL = "control"
    TREATMENT = "treatment"

class MetricType(Enum):
    CONVERSION = "conversion"
    CLICK_THROUGH = "click_through"
    TIME_ON_PAGE = "time_on_page"
    BOUNCE_RATE = "bounce_rate"
    CUSTOM = "custom"

class SegmentationType(Enum):
    ALL_USERS = "all_users"
    NEW_USERS = "new_users"
    RETURNING_USERS = "returning_users"
    PREMIUM_USERS = "premium_users"
    MOBILE_USERS = "mobile_users"
    DESKTOP_USERS = "desktop_users"
    CUSTOM = "custom"

@dataclass
class ExperimentVariant:
    id: str
    name: str
    variant_type: VariantType
    traffic_allocation: float  # 0.0 - 1.0
    config: Dict[str, Any]
    description: Optional[str] = None

@dataclass
class ExperimentMetric:
    name: str
    metric_type: MetricType
    goal_value: Optional[float] = None
    is_primary: bool = False
    description: Optional[str] = None

@dataclass
class Experiment:
    id: str
    name: str
    description: str
    status: ExperimentStatus
    variants: List[ExperimentVariant]
    metrics: List[ExperimentMetric]
    segmentation: SegmentationType
    segmentation_config: Dict[str, Any]
    start_date: datetime
    end_date: Optional[datetime]
    sample_size: int
    confidence_level: float
    created_by: int
    created_at: datetime
    updated_at: datetime
    metadata: Dict[str, Any]

@dataclass
class UserAssignment:
    user_id: int
    experiment_id: str
    variant_id: str
    assigned_at: datetime
    session_id: Optional[str] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None

@dataclass
class ExperimentEvent:
    id: str
    experiment_id: str
    variant_id: str
    user_id: int
    event_name: str
    event_value: Optional[float]
    event_properties: Dict[str, Any]
    timestamp: datetime
    session_id: Optional[str] = None

@dataclass
class ExperimentResult:
    experiment_id: str
    variant_id: str
    metric_name: str
    sample_size: int
    conversion_rate: float
    confidence_interval: Tuple[float, float]
    p_value: float
    is_significant: bool
    lift: float
    updated_at: datetime

class SegmentationEngine:
    """Engine pro segmentaci uživatelů"""
    
    def __init__(self, db: Session):
        self.db = db
        self.logger = logging.getLogger(__name__)
    
    def is_user_in_segment(
        self, 
        user_id: int, 
        segmentation: SegmentationType,
        segmentation_config: Dict[str, Any],
        user_context: Dict[str, Any]
    ) -> bool:
        """Kontroluje, zda uživatel patří do segmentu"""
        
        if segmentation == SegmentationType.ALL_USERS:
            return True
        
        elif segmentation == SegmentationType.NEW_USERS:
            # Uživatel registrovaný méně než X dní
            days_threshold = segmentation_config.get("days_threshold", 7)
            user_created = user_context.get("created_at")
            if user_created:
                days_since_registration = (datetime.now() - user_created).days
                return days_since_registration <= days_threshold
        
        elif segmentation == SegmentationType.RETURNING_USERS:
            # Uživatel s více než X návštěvami
            min_visits = segmentation_config.get("min_visits", 2)
            visit_count = user_context.get("visit_count", 0)
            return visit_count >= min_visits
        
        elif segmentation == SegmentationType.PREMIUM_USERS:
            # Uživatel s premium účtem
            return user_context.get("is_premium", False)
        
        elif segmentation == SegmentationType.MOBILE_USERS:
            # Uživatel na mobilním zařízení
            user_agent = user_context.get("user_agent", "")
            mobile_keywords = ["Mobile", "Android", "iPhone", "iPad"]
            return any(keyword in user_agent for keyword in mobile_keywords)
        
        elif segmentation == SegmentationType.DESKTOP_USERS:
            # Uživatel na desktopu
            user_agent = user_context.get("user_agent", "")
            mobile_keywords = ["Mobile", "Android", "iPhone", "iPad"]
            return not any(keyword in user_agent for keyword in mobile_keywords)
        
        elif segmentation == SegmentationType.CUSTOM:
            # Vlastní segmentace podle konfigurace
            return self._evaluate_custom_segmentation(user_context, segmentation_config)
        
        return False
    
    def _evaluate_custom_segmentation(
        self, 
        user_context: Dict[str, Any], 
        config: Dict[str, Any]
    ) -> bool:
        """Vyhodnotí vlastní segmentační pravidla"""
        
        rules = config.get("rules", [])
        operator = config.get("operator", "AND")  # AND, OR
        
        results = []
        
        for rule in rules:
            field = rule.get("field")
            operator_type = rule.get("operator")  # eq, ne, gt, lt, gte, lte, in, not_in
            value = rule.get("value")
            
            user_value = user_context.get(field)
            
            if operator_type == "eq":
                results.append(user_value == value)
            elif operator_type == "ne":
                results.append(user_value != value)
            elif operator_type == "gt":
                results.append(user_value > value if user_value is not None else False)
            elif operator_type == "lt":
                results.append(user_value < value if user_value is not None else False)
            elif operator_type == "gte":
                results.append(user_value >= value if user_value is not None else False)
            elif operator_type == "lte":
                results.append(user_value <= value if user_value is not None else False)
            elif operator_type == "in":
                results.append(user_value in value if user_value is not None else False)
            elif operator_type == "not_in":
                results.append(user_value not in value if user_value is not None else True)
            else:
                results.append(False)
        
        if operator == "OR":
            return any(results)
        else:  # AND
            return all(results)

class StatisticalEngine:
    """Engine pro statistické výpočty"""
    
    @staticmethod
    def calculate_sample_size(
        baseline_rate: float,
        minimum_detectable_effect: float,
        confidence_level: float = 0.95,
        power: float = 0.8
    ) -> int:
        """Vypočítá potřebnou velikost vzorku"""
        import scipy.stats as stats
        
        alpha = 1 - confidence_level
        beta = 1 - power
        
        # Z-scores
        z_alpha = stats.norm.ppf(1 - alpha/2)
        z_beta = stats.norm.ppf(power)
        
        # Výpočet velikosti vzorku pro binární metriku
        p1 = baseline_rate
        p2 = baseline_rate * (1 + minimum_detectable_effect)
        
        pooled_p = (p1 + p2) / 2
        
        numerator = (z_alpha * (2 * pooled_p * (1 - pooled_p))**0.5 + 
                    z_beta * (p1 * (1 - p1) + p2 * (1 - p2))**0.5)**2
        denominator = (p2 - p1)**2
        
        sample_size = int(numerator / denominator)
        
        return max(sample_size, 100)  # Minimálně 100 uživatelů
    
    @staticmethod
    def calculate_confidence_interval(
        successes: int,
        total: int,
        confidence_level: float = 0.95
    ) -> Tuple[float, float]:
        """Vypočítá interval spolehlivosti pro konverzní poměr"""
        import scipy.stats as stats
        
        if total == 0:
            return (0.0, 0.0)
        
        p = successes / total
        alpha = 1 - confidence_level
        z = stats.norm.ppf(1 - alpha/2)
        
        margin_of_error = z * (p * (1 - p) / total)**0.5
        
        lower = max(0, p - margin_of_error)
        upper = min(1, p + margin_of_error)
        
        return (lower, upper)
    
    @staticmethod
    def calculate_p_value(
        control_successes: int,
        control_total: int,
        treatment_successes: int,
        treatment_total: int
    ) -> float:
        """Vypočítá p-value pro A/B test"""
        import scipy.stats as stats
        
        if control_total == 0 or treatment_total == 0:
            return 1.0
        
        # Chi-square test
        observed = [[control_successes, control_total - control_successes],
                   [treatment_successes, treatment_total - treatment_successes]]
        
        chi2, p_value, _, _ = stats.chi2_contingency(observed)
        
        return p_value
    
    @staticmethod
    def calculate_lift(
        control_rate: float,
        treatment_rate: float
    ) -> float:
        """Vypočítá lift (relativní zlepšení)"""
        if control_rate == 0:
            return 0.0
        
        return (treatment_rate - control_rate) / control_rate

class ABTestingService:
    """Hlavní služba pro A/B testování"""
    
    def __init__(self, db: Session):
        self.db = db
        self.logger = logging.getLogger(__name__)
        self.segmentation_engine = SegmentationEngine(db)
        self.statistical_engine = StatisticalEngine()
        
        # In-memory cache pro aktivní experimenty
        self.active_experiments: Dict[str, Experiment] = {}
        self.user_assignments: Dict[Tuple[int, str], UserAssignment] = {}
        
        # Načtení aktivních experimentů
        asyncio.create_task(self._load_active_experiments())
    
    async def _load_active_experiments(self):
        """Načte aktivní experimenty do cache"""
        try:
            # V reálné aplikaci by se načítalo z databáze
            # Pro demonstraci používáme prázdný cache
            self.logger.info("Active experiments loaded into cache")
        except Exception as e:
            self.logger.error(f"Error loading active experiments: {e}")
    
    def create_experiment(self, experiment_data: Dict[str, Any]) -> Experiment:
        """Vytvoří nový experiment"""
        
        experiment_id = self._generate_experiment_id(experiment_data["name"])
        
        # Validace variant
        variants = []
        total_allocation = 0.0
        
        for variant_data in experiment_data["variants"]:
            variant = ExperimentVariant(
                id=variant_data["id"],
                name=variant_data["name"],
                variant_type=VariantType(variant_data["variant_type"]),
                traffic_allocation=variant_data["traffic_allocation"],
                config=variant_data.get("config", {}),
                description=variant_data.get("description")
            )
            variants.append(variant)
            total_allocation += variant.traffic_allocation
        
        if abs(total_allocation - 1.0) > 0.01:
            raise ValueError(f"Celková alokace provozu musí být 1.0, je {total_allocation}")
        
        # Validace metrik
        metrics = []
        primary_metrics = 0
        
        for metric_data in experiment_data["metrics"]:
            metric = ExperimentMetric(
                name=metric_data["name"],
                metric_type=MetricType(metric_data["metric_type"]),
                goal_value=metric_data.get("goal_value"),
                is_primary=metric_data.get("is_primary", False),
                description=metric_data.get("description")
            )
            metrics.append(metric)
            
            if metric.is_primary:
                primary_metrics += 1
        
        if primary_metrics == 0:
            raise ValueError("Alespoň jedna metrika musí být označena jako primární")
        
        # Vytvoření experimentu
        experiment = Experiment(
            id=experiment_id,
            name=experiment_data["name"],
            description=experiment_data["description"],
            status=ExperimentStatus.DRAFT,
            variants=variants,
            metrics=metrics,
            segmentation=SegmentationType(experiment_data.get("segmentation", "all_users")),
            segmentation_config=experiment_data.get("segmentation_config", {}),
            start_date=datetime.fromisoformat(experiment_data["start_date"]),
            end_date=datetime.fromisoformat(experiment_data["end_date"]) if experiment_data.get("end_date") else None,
            sample_size=experiment_data.get("sample_size", 1000),
            confidence_level=experiment_data.get("confidence_level", 0.95),
            created_by=experiment_data["created_by"],
            created_at=datetime.now(),
            updated_at=datetime.now(),
            metadata=experiment_data.get("metadata", {})
        )
        
        # Uložení do databáze (simulace)
        self._save_experiment(experiment)
        
        self.logger.info(f"Experiment created: {experiment_id}")
        return experiment
    
    def start_experiment(self, experiment_id: str) -> bool:
        """Spustí experiment"""
        
        experiment = self._get_experiment(experiment_id)
        if not experiment:
            raise ValueError(f"Experiment not found: {experiment_id}")
        
        if experiment.status != ExperimentStatus.DRAFT:
            raise ValueError(f"Experiment must be in DRAFT status to start, current: {experiment.status}")
        
        # Validace před spuštěním
        if experiment.start_date > datetime.now():
            raise ValueError("Start date must be in the past or present")
        
        if experiment.end_date and experiment.end_date <= datetime.now():
            raise ValueError("End date must be in the future")
        
        # Spuštění experimentu
        experiment.status = ExperimentStatus.ACTIVE
        experiment.updated_at = datetime.now()
        
        # Přidání do cache aktivních experimentů
        self.active_experiments[experiment_id] = experiment
        
        self._save_experiment(experiment)
        
        self.logger.info(f"Experiment started: {experiment_id}")
        return True
    
    def assign_user_to_variant(
        self,
        user_id: int,
        experiment_id: str,
        user_context: Dict[str, Any]
    ) -> Optional[str]:
        """Přiřadí uživatele k variantě experimentu"""
        
        experiment = self.active_experiments.get(experiment_id)
        if not experiment:
            return None
        
        # Kontrola, zda experiment běží
        if experiment.status != ExperimentStatus.ACTIVE:
            return None
        
        now = datetime.now()
        if now < experiment.start_date or (experiment.end_date and now > experiment.end_date):
            return None
        
        # Kontrola existujícího přiřazení
        assignment_key = (user_id, experiment_id)
        if assignment_key in self.user_assignments:
            return self.user_assignments[assignment_key].variant_id
        
        # Kontrola segmentace
        if not self.segmentation_engine.is_user_in_segment(
            user_id, experiment.segmentation, experiment.segmentation_config, user_context
        ):
            return None
        
        # Přiřazení k variantě na základě hash funkce
        variant_id = self._assign_variant(user_id, experiment)
        
        if variant_id:
            # Uložení přiřazení
            assignment = UserAssignment(
                user_id=user_id,
                experiment_id=experiment_id,
                variant_id=variant_id,
                assigned_at=now,
                session_id=user_context.get("session_id"),
                user_agent=user_context.get("user_agent"),
                ip_address=user_context.get("ip_address")
            )
            
            self.user_assignments[assignment_key] = assignment
            self._save_user_assignment(assignment)
            
            self.logger.debug(f"User {user_id} assigned to variant {variant_id} in experiment {experiment_id}")
        
        return variant_id
    
    def _assign_variant(self, user_id: int, experiment: Experiment) -> Optional[str]:
        """Přiřadí variantu na základě konzistentního hashování"""
        
        # Vytvoření hash z user_id a experiment_id
        hash_input = f"{user_id}:{experiment.id}".encode('utf-8')
        hash_value = int(hashlib.md5(hash_input).hexdigest(), 16)
        
        # Normalizace na 0-1
        normalized_hash = (hash_value % 10000) / 10000.0
        
        # Přiřazení k variantě podle alokace provozu
        cumulative_allocation = 0.0
        
        for variant in experiment.variants:
            cumulative_allocation += variant.traffic_allocation
            if normalized_hash <= cumulative_allocation:
                return variant.id
        
        # Fallback na poslední variantu
        return experiment.variants[-1].id if experiment.variants else None
    
    def track_event(
        self,
        user_id: int,
        experiment_id: str,
        event_name: str,
        event_value: Optional[float] = None,
        event_properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Zaznamenává událost pro experiment"""
        
        # Kontrola přiřazení uživatele
        assignment_key = (user_id, experiment_id)
        assignment = self.user_assignments.get(assignment_key)
        
        if not assignment:
            return False
        
        # Vytvoření události
        event = ExperimentEvent(
            id=self._generate_event_id(),
            experiment_id=experiment_id,
            variant_id=assignment.variant_id,
            user_id=user_id,
            event_name=event_name,
            event_value=event_value,
            event_properties=event_properties or {},
            timestamp=datetime.now(),
            session_id=assignment.session_id
        )
        
        self._save_experiment_event(event)
        
        self.logger.debug(f"Event tracked: {event_name} for user {user_id} in experiment {experiment_id}")
        return True
    
    def get_experiment_results(self, experiment_id: str) -> Dict[str, Any]:
        """Získá výsledky experimentu"""
        
        experiment = self._get_experiment(experiment_id)
        if not experiment:
            raise ValueError(f"Experiment not found: {experiment_id}")
        
        # Získání dat z databáze (simulace)
        variant_stats = self._get_variant_statistics(experiment_id)
        
        results = {
            "experiment_id": experiment_id,
            "experiment_name": experiment.name,
            "status": experiment.status.value,
            "start_date": experiment.start_date.isoformat(),
            "end_date": experiment.end_date.isoformat() if experiment.end_date else None,
            "total_users": sum(stats["total_users"] for stats in variant_stats.values()),
            "variants": {},
            "statistical_significance": {},
            "recommendations": []
        }
        
        # Zpracování výsledků pro každou variantu
        control_variant = None
        
        for variant in experiment.variants:
            variant_id = variant.id
            stats = variant_stats.get(variant_id, {})
            
            variant_results = {
                "name": variant.name,
                "type": variant.variant_type.value,
                "traffic_allocation": variant.traffic_allocation,
                "total_users": stats.get("total_users", 0),
                "metrics": {}
            }
            
            # Výpočet metrik
            for metric in experiment.metrics:
                metric_name = metric.name
                metric_data = stats.get("metrics", {}).get(metric_name, {})
                
                successes = metric_data.get("successes", 0)
                total = stats.get("total_users", 0)
                
                if total > 0:
                    conversion_rate = successes / total
                    confidence_interval = self.statistical_engine.calculate_confidence_interval(
                        successes, total, experiment.confidence_level
                    )
                else:
                    conversion_rate = 0.0
                    confidence_interval = (0.0, 0.0)
                
                variant_results["metrics"][metric_name] = {
                    "successes": successes,
                    "total": total,
                    "conversion_rate": conversion_rate,
                    "confidence_interval": confidence_interval
                }
            
            results["variants"][variant_id] = variant_results
            
            # Uložení control varianty pro porovnání
            if variant.variant_type == VariantType.CONTROL:
                control_variant = variant_id
        
        # Statistická signifikance
        if control_variant:
            control_stats = results["variants"][control_variant]
            
            for variant_id, variant_results in results["variants"].items():
                if variant_id == control_variant:
                    continue
                
                significance_results = {}
                
                for metric in experiment.metrics:
                    metric_name = metric.name
                    
                    control_metric = control_stats["metrics"].get(metric_name, {})
                    treatment_metric = variant_results["metrics"].get(metric_name, {})
                    
                    if control_metric and treatment_metric:
                        p_value = self.statistical_engine.calculate_p_value(
                            control_metric["successes"],
                            control_metric["total"],
                            treatment_metric["successes"],
                            treatment_metric["total"]
                        )
                        
                        lift = self.statistical_engine.calculate_lift(
                            control_metric["conversion_rate"],
                            treatment_metric["conversion_rate"]
                        )
                        
                        is_significant = p_value < (1 - experiment.confidence_level)
                        
                        significance_results[metric_name] = {
                            "p_value": p_value,
                            "lift": lift,
                            "is_significant": is_significant
                        }
                
                results["statistical_significance"][variant_id] = significance_results
        
        # Doporučení
        results["recommendations"] = self._generate_recommendations(experiment, results)
        
        return results
    
    def _generate_recommendations(
        self, 
        experiment: Experiment, 
        results: Dict[str, Any]
    ) -> List[Dict[str, str]]:
        """Generuje doporučení na základě výsledků"""
        
        recommendations = []
        
        # Kontrola velikosti vzorku
        total_users = results["total_users"]
        if total_users < experiment.sample_size:
            recommendations.append({
                "type": "warning",
                "message": f"Velikost vzorku ({total_users}) je menší než plánovaná ({experiment.sample_size}). Výsledky nemusí být statisticky spolehlivé."
            })
        
        # Kontrola statistické signifikance
        significant_variants = []
        for variant_id, significance in results.get("statistical_significance", {}).items():
            for metric_name, metric_significance in significance.items():
                if metric_significance["is_significant"] and metric_significance["lift"] > 0:
                    significant_variants.append((variant_id, metric_name, metric_significance["lift"]))
        
        if significant_variants:
            best_variant = max(significant_variants, key=lambda x: x[2])
            recommendations.append({
                "type": "success",
                "message": f"Varianta {best_variant[0]} vykazuje statisticky významné zlepšení {best_variant[2]:.1%} v metrice {best_variant[1]}."
            })
        else:
            recommendations.append({
                "type": "info",
                "message": "Žádná varianta nevykazuje statisticky významné zlepšení. Zvažte prodloužení experimentu nebo úpravu variant."
            })
        
        # Kontrola délky experimentu
        if experiment.end_date and datetime.now() > experiment.end_date:
            recommendations.append({
                "type": "info",
                "message": "Experiment skončil. Můžete implementovat vítěznou variantu nebo archivovat experiment."
            })
        
        return recommendations
    
    def stop_experiment(self, experiment_id: str, reason: str = "") -> bool:
        """Zastaví experiment"""
        
        experiment = self._get_experiment(experiment_id)
        if not experiment:
            raise ValueError(f"Experiment not found: {experiment_id}")
        
        if experiment.status != ExperimentStatus.ACTIVE:
            raise ValueError(f"Only active experiments can be stopped, current status: {experiment.status}")
        
        experiment.status = ExperimentStatus.COMPLETED
        experiment.updated_at = datetime.now()
        experiment.metadata["stop_reason"] = reason
        experiment.metadata["stopped_at"] = datetime.now().isoformat()
        
        # Odebrání z cache aktivních experimentů
        if experiment_id in self.active_experiments:
            del self.active_experiments[experiment_id]
        
        self._save_experiment(experiment)
        
        self.logger.info(f"Experiment stopped: {experiment_id}, reason: {reason}")
        return True
    
    def list_experiments(
        self,
        status: Optional[ExperimentStatus] = None,
        created_by: Optional[int] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Vypíše experimenty"""
        
        # V reálné aplikaci by se načítalo z databáze
        experiments = []
        
        # Simulace dat
        for exp_id, experiment in self.active_experiments.items():
            if status and experiment.status != status:
                continue
            
            if created_by and experiment.created_by != created_by:
                continue
            
            experiments.append({
                "id": experiment.id,
                "name": experiment.name,
                "status": experiment.status.value,
                "start_date": experiment.start_date.isoformat(),
                "end_date": experiment.end_date.isoformat() if experiment.end_date else None,
                "variants_count": len(experiment.variants),
                "metrics_count": len(experiment.metrics),
                "created_by": experiment.created_by,
                "created_at": experiment.created_at.isoformat()
            })
        
        # Seřazení podle data vytvoření
        experiments.sort(key=lambda x: x["created_at"], reverse=True)
        
        return experiments[:limit]
    
    def get_user_experiments(self, user_id: int) -> List[Dict[str, Any]]:
        """Získá aktivní experimenty pro uživatele"""
        
        user_experiments = []
        
        for assignment in self.user_assignments.values():
            if assignment.user_id == user_id:
                experiment = self.active_experiments.get(assignment.experiment_id)
                if experiment and experiment.status == ExperimentStatus.ACTIVE:
                    variant = next(
                        (v for v in experiment.variants if v.id == assignment.variant_id),
                        None
                    )
                    
                    if variant:
                        user_experiments.append({
                            "experiment_id": experiment.id,
                            "experiment_name": experiment.name,
                            "variant_id": variant.id,
                            "variant_name": variant.name,
                            "variant_config": variant.config,
                            "assigned_at": assignment.assigned_at.isoformat()
                        })
        
        return user_experiments
    
    # Pomocné metody pro simulaci databázových operací
    
    def _generate_experiment_id(self, name: str) -> str:
        """Generuje ID experimentu"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        name_hash = hashlib.md5(name.encode()).hexdigest()[:8]
        return f"exp_{timestamp}_{name_hash}"
    
    def _generate_event_id(self) -> str:
        """Generuje ID události"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        return f"evt_{timestamp}"
    
    def _get_experiment(self, experiment_id: str) -> Optional[Experiment]:
        """Získá experiment z databáze"""
        return self.active_experiments.get(experiment_id)
    
    def _save_experiment(self, experiment: Experiment):
        """Uloží experiment do databáze"""
        # Simulace uložení
        self.logger.debug(f"Saving experiment: {experiment.id}")
    
    def _save_user_assignment(self, assignment: UserAssignment):
        """Uloží přiřazení uživatele"""
        # Simulace uložení
        self.logger.debug(f"Saving user assignment: {assignment.user_id} -> {assignment.variant_id}")
    
    def _save_experiment_event(self, event: ExperimentEvent):
        """Uloží událost experimentu"""
        # Simulace uložení
        self.logger.debug(f"Saving event: {event.event_name} for experiment {event.experiment_id}")
    
    def _get_variant_statistics(self, experiment_id: str) -> Dict[str, Dict[str, Any]]:
        """Získá statistiky variant z databáze"""
        # Simulace dat
        return {
            "control": {
                "total_users": 500,
                "metrics": {
                    "conversion": {"successes": 50},
                    "click_through": {"successes": 150}
                }
            },
            "treatment": {
                "total_users": 480,
                "metrics": {
                    "conversion": {"successes": 60},
                    "click_through": {"successes": 160}
                }
            }
        }

# Factory funkce
def create_ab_testing_service(db: Session) -> ABTestingService:
    """Vytvoří instanci A/B testing služby"""
    return ABTestingService(db)

# Příklad použití
async def example_usage():
    """Příklad použití A/B testing služby"""
    
    # Simulace databáze
    db = None  # V reálné aplikaci by to byla SQLAlchemy session
    
    ab_service = create_ab_testing_service(db)
    
    # Vytvoření experimentu
    experiment_data = {
        "name": "Nový design detailu mince",
        "description": "Test nového layoutu stránky s detailem mince",
        "variants": [
            {
                "id": "control",
                "name": "Původní design",
                "variant_type": "control",
                "traffic_allocation": 0.5,
                "config": {"layout": "original"}
            },
            {
                "id": "treatment",
                "name": "Nový design",
                "variant_type": "treatment", 
                "traffic_allocation": 0.5,
                "config": {"layout": "new", "show_related": True}
            }
        ],
        "metrics": [
            {
                "name": "conversion",
                "metric_type": "conversion",
                "is_primary": True,
                "description": "Přidání mince do kolekce"
            },
            {
                "name": "time_on_page",
                "metric_type": "time_on_page",
                "description": "Čas strávený na stránce"
            }
        ],
        "segmentation": "all_users",
        "start_date": datetime.now().isoformat(),
        "end_date": (datetime.now() + timedelta(days=14)).isoformat(),
        "sample_size": 1000,
        "confidence_level": 0.95,
        "created_by": 1
    }
    
    experiment = ab_service.create_experiment(experiment_data)
    print(f"Experiment created: {experiment.id}")
    
    # Spuštění experimentu
    ab_service.start_experiment(experiment.id)
    print(f"Experiment started: {experiment.id}")
    
    # Přiřazení uživatele
    user_context = {
        "session_id": "sess_123",
        "user_agent": "Mozilla/5.0...",
        "created_at": datetime.now() - timedelta(days=30),
        "is_premium": False
    }
    
    variant = ab_service.assign_user_to_variant(123, experiment.id, user_context)
    print(f"User 123 assigned to variant: {variant}")
    
    # Zaznamenání události
    ab_service.track_event(123, experiment.id, "conversion", 1.0)
    print("Conversion event tracked")
    
    # Získání výsledků
    results = ab_service.get_experiment_results(experiment.id)
    print(f"Experiment results: {len(results['variants'])} variants")

if __name__ == "__main__":
    asyncio.run(example_usage())