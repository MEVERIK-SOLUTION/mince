import asyncio
from typing import List, Dict, Any, Optional, Set, Callable
from dataclasses import dataclass
from enum import Enum
import logging
from functools import wraps
import re

class Permission(Enum):
    # Základní oprávnění
    READ_PROFILE = "read:profile"
    WRITE_PROFILE = "write:profile"
    
    # Kolekce
    READ_COLLECTION = "read:collection"
    WRITE_COLLECTION = "write:collection"
    DELETE_COLLECTION = "delete:collection"
    SHARE_COLLECTION = "share:collection"
    
    # Analytics a reporty
    READ_ANALYTICS = "read:analytics"
    EXPORT_DATA = "export:data"
    
    # Cenová upozornění
    READ_PRICE_ALERTS = "read:price_alerts"
    WRITE_PRICE_ALERTS = "write:price_alerts"
    
    # Expertní nástroje
    READ_EXPERT_TOOLS = "read:expert_tools"
    WRITE_VALUATIONS = "write:valuations"
    ACCESS_API = "access:api"
    
    # Moderování
    MODERATE_CONTENT = "moderate:content"
    READ_REPORTS = "read:reports"
    BAN_USERS = "ban:users"
    
    # Administrace
    ADMIN_USERS = "admin:users"
    ADMIN_SYSTEM = "admin:system"
    ADMIN_SETTINGS = "admin:settings"
    VIEW_LOGS = "view:logs"
    
    # Speciální
    ALL_PERMISSIONS = "*"

class ResourceType(Enum):
    COLLECTION = "collection"
    COIN = "coin"
    USER = "user"
    REPORT = "report"
    SYSTEM = "system"
    AUCTION = "auction"
    VALUATION = "valuation"

@dataclass
class AccessRule:
    """Pravidlo přístupu k prostředku"""
    resource_type: ResourceType
    resource_id: Optional[str]
    permissions: List[Permission]
    conditions: Dict[str, Any]  # Dodatečné podmínky
    
