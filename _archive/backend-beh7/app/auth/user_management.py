import asyncio
import uuid
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import logging
from enum import Enum
import re
import json
from .authentication import User, UserRole, AuthProvider, PasswordValidator
from .authorization import AuthorizationService, Permission

class UserStatus(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    BANNED = "banned"
    PENDING_VERIFICATION = "pending_verification"

class SubscriptionType(Enum):
    FREE = "free"
    BASIC = "basic"
    PREMIUM = "premium"
    EXPERT = "expert"
    ENTERPRISE = "enterprise"

@dataclass
class UserProfile:
    user_id: str
    display_name: str
    bio: Optional[str]
    location: Optional[str]
    website: Optional[str]
    social_links: Dict[str, str]
    specializations: List[str]  # Oblasti specializace (antické mince, moderní mince, atd.)
    languages: List[str]
    timezone: str
    privacy_settings: Dict[str, bool]
    notification_preferences: Dict[str, bool]

@dataclass
class UserSubscription:
    user_id: str
    subscription_type: SubscriptionType
    start_date: datetime
    end_date: Optional[datetime]
    auto_renew: bool
    payment_method: Optional[str]
    features: List[str]
    usage_limits: Dict[str, int]
    current_usage: Dict[str, int]

@dataclass
class UserActivity:
    user_id: str
    action: str
    resource_type: str
    resource_id: Optional[str]
    timestamp: datetime
    ip_address: str
    user_agent: str
    metadata: Dict[str, Any]

@dataclass
class UserInvitation:
    id: str
    inviter_id: str
    email: str
    role: UserRole
    expires_at: datetime
    used_at: Optional[datetime]
    created_at: datetime

class UserValidator:
    """Validátor uživatelských dat"""
    
    @staticmethod
    def validate_email(email: str) -> Dict[str, Any]:
        """Validuje email adresu"""
        result = {"is_valid": True, "issues": []}
        
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        
        if not email:
            result["is_valid"] = False
            result["issues"].append("Email je povinný")
        elif not re.match(email_pattern, email):
            result["is_valid"] = False
            result["issues"].append("Neplatný formát emailu")
        elif len(email) > 254:
            result["is_valid"] = False
            result["issues"].append("Email je příliš dlouhý")
        
        return result
    
    @staticmethod
    def validate_username(username: str) -> Dict[str, Any]:
        """Validuje uživatelské jméno"""
        result = {"is_valid": True, "issues": []}
        
        if not username:
            result["is_valid"] = False
            result["issues"].append("Uživatelské jméno je povinné")
        elif len(username) < 3:
            result["is_valid"] = False
            result["issues"].append("Uživatelské jméno musí mít alespoň 3 znaky")
        elif len(username) > 30:
            result["is_valid"] = False
            result["issues"].append("Uživatelské jméno je příliš dlouhé")
        elif not re.match(r'^[a-zA-Z0-9_-]+$', username):
            result["is_valid"] = False
            result["issues"].append("Uživatelské jméno může obsahovat pouze písmena, číslice, _ a -")
        
        return result
    
    @staticmethod
    def validate_name(name: str, field_name: str) -> Dict[str, Any]:
        """Validuje jméno nebo příjmení"""
        result = {"is_valid": True, "issues": []}
        
        if not name:
            result["is_valid"] = False
            result["issues"].append(f"{field_name} je povinné")
        elif len(name) < 2:
            result["is_valid"] = False
            result["issues"].append(f"{field_name} musí mít alespoň 2 znaky")
        elif len(name) > 50:
            result["is_valid"] = False
            result["issues"].append(f"{field_name} je příliš dlouhé")
        elif not re.match(r'^[a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ\s-]+$', name):
            result["is_valid"] = False
            result["issues"].append(f"{field_name} obsahuje nepovolené znaky")
        
        return result

class UserManagementService:
    """Hlavní služba pro správu uživatelů"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.auth_service = None  # Bude nastaveno při inicializaci
        self.users_cache: Dict[str, User] = {}
        self.profiles_cache: Dict[str, UserProfile] = {}
        self.subscriptions_cache: Dict[str, UserSubscription] = {}
        self.activities: Dict[str, List[UserActivity]] = {}
        self.invitations: Dict[str, UserInvitation] = {}
        
        # Limity podle subscription
        self.subscription_limits = {
            SubscriptionType.FREE: {
                "max_coins": 100,
                "max_collections": 3,
                "max_price_alerts": 5,
                "api_calls_per_day": 100,
                "export_per_month": 2
            },
            SubscriptionType.BASIC: {
                "max_coins": 500,
                "max_collections": 10,
                "max_price_alerts": 25,
                "api_calls_per_day": 500,
                "export_per_month": 10
            },
            SubscriptionType.PREMIUM: {
                "max_coins": 2000,
                "max_collections": 50,
                "max_price_alerts": 100,
                "api_calls_per_day": 2000,
                "export_per_month": 50
            },
            SubscriptionType.EXPERT: {
                "max_coins": 10000,
                "max_collections": 200,
                "max_price_alerts": 500,
                "api_calls_per_day": 10000,
                "export_per_month": 200
            },
            SubscriptionType.ENTERPRISE: {
                "max_coins": -1,  # Neomezeno
                "max_collections": -1,
                "max_price_alerts": -1,
                "api_calls_per_day": -1,
                "export_per_month": -1
            }
        }
    
    async def create_user(self, email: str, username: str, password: str,
                         first_name: str, last_name: str,
                         role: UserRole = UserRole.USER,
                         auth_provider: AuthProvider = AuthProvider.LOCAL) -> Dict[str, Any]:
        """Vytvoří nového uživatele"""
        try:
            # Validace dat
            validation_errors = []
            
            email_validation = UserValidator.validate_email(email)
            if not email_validation["is_valid"]:
                validation_errors.extend(email_validation["issues"])
            
            username_validation = UserValidator.validate_username(username)
            if not username_validation["is_valid"]:
                validation_errors.extend(username_validation["issues"])
            
            if auth_provider == AuthProvider.LOCAL:
                password_validation = PasswordValidator.validate_password(password)
                if not password_validation["is_valid"]:
                    validation_errors.extend(password_validation["issues"])
            
            first_name_validation = UserValidator.validate_name(first_name, "Jméno")
            if not first_name_validation["is_valid"]:
                validation_errors.extend(first_name_validation["issues"])
            
            last_name_validation = UserValidator.validate_name(last_name, "Příjmení")
            if not last_name_validation["is_valid"]:
                validation_errors.extend(last_name_validation["issues"])
            
            if validation_errors:
                return {
                    "success": False,
                    "error": "validation_failed",
                    "issues": validation_errors
                }
            
            # Kontrola duplicit
            if await self._email_exists(email):
                return {
                    "success": False,
                    "error": "email_exists",
                    "message": "Email již existuje"
                }
            
            if await self._username_exists(username):
                return {
                    "success": False,
                    "error": "username_exists",
                    "message": "Uživatelské jméno již existuje"
                }
            
            # Vytvoření uživatele
            user_id = str(uuid.uuid4())
            now = datetime.now()
            
            user = User(
                id=user_id,
                email=email,
                username=username,
                first_name=first_name,
                last_name=last_name,
                role=role,
                is_active=True,
                is_verified=auth_provider != AuthProvider.LOCAL,  # OAuth uživatelé jsou automaticky ověřeni
                auth_provider=auth_provider,
                profile_image=None,
                bio=None,
                location=None,
                website=None,
                preferences={},
                created_at=now,
                updated_at=now,
                last_login=None,
                login_count=0,
                subscription_expires=None
            )
            
            # Uložení do cache (v reálné aplikaci by to bylo do databáze)
            self.users_cache[user_id] = user
            
            # Vytvoření profilu
            await self._create_default_profile(user_id)
            
            # Vytvoření subscription
            await self._create_default_subscription(user_id)
            
            # Hashování hesla (pouze pro lokální účty)
            if auth_provider == AuthProvider.LOCAL and self.auth_service:
                password_hash = self.auth_service.hash_password(password)
                await self._store_password_hash(user_id, password_hash)
            
            # Zaznamenání aktivity
            await self._log_activity(user_id, "user_created", "user", user_id, {
                "auth_provider": auth_provider.value,
                "role": role.value
            })
            
            self.logger.info(f"User created: {user_id} ({email})")
            
            return {
                "success": True,
                "user": asdict(user),
                "message": "Uživatel byl úspěšně vytvořen"
            }
            
        except Exception as e:
            self.logger.error(f"User creation error: {str(e)}")
            return {
                "success": False,
                "error": "internal_error",
                "message": "Došlo k vnitřní chybě"
            }
    
    async def get_user(self, user_id: str) -> Optional[User]:
        """Získá uživatele podle ID"""
        try:
            if user_id in self.users_cache:
                return self.users_cache[user_id]
            
            # V reálné aplikaci by to bylo načtení z databáze
            user = await self._load_user_from_db(user_id)
            if user:
                self.users_cache[user_id] = user
            
            return user
            
        except Exception as e:
            self.logger.error(f"Get user error: {str(e)}")
            return None
    
    async def update_user(self, user_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Aktualizuje uživatele"""
        try:
            user = await self.get_user(user_id)
            if not user:
                return {
                    "success": False,
                    "error": "user_not_found",
                    "message": "Uživatel nenalezen"
                }
            
            # Validace aktualizací
            validation_errors = []
            
            if "email" in updates:
                email_validation = UserValidator.validate_email(updates["email"])
                if not email_validation["is_valid"]:
                    validation_errors.extend(email_validation["issues"])
                elif updates["email"] != user.email and await self._email_exists(updates["email"]):
                    validation_errors.append("Email již existuje")
            
            if "username" in updates:
                username_validation = UserValidator.validate_username(updates["username"])
                if not username_validation["is_valid"]:
                    validation_errors.extend(username_validation["issues"])
                elif updates["username"] != user.username and await self._username_exists(updates["username"]):
                    validation_errors.append("Uživatelské jméno již existuje")
            
            if validation_errors:
                return {
                    "success": False,
                    "error": "validation_failed",
                    "issues": validation_errors
                }
            
            # Aplikace aktualizací
            allowed_fields = [
                "email", "username", "first_name", "last_name",
                "profile_image", "bio", "location", "website", "preferences"
            ]
            
            for field, value in updates.items():
                if field in allowed_fields:
                    setattr(user, field, value)
            
            user.updated_at = datetime.now()
            
            # Uložení (v reálné aplikaci do databáze)
            self.users_cache[user_id] = user
            
            # Zaznamenání aktivity
            await self._log_activity(user_id, "user_updated", "user", user_id, {
                "updated_fields": list(updates.keys())
            })
            
            return {
                "success": True,
                "user": asdict(user),
                "message": "Uživatel byl aktualizován"
            }
            
        except Exception as e:
            self.logger.error(f"User update error: {str(e)}")
            return {
                "success": False,
                "error": "internal_error",
                "message": "Došlo k vnitřní chybě"
            }
    
    async def change_user_role(self, admin_user_id: str, target_user_id: str, 
                              new_role: UserRole) -> Dict[str, Any]:
        """Změní roli uživatele (pouze admin)"""
        try:
            # Kontrola oprávnění admina
            admin_user = await self.get_user(admin_user_id)
            if not admin_user or admin_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
                return {
                    "success": False,
                    "error": "insufficient_permissions",
                    "message": "Nedostatečná oprávnění"
                }
            
            # Získání cílového uživatele
            target_user = await self.get_user(target_user_id)
            if not target_user:
                return {
                    "success": False,
                    "error": "user_not_found",
                    "message": "Uživatel nenalezen"
                }
            
            # Kontrola, zda admin může změnit roli
            auth_service = AuthorizationService()
            if not auth_service.can_escalate_to_role(admin_user.role.value, new_role.value):
                return {
                    "success": False,
                    "error": "cannot_escalate",
                    "message": "Nemůžete přidělit tuto roli"
                }
            
            old_role = target_user.role
            target_user.role = new_role
            target_user.updated_at = datetime.now()
            
            # Uložení
            self.users_cache[target_user_id] = target_user
            
            # Zaznamenání aktivity
            await self._log_activity(admin_user_id, "role_changed", "user", target_user_id, {
                "old_role": old_role.value,
                "new_role": new_role.value,
                "target_user": target_user.email
            })
            
            self.logger.info(f"Role changed: {target_user.email} from {old_role.value} to {new_role.value} by {admin_user.email}")
            
            return {
                "success": True,
                "message": f"Role změněna na {new_role.value}"
            }
            
        except Exception as e:
            self.logger.error(f"Role change error: {str(e)}")
            return {
                "success": False,
                "error": "internal_error",
                "message": "Došlo k vnitřní chybě"
            }
    
    async def suspend_user(self, admin_user_id: str, target_user_id: str, 
                          reason: str, duration_days: int = None) -> Dict[str, Any]:
        """Pozastaví uživatele"""
        try:
            admin_user = await self.get_user(admin_user_id)
            if not admin_user or admin_user.role not in [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN]:
                return {
                    "success": False,
                    "error": "insufficient_permissions",
                    "message": "Nedostatečná oprávnění"
                }
            
            target_user = await self.get_user(target_user_id)
            if not target_user:
                return {
                    "success": False,
                    "error": "user_not_found",
                    "message": "Uživatel nenalezen"
                }
            
            target_user.is_active = False
            target_user.updated_at = datetime.now()
            
            # Uložení
            self.users_cache[target_user_id] = target_user
            
            # Zaznamenání aktivity
            await self._log_activity(admin_user_id, "user_suspended", "user", target_user_id, {
                "reason": reason,
                "duration_days": duration_days,
                "target_user": target_user.email
            })
            
            return {
                "success": True,
                "message": "Uživatel byl pozastaven"
            }
            
        except Exception as e:
            self.logger.error(f"User suspension error: {str(e)}")
            return {
                "success": False,
                "error": "internal_error",
                "message": "Došlo k vnitřní chybě"
            }
    
    async def create_invitation(self, inviter_id: str, email: str, 
                               role: UserRole = UserRole.USER) -> Dict[str, Any]:
        """Vytvoří pozvánku pro nového uživatele"""
        try:
            inviter = await self.get_user(inviter_id)
            if not inviter or inviter.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
                return {
                    "success": False,
                    "error": "insufficient_permissions",
                    "message": "Nedostatečná oprávnění"
                }
            
            # Kontrola, zda email již neexistuje
            if await self._email_exists(email):
                return {
                    "success": False,
                    "error": "email_exists",
                    "message": "Uživatel s tímto emailem již existuje"
                }
            
            invitation_id = str(uuid.uuid4())
            invitation = UserInvitation(
                id=invitation_id,
                inviter_id=inviter_id,
                email=email,
                role=role,
                expires_at=datetime.now() + timedelta(days=7),
                used_at=None,
                created_at=datetime.now()
            )
            
            self.invitations[invitation_id] = invitation
            
            # Zaznamenání aktivity
            await self._log_activity(inviter_id, "invitation_created", "invitation", invitation_id, {
                "invited_email": email,
                "role": role.value
            })
            
            return {
                "success": True,
                "invitation_id": invitation_id,
                "message": "Pozvánka byla vytvořena"
            }
            
        except Exception as e:
            self.logger.error(f"Invitation creation error: {str(e)}")
            return {
                "success": False,
                "error": "internal_error",
                "message": "Došlo k vnitřní chybě"
            }
    
    async def get_user_statistics(self, admin_user_id: str) -> Dict[str, Any]:
        """Získá statistiky uživatelů (pouze admin)"""
        try:
            admin_user = await self.get_user(admin_user_id)
            if not admin_user or admin_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
                return {
                    "success": False,
                    "error": "insufficient_permissions",
                    "message": "Nedostatečná oprávnění"
                }
            
            total_users = len(self.users_cache)
            active_users = len([u for u in self.users_cache.values() if u.is_active])
            
            # Statistiky podle rolí
            role_stats = {}
            for user in self.users_cache.values():
                role = user.role.value
                role_stats[role] = role_stats.get(role, 0) + 1
            
            # Statistiky podle auth providerů
            provider_stats = {}
            for user in self.users_cache.values():
                provider = user.auth_provider.value
                provider_stats[provider] = provider_stats.get(provider, 0) + 1
            
            # Nově registrovaní uživatelé (posledních 30 dní)
            thirty_days_ago = datetime.now() - timedelta(days=30)
            new_users = len([
                u for u in self.users_cache.values() 
                if u.created_at >= thirty_days_ago
            ])
            
            return {
                "success": True,
                "statistics": {
                    "total_users": total_users,
                    "active_users": active_users,
                    "inactive_users": total_users - active_users,
                    "new_users_30_days": new_users,
                    "role_distribution": role_stats,
                    "auth_provider_distribution": provider_stats
                }
            }
            
        except Exception as e:
            self.logger.error(f"User statistics error: {str(e)}")
            return {
                "success": False,
                "error": "internal_error",
                "message": "Došlo k vnitřní chybě"
            }
    
    async def _create_default_profile(self, user_id: str):
        """Vytvoří výchozí profil"""
        profile = UserProfile(
            user_id=user_id,
            display_name="",
            bio=None,
            location=None,
            website=None,
            social_links={},
            specializations=[],
            languages=["cs"],
            timezone="Europe/Prague",
            privacy_settings={
                "show_email": False,
                "show_location": True,
                "show_collection": True,
                "allow_messages": True
            },
            notification_preferences={
                "email_price_alerts": True,
                "email_auction_reminders": True,
                "email_weekly_summary": False,
                "push_notifications": True
            }
        )
        
        self.profiles_cache[user_id] = profile
    
    async def _create_default_subscription(self, user_id: str):
        """Vytvoří výchozí subscription"""
        subscription = UserSubscription(
            user_id=user_id,
            subscription_type=SubscriptionType.FREE,
            start_date=datetime.now(),
            end_date=None,
            auto_renew=False,
            payment_method=None,
            features=["basic_collection", "price_tracking"],
            usage_limits=self.subscription_limits[SubscriptionType.FREE].copy(),
            current_usage={
                "coins": 0,
                "collections": 0,
                "price_alerts": 0,
                "api_calls_today": 0,
                "exports_this_month": 0
            }
        )
        
        self.subscriptions_cache[user_id] = subscription
    
    async def _log_activity(self, user_id: str, action: str, resource_type: str,
                           resource_id: str, metadata: Dict[str, Any],
                           ip_address: str = "127.0.0.1", user_agent: str = ""):
        """Zaznamenává aktivitu uživatele"""
        activity = UserActivity(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            timestamp=datetime.now(),
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata
        )
        
        if user_id not in self.activities:
            self.activities[user_id] = []
        
        self.activities[user_id].append(activity)
        
        # Udržuje pouze posledních 1000 aktivit
        self.activities[user_id] = self.activities[user_id][-1000:]
    
    # Mock metody pro databázové operace
    async def _email_exists(self, email: str) -> bool:
        """Kontroluje, zda email existuje"""
        return any(user.email == email for user in self.users_cache.values())
    
    async def _username_exists(self, username: str) -> bool:
        """Kontroluje, zda username existuje"""
        return any(user.username == username for user in self.users_cache.values())
    
    async def _load_user_from_db(self, user_id: str) -> Optional[User]:
        """Mock načtení uživatele z databáze"""
        return None
    
    async def _store_password_hash(self, user_id: str, password_hash: str):
        """Mock uložení hash hesla"""
        pass

# Factory funkce
def create_user_management_service() -> UserManagementService:
    """Vytvoří instanci služby pro správu uživatelů"""
    return UserManagementService()

# Příklad použití
async def example_usage():
    """Příklad použití služby pro správu uživatelů"""
    user_service = create_user_management_service()
    
    # Vytvoření uživatele
    result = await user_service.create_user(
        email="test@example.com",
        username="testuser",
        password="SecurePass123!",
        first_name="Test",
        last_name="User"
    )
    
    if result["success"]:
        user_id = result["user"]["id"]
        print(f"User created: {user_id}")
        
        # Aktualizace uživatele
        update_result = await user_service.update_user(user_id, {
            "bio": "Sběratel československých mincí",
            "location": "Praha, Česká republika"
        })
        
        if update_result["success"]:
            print("User updated successfully")
        
        # Získání uživatele
        user = await user_service.get_user(user_id)
        if user:
            print(f"Retrieved user: {user.email}")
    else:
        print(f"User creation failed: {result.get('message', 'Unknown error')}")

if __name__ == "__main__":
    asyncio.run(example_usage())