@dataclass
class AuthContext:
    """Kontext autorizace"""
    user_id: str
    role: str
    permissions: List[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    session_id: Optional[str]

class ResourceOwnershipChecker:
    """Kontrola vlastnictví prostředků"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    async def is_owner(self, user_id: str, resource_type: ResourceType, 
                      resource_id: str) -> bool:
        """Kontroluje, zda je uživatel vlastníkem prostředku"""
        try:
            if resource_type == ResourceType.COLLECTION:
                return await self._is_collection_owner(user_id, resource_id)
            elif resource_type == ResourceType.COIN:
                return await self._is_coin_owner(user_id, resource_id)
            elif resource_type == ResourceType.VALUATION:
                return await self._is_valuation_owner(user_id, resource_id)
            else:
                return False
                
        except Exception as e:
            self.logger.error(f"Ownership check error: {str(e)}")
            return False
    
    async def _is_collection_owner(self, user_id: str, collection_id: str) -> bool:
        """Kontroluje vlastnictví kolekce"""
        # Mock implementace - v reálné aplikaci by to bylo volání do databáze
        return True  # Pro demonstraci
    
    async def _is_coin_owner(self, user_id: str, coin_id: str) -> bool:
        """Kontroluje vlastnictví mince"""
        # Mock implementace
        return True
    
    async def _is_valuation_owner(self, user_id: str, valuation_id: str) -> bool:
        """Kontroluje vlastnictví ocenění"""
        # Mock implementace
        return True

class PermissionChecker:
    """Kontrola oprávnění"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.ownership_checker = ResourceOwnershipChecker()
        
        # Definice oprávnění podle rolí
        self.role_permissions = {
            "guest": [],
            "user": [
                Permission.READ_PROFILE,
                Permission.WRITE_PROFILE,
                Permission.READ_COLLECTION,
                Permission.WRITE_COLLECTION,
            ],
            "premium": [
                Permission.READ_PROFILE,
                Permission.WRITE_PROFILE,
                Permission.READ_COLLECTION,
                Permission.WRITE_COLLECTION,
                Permission.SHARE_COLLECTION,
                Permission.READ_ANALYTICS,
                Permission.EXPORT_DATA,
                Permission.READ_PRICE_ALERTS,
                Permission.WRITE_PRICE_ALERTS,
            ],
            "expert": [
                Permission.READ_PROFILE,
                Permission.WRITE_PROFILE,
                Permission.READ_COLLECTION,
                Permission.WRITE_COLLECTION,
                Permission.SHARE_COLLECTION,
                Permission.READ_ANALYTICS,
                Permission.EXPORT_DATA,
                Permission.READ_PRICE_ALERTS,
                Permission.WRITE_PRICE_ALERTS,
                Permission.READ_EXPERT_TOOLS,
                Permission.WRITE_VALUATIONS,
                Permission.ACCESS_API,
            ],
            "moderator": [
                Permission.READ_PROFILE,
                Permission.WRITE_PROFILE,
                Permission.READ_COLLECTION,
                Permission.WRITE_COLLECTION,
                Permission.SHARE_COLLECTION,
                Permission.READ_ANALYTICS,
                Permission.EXPORT_DATA,
                Permission.READ_PRICE_ALERTS,
                Permission.WRITE_PRICE_ALERTS,
                Permission.READ_EXPERT_TOOLS,
                Permission.WRITE_VALUATIONS,
                Permission.ACCESS_API,
                Permission.MODERATE_CONTENT,
                Permission.READ_REPORTS,
                Permission.BAN_USERS,
            ],
            "admin": [
                Permission.READ_PROFILE,
                Permission.WRITE_PROFILE,
                Permission.READ_COLLECTION,
                Permission.WRITE_COLLECTION,
                Permission.DELETE_COLLECTION,
                Permission.SHARE_COLLECTION,
                Permission.READ_ANALYTICS,
                Permission.EXPORT_DATA,
                Permission.READ_PRICE_ALERTS,
                Permission.WRITE_PRICE_ALERTS,
                Permission.READ_EXPERT_TOOLS,
                Permission.WRITE_VALUATIONS,
                Permission.ACCESS_API,
                Permission.MODERATE_CONTENT,
                Permission.READ_REPORTS,
                Permission.BAN_USERS,
                Permission.ADMIN_USERS,
                Permission.ADMIN_SYSTEM,
                Permission.ADMIN_SETTINGS,
                Permission.VIEW_LOGS,
            ],
            "super_admin": [Permission.ALL_PERMISSIONS]
        }
    
    def has_permission(self, context: AuthContext, permission: Permission) -> bool:
        """Kontroluje, zda má uživatel oprávnění"""
        try:
            # Super admin má všechna oprávnění
            if context.role == "super_admin":
                return True
            
            # Kontrola explicitních oprávnění
            if permission.value in context.permissions:
                return True
            
            # Kontrola oprávnění podle role
            role_perms = self.role_permissions.get(context.role, [])
            return permission in role_perms
            
        except Exception as e:
            self.logger.error(f"Permission check error: {str(e)}")
            return False
    
    async def can_access_resource(self, context: AuthContext, 
                                resource_type: ResourceType,
                                resource_id: str,
                                permission: Permission,
                                additional_checks: Dict[str, Any] = None) -> bool:
        """Kontroluje přístup k prostředku"""
        try:
            # Základní kontrola oprávnění
            if not self.has_permission(context, permission):
                return False
            
            # Kontrola vlastnictví pro osobní prostředky
            if resource_type in [ResourceType.COLLECTION, ResourceType.COIN, ResourceType.VALUATION]:
                if not await self.ownership_checker.is_owner(context.user_id, resource_type, resource_id):
                    # Pokud není vlastník, musí mít admin oprávnění
                    return self.has_permission(context, Permission.ADMIN_SYSTEM)
            
            # Dodatečné kontroly
            if additional_checks:
                return await self._perform_additional_checks(context, additional_checks)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Resource access check error: {str(e)}")
            return False
    
    async def _perform_additional_checks(self, context: AuthContext, 
                                       checks: Dict[str, Any]) -> bool:
        """Provede dodatečné kontroly"""
        try:
            # IP whitelist
            if "allowed_ips" in checks:
                if context.ip_address not in checks["allowed_ips"]:
                    return False
            
            # Časové omezení
            if "time_restriction" in checks:
                # Implementace časového omezení
                pass
            
            # Geografické omezení
            if "geo_restriction" in checks:
                # Implementace geografického omezení
                pass
            
            return True
            
        except Exception as e:
            self.logger.error(f"Additional checks error: {str(e)}")
            return False

class AuthorizationService:
    """Hlavní služba pro autorizaci"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.permission_checker = PermissionChecker()
        self.access_rules: List[AccessRule] = []
        self.role_hierarchy = {
            "guest": 0,
            "user": 1,
            "premium": 2,
            "expert": 3,
            "moderator": 4,
            "admin": 5,
            "super_admin": 6
        }
    
    def add_access_rule(self, rule: AccessRule):
        """Přidá pravidlo přístupu"""
        self.access_rules.append(rule)
    
    async def authorize(self, context: AuthContext, 
                       permission: Permission,
                       resource_type: ResourceType = None,
                       resource_id: str = None) -> bool:
        """Hlavní metoda pro autorizaci"""
        try:
            # Základní kontrola oprávnění
            if not self.permission_checker.has_permission(context, permission):
                self.logger.warning(f"User {context.user_id} denied permission {permission.value}")
                return False
            
            # Kontrola přístupu k prostředku
            if resource_type and resource_id:
                if not await self.permission_checker.can_access_resource(
                    context, resource_type, resource_id, permission
                ):
                    self.logger.warning(f"User {context.user_id} denied access to {resource_type.value}:{resource_id}")
                    return False
            
            # Kontrola specifických pravidel
            if not await self._check_access_rules(context, permission, resource_type, resource_id):
                return False
            
            self.logger.info(f"User {context.user_id} authorized for {permission.value}")
            return True
            
        except Exception as e:
            self.logger.error(f"Authorization error: {str(e)}")
            return False
    
    async def _check_access_rules(self, context: AuthContext,
                                permission: Permission,
                                resource_type: ResourceType = None,
                                resource_id: str = None) -> bool:
        """Kontroluje specifická pravidla přístupu"""
        try:
            for rule in self.access_rules:
                # Kontrola typu prostředku
                if rule.resource_type != resource_type:
                    continue
                
                # Kontrola ID prostředku
                if rule.resource_id and rule.resource_id != resource_id:
                    continue
                
                # Kontrola oprávnění
                if permission not in rule.permissions:
                    continue
                
                # Kontrola podmínek
                if not await self._evaluate_conditions(context, rule.conditions):
                    return False
            
            return True
            
        except Exception as e:
            self.logger.error(f"Access rules check error: {str(e)}")
            return False
    
    async def _evaluate_conditions(self, context: AuthContext, 
                                 conditions: Dict[str, Any]) -> bool:
        """Vyhodnotí podmínky pravidla"""
        try:
            for condition, value in conditions.items():
                if condition == "min_role_level":
                    user_level = self.role_hierarchy.get(context.role, 0)
                    if user_level < value:
                        return False
                
                elif condition == "required_permissions":
                    for perm in value:
                        if perm not in context.permissions:
                            return False
                
                elif condition == "ip_whitelist":
                    if context.ip_address not in value:
                        return False
                
                # Další podmínky...
            
            return True
            
        except Exception as e:
            self.logger.error(f"Condition evaluation error: {str(e)}")
            return False
    
    def get_user_permissions(self, role: str) -> List[Permission]:
        """Získá všechna oprávnění pro roli"""
        return self.permission_checker.role_permissions.get(role, [])
    
    def can_escalate_to_role(self, current_role: str, target_role: str) -> bool:
        """Kontroluje, zda může být role povýšena"""
        current_level = self.role_hierarchy.get(current_role, 0)
        target_level = self.role_hierarchy.get(target_role, 0)
        
        # Pouze admin a super_admin mohou povyšovat role
        return current_level >= 5 and target_level <= current_level

# Dekorátory pro kontrolu oprávnění
def require_permission(permission: Permission, 
                      resource_type: ResourceType = None,
                      resource_id_param: str = None):
    """Dekorátor pro kontrolu oprávnění"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Získá kontext z argumentů (předpokládá se, že je předán)
            context = kwargs.get('auth_context') or args[0] if args else None
            
            if not isinstance(context, AuthContext):
                raise ValueError("AuthContext not provided")
            
            # Získá resource_id z parametrů
            resource_id = None
            if resource_id_param and resource_id_param in kwargs:
                resource_id = kwargs[resource_id_param]
            
            # Vytvoří autorizační službu
            auth_service = AuthorizationService()
            
            # Kontrola oprávnění
            if not await auth_service.authorize(
                context, permission, resource_type, resource_id
            ):
                raise PermissionError(f"Access denied: {permission.value}")
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator

def require_role(min_role: str):
    """Dekorátor pro kontrolu minimální role"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            context = kwargs.get('auth_context') or args[0] if args else None
            
            if not isinstance(context, AuthContext):
                raise ValueError("AuthContext not provided")
            
            auth_service = AuthorizationService()
            user_level = auth_service.role_hierarchy.get(context.role, 0)
            min_level = auth_service.role_hierarchy.get(min_role, 0)
            
            if user_level < min_level:
                raise PermissionError(f"Minimum role required: {min_role}")
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator

# Factory funkce
def create_authorization_service() -> AuthorizationService:
    """Vytvoří instanci autorizační služby"""
    service = AuthorizationService()
    
    # Přidá základní pravidla
    service.add_access_rule(AccessRule(
        resource_type=ResourceType.SYSTEM,
        resource_id=None,
        permissions=[Permission.ADMIN_SYSTEM],
        conditions={"min_role_level": 5}
    ))
    
    return service

# Příklad použití
async def example_usage():
    """Příklad použití autorizační služby"""
    auth_service = create_authorization_service()
    
    # Vytvoří kontext
    context = AuthContext(
        user_id="user123",
        role="premium",
        permissions=["read:collection", "write:collection", "read:analytics"],
        ip_address="192.168.1.1",
        user_agent="Mozilla/5.0...",
        session_id="session123"
    )
    
    # Kontrola oprávnění
    can_read = await auth_service.authorize(
        context, 
        Permission.READ_COLLECTION,
        ResourceType.COLLECTION,
        "collection123"
    )
    
    print(f"Can read collection: {can_read}")
    
    can_admin = await auth_service.authorize(
        context,
        Permission.ADMIN_SYSTEM
    )
    
    print(f"Can admin system: {can_admin}")

# Příklad použití dekorátorů
@require_permission(Permission.READ_COLLECTION, ResourceType.COLLECTION, "collection_id")
async def get_collection(auth_context: AuthContext, collection_id: str):
    """Příklad funkce s kontrolou oprávnění"""
    return f"Collection {collection_id} data"

@require_role("admin")
async def admin_function(auth_context: AuthContext):
    """Příklad admin funkce"""
    return "Admin data"

if __name__ == "__main__":
    asyncio.run(example_usage())