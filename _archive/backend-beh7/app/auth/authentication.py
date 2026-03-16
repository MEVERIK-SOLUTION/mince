import asyncio
import jwt
import bcrypt
import secrets
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import logging
from enum import Enum
import re
import aioredis
import json
from abc import ABC, abstractmethod

class UserRole(Enum):
    GUEST = "guest"
    USER = "user"
    PREMIUM = "premium"
    EXPERT = "expert"
    MODERATOR = "moderator"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

class AuthProvider(Enum):
    LOCAL = "local"
    GOOGLE = "google"
    FACEBOOK = "facebook"
    APPLE = "apple"
    GITHUB = "github"

@dataclass
class User:
    id: str
    email: str
    username: str
    first_name: str
    last_name: str
    role: UserRole
    is_active: bool
    is_verified: bool
    auth_provider: AuthProvider
    profile_image: Optional[str]
    bio: Optional[str]
    location: Optional[str]
    website: Optional[str]
    preferences: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime]
    login_count: int
    subscription_expires: Optional[datetime]

@dataclass
class AuthToken:
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    scope: List[str]

@dataclass
class LoginAttempt:
    ip_address: str
    user_agent: str
    timestamp: datetime
    success: bool
    failure_reason: Optional[str]

class PasswordValidator:
    """Validátor hesel"""
    
    @staticmethod
    def validate_password(password: str) -> Dict[str, Any]:
        """Validuje sílu hesla"""
        result = {
            "is_valid": True,
            "score": 0,
            "issues": [],
            "suggestions": []
        }
        
        # Minimální délka
        if len(password) < 8:
            result["is_valid"] = False
            result["issues"].append("Heslo musí mít alespoň 8 znaků")
            result["suggestions"].append("Použijte delší heslo")
        else:
            result["score"] += 1
        
        # Velká písmena
        if not re.search(r'[A-Z]', password):
            result["issues"].append("Heslo musí obsahovat velké písmeno")
            result["suggestions"].append("Přidejte velké písmeno")
        else:
            result["score"] += 1
        
        # Malá písmena
        if not re.search(r'[a-z]', password):
            result["issues"].append("Heslo musí obsahovat malé písmeno")
            result["suggestions"].append("Přidejte malé písmeno")
        else:
            result["score"] += 1
        
        # Číslice
        if not re.search(r'\d', password):
            result["issues"].append("Heslo musí obsahovat číslici")
            result["suggestions"].append("Přidejte číslici")
        else:
            result["score"] += 1
        
        # Speciální znaky
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            result["issues"].append("Heslo musí obsahovat speciální znak")
            result["suggestions"].append("Přidejte speciální znak (!@#$%^&*)")
        else:
            result["score"] += 1
        
        # Běžná hesla
        common_passwords = [
            "password", "123456", "123456789", "qwerty", "abc123",
            "password123", "admin", "letmein", "welcome", "monkey"
        ]
        
        if password.lower() in common_passwords:
            result["is_valid"] = False
            result["issues"].append("Heslo je příliš běžné")
            result["suggestions"].append("Použijte originálnější heslo")
            result["score"] = max(0, result["score"] - 2)
        
        # Opakující se znaky
        if re.search(r'(.)\1{2,}', password):
            result["issues"].append("Heslo obsahuje opakující se znaky")
            result["suggestions"].append("Vyhněte se opakování stejných znaků")
            result["score"] = max(0, result["score"] - 1)
        
        # Finální validace
        if result["score"] < 3:
            result["is_valid"] = False
        
        return result

class RateLimiter:
    """Rate limiter pro přihlašování"""
    
    def __init__(self, redis_client):
        self.redis = redis_client
        self.max_attempts = 5
        self.window_minutes = 15
        self.lockout_minutes = 30
    
    async def check_rate_limit(self, identifier: str) -> Dict[str, Any]:
        """Kontroluje rate limit pro identifikátor (IP nebo email)"""
        key = f"rate_limit:{identifier}"
        
        try:
            # Získá aktuální počet pokusů
            attempts = await self.redis.get(key)
            attempts = int(attempts) if attempts else 0
            
            # Kontroluje lockout
            lockout_key = f"lockout:{identifier}"
            lockout = await self.redis.get(lockout_key)
            
            if lockout:
                return {
                    "allowed": False,
                    "reason": "account_locked",
                    "retry_after": await self.redis.ttl(lockout_key),
                    "attempts_remaining": 0
                }
            
            # Kontroluje rate limit
            if attempts >= self.max_attempts:
                # Nastaví lockout
                await self.redis.setex(
                    lockout_key, 
                    self.lockout_minutes * 60, 
                    "locked"
                )
                
                return {
                    "allowed": False,
                    "reason": "too_many_attempts",
                    "retry_after": self.lockout_minutes * 60,
                    "attempts_remaining": 0
                }
            
            return {
                "allowed": True,
                "attempts_remaining": self.max_attempts - attempts,
                "window_remaining": await self.redis.ttl(key) if attempts > 0 else self.window_minutes * 60
            }
            
        except Exception as e:
            logging.error(f"Rate limit check error: {str(e)}")
            # V případě chyby povolí přístup
            return {"allowed": True, "attempts_remaining": self.max_attempts}
    
    async def record_attempt(self, identifier: str, success: bool):
        """Zaznamenává pokus o přihlášení"""
        key = f"rate_limit:{identifier}"
        
        try:
            if success:
                # Úspěšné přihlášení - vymaže počítadlo
                await self.redis.delete(key)
                await self.redis.delete(f"lockout:{identifier}")
            else:
                # Neúspěšný pokus - zvýší počítadlo
                current = await self.redis.get(key)
                if current:
                    await self.redis.incr(key)
                else:
                    await self.redis.setex(key, self.window_minutes * 60, 1)
                    
        except Exception as e:
            logging.error(f"Rate limit record error: {str(e)}")

class AuthenticationService:
    """Hlavní služba pro autentifikaci"""
    
    def __init__(self, secret_key: str, redis_url: str = None):
        self.secret_key = secret_key
        self.algorithm = "HS256"
        self.access_token_expire_minutes = 30
        self.refresh_token_expire_days = 30
        self.logger = logging.getLogger(__name__)
        
        # Redis pro session management a rate limiting
        self.redis = None
        if redis_url:
            asyncio.create_task(self._init_redis(redis_url))
        
        self.rate_limiter = None
        self.active_sessions: Dict[str, Dict[str, Any]] = {}
        self.login_attempts: Dict[str, List[LoginAttempt]] = {}
    
    async def _init_redis(self, redis_url: str):
        """Inicializuje Redis připojení"""
        try:
            self.redis = await aioredis.from_url(redis_url)
            self.rate_limiter = RateLimiter(self.redis)
            self.logger.info("Redis connection established")
        except Exception as e:
            self.logger.error(f"Redis connection failed: {str(e)}")
    
    def hash_password(self, password: str) -> str:
        """Hashuje heslo"""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def verify_password(self, password: str, hashed: str) -> bool:
        """Ověří heslo"""
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    
    def generate_tokens(self, user: User) -> AuthToken:
        """Generuje access a refresh tokeny"""
        now = datetime.utcnow()
        
        # Access token
        access_payload = {
            "sub": user.id,
            "email": user.email,
            "role": user.role.value,
            "iat": now,
            "exp": now + timedelta(minutes=self.access_token_expire_minutes),
            "type": "access"
        }
        
        access_token = jwt.encode(access_payload, self.secret_key, algorithm=self.algorithm)
        
        # Refresh token
        refresh_payload = {
            "sub": user.id,
            "iat": now,
            "exp": now + timedelta(days=self.refresh_token_expire_days),
            "type": "refresh",
            "jti": secrets.token_urlsafe(32)  # Unique token ID
        }
        
        refresh_token = jwt.encode(refresh_payload, self.secret_key, algorithm=self.algorithm)
        
        return AuthToken(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="Bearer",
            expires_in=self.access_token_expire_minutes * 60,
            scope=self._get_user_scopes(user.role)
        )
    
    def _get_user_scopes(self, role: UserRole) -> List[str]:
        """Získá oprávnění podle role"""
        base_scopes = ["read:profile", "write:profile"]
        
        role_scopes = {
            UserRole.GUEST: [],
            UserRole.USER: ["read:collection", "write:collection"],
            UserRole.PREMIUM: [
                "read:collection", "write:collection", 
                "read:analytics", "export:data",
                "read:price_alerts", "write:price_alerts"
            ],
            UserRole.EXPERT: [
                "read:collection", "write:collection",
                "read:analytics", "export:data",
                "read:price_alerts", "write:price_alerts",
                "read:expert_tools", "write:valuations"
            ],
            UserRole.MODERATOR: [
                "read:collection", "write:collection",
                "read:analytics", "export:data",
                "read:price_alerts", "write:price_alerts",
                "read:expert_tools", "write:valuations",
                "moderate:content", "read:reports"
            ],
            UserRole.ADMIN: [
                "read:collection", "write:collection",
                "read:analytics", "export:data",
                "read:price_alerts", "write:price_alerts",
                "read:expert_tools", "write:valuations",
                "moderate:content", "read:reports",
                "admin:users", "admin:system"
            ],
            UserRole.SUPER_ADMIN: ["*"]  # Všechna oprávnění
        }
        
        return base_scopes + role_scopes.get(role, [])
    
    async def authenticate_user(self, email: str, password: str, 
                              ip_address: str, user_agent: str) -> Dict[str, Any]:
        """Autentifikuje uživatele"""
        
        # Rate limiting
        if self.rate_limiter:
            rate_check = await self.rate_limiter.check_rate_limit(ip_address)
            if not rate_check["allowed"]:
                return {
                    "success": False,
                    "error": "rate_limit_exceeded",
                    "message": "Příliš mnoho pokusů o přihlášení",
                    "retry_after": rate_check["retry_after"]
                }
        
        try:
            # Zde by bylo volání do databáze pro získání uživatele
            # Pro demonstraci používáme mock data
            user = await self._get_user_by_email(email)
            
            if not user:
                await self._record_login_attempt(email, ip_address, user_agent, False, "user_not_found")
                return {
                    "success": False,
                    "error": "invalid_credentials",
                    "message": "Neplatné přihlašovací údaje"
                }
            
            if not user.is_active:
                await self._record_login_attempt(email, ip_address, user_agent, False, "account_disabled")
                return {
                    "success": False,
                    "error": "account_disabled",
                    "message": "Účet je deaktivován"
                }
            
            # Ověření hesla (zde by bylo načtení z databáze)
            stored_password_hash = await self._get_user_password_hash(user.id)
            
            if not self.verify_password(password, stored_password_hash):
                await self._record_login_attempt(email, ip_address, user_agent, False, "invalid_password")
                if self.rate_limiter:
                    await self.rate_limiter.record_attempt(ip_address, False)
                
                return {
                    "success": False,
                    "error": "invalid_credentials",
                    "message": "Neplatné přihlašovací údaje"
                }
            
            # Úspěšné přihlášení
            tokens = self.generate_tokens(user)
            session_id = await self._create_session(user, ip_address, user_agent)
            
            await self._record_login_attempt(email, ip_address, user_agent, True)
            await self._update_last_login(user.id)
            
            if self.rate_limiter:
                await self.rate_limiter.record_attempt(ip_address, True)
            
            return {
                "success": True,
                "user": asdict(user),
                "tokens": asdict(tokens),
                "session_id": session_id
            }
            
        except Exception as e:
            self.logger.error(f"Authentication error: {str(e)}")
            return {
                "success": False,
                "error": "internal_error",
                "message": "Došlo k vnitřní chybě"
            }
    
    async def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """Obnoví access token pomocí refresh tokenu"""
        try:
            payload = jwt.decode(refresh_token, self.secret_key, algorithms=[self.algorithm])
            
            if payload.get("type") != "refresh":
                return {
                    "success": False,
                    "error": "invalid_token",
                    "message": "Neplatný refresh token"
                }
            
            user_id = payload.get("sub")
            user = await self._get_user_by_id(user_id)
            
            if not user or not user.is_active:
                return {
                    "success": False,
                    "error": "user_not_found",
                    "message": "Uživatel nenalezen nebo je deaktivován"
                }
            
            # Kontrola, zda token nebyl revokován
            if await self._is_token_revoked(payload.get("jti")):
                return {
                    "success": False,
                    "error": "token_revoked",
                    "message": "Token byl zrušen"
                }
            
            # Generuje nové tokeny
            new_tokens = self.generate_tokens(user)
            
            # Revokuje starý refresh token
            await self._revoke_token(payload.get("jti"))
            
            return {
                "success": True,
                "tokens": asdict(new_tokens)
            }
            
        except jwt.ExpiredSignatureError:
            return {
                "success": False,
                "error": "token_expired",
                "message": "Refresh token vypršel"
            }
        except jwt.InvalidTokenError:
            return {
                "success": False,
                "error": "invalid_token",
                "message": "Neplatný refresh token"
            }
        except Exception as e:
            self.logger.error(f"Token refresh error: {str(e)}")
            return {
                "success": False,
                "error": "internal_error",
                "message": "Došlo k vnitřní chybě"
            }
    
    async def verify_token(self, token: str) -> Dict[str, Any]:
        """Ověří access token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            if payload.get("type") != "access":
                return {
                    "valid": False,
                    "error": "invalid_token_type"
                }
            
            user_id = payload.get("sub")
            user = await self._get_user_by_id(user_id)
            
            if not user or not user.is_active:
                return {
                    "valid": False,
                    "error": "user_not_found"
                }
            
            return {
                "valid": True,
                "user_id": user_id,
                "email": payload.get("email"),
                "role": payload.get("role"),
                "scopes": self._get_user_scopes(UserRole(payload.get("role")))
            }
            
        except jwt.ExpiredSignatureError:
            return {
                "valid": False,
                "error": "token_expired"
            }
        except jwt.InvalidTokenError:
            return {
                "valid": False,
                "error": "invalid_token"
            }
        except Exception as e:
            self.logger.error(f"Token verification error: {str(e)}")
            return {
                "valid": False,
                "error": "internal_error"
            }
    
    async def logout(self, user_id: str, session_id: str = None):
        """Odhlásí uživatele"""
        try:
            if session_id:
                await self._invalidate_session(session_id)
            else:
                # Invaliduje všechny sessions uživatele
                await self._invalidate_user_sessions(user_id)
            
            self.logger.info(f"User {user_id} logged out")
            
        except Exception as e:
            self.logger.error(f"Logout error: {str(e)}")
    
    async def change_password(self, user_id: str, old_password: str, 
                            new_password: str) -> Dict[str, Any]:
        """Změní heslo uživatele"""
        try:
            # Validace nového hesla
            validation = PasswordValidator.validate_password(new_password)
            if not validation["is_valid"]:
                return {
                    "success": False,
                    "error": "weak_password",
                    "issues": validation["issues"],
                    "suggestions": validation["suggestions"]
                }
            
            # Ověření starého hesla
            stored_hash = await self._get_user_password_hash(user_id)
            if not self.verify_password(old_password, stored_hash):
                return {
                    "success": False,
                    "error": "invalid_old_password",
                    "message": "Neplatné staré heslo"
                }
            
            # Uložení nového hesla
            new_hash = self.hash_password(new_password)
            await self._update_user_password(user_id, new_hash)
            
            # Invaliduje všechny sessions (vynutí nové přihlášení)
            await self._invalidate_user_sessions(user_id)
            
            return {
                "success": True,
                "message": "Heslo bylo úspěšně změněno"
            }
            
        except Exception as e:
            self.logger.error(f"Password change error: {str(e)}")
            return {
                "success": False,
                "error": "internal_error",
                "message": "Došlo k vnitřní chybě"
            }
    
    # Mock metody pro databázové operace
    async def _get_user_by_email(self, email: str) -> Optional[User]:
        """Mock: Získá uživatele podle emailu"""
        # V reálné aplikaci by to bylo volání do databáze
        if email == "admin@example.com":
            return User(
                id="admin_123",
                email=email,
                username="admin",
                first_name="Admin",
                last_name="User",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
                auth_provider=AuthProvider.LOCAL,
                profile_image=None,
                bio=None,
                location=None,
                website=None,
                preferences={},
                created_at=datetime.now(),
                updated_at=datetime.now(),
                last_login=None,
                login_count=0,
                subscription_expires=None
            )
        return None
    
    async def _get_user_by_id(self, user_id: str) -> Optional[User]:
        """Mock: Získá uživatele podle ID"""
        if user_id == "admin_123":
            return await self._get_user_by_email("admin@example.com")
        return None
    
    async def _get_user_password_hash(self, user_id: str) -> str:
        """Mock: Získá hash hesla uživatele"""
        # Mock hash pro heslo "password123"
        return "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx/L/jG."
    
    async def _create_session(self, user: User, ip_address: str, user_agent: str) -> str:
        """Vytvoří session"""
        session_id = secrets.token_urlsafe(32)
        session_data = {
            "user_id": user.id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "created_at": datetime.now().isoformat(),
            "last_activity": datetime.now().isoformat()
        }
        
        if self.redis:
            await self.redis.setex(
                f"session:{session_id}",
                24 * 60 * 60,  # 24 hodin
                json.dumps(session_data)
            )
        else:
            self.active_sessions[session_id] = session_data
        
        return session_id
    
    async def _record_login_attempt(self, email: str, ip_address: str, 
                                  user_agent: str, success: bool, 
                                  failure_reason: str = None):
        """Zaznamenává pokus o přihlášení"""
        attempt = LoginAttempt(
            ip_address=ip_address,
            user_agent=user_agent,
            timestamp=datetime.now(),
            success=success,
            failure_reason=failure_reason
        )
        
        if email not in self.login_attempts:
            self.login_attempts[email] = []
        
        self.login_attempts[email].append(attempt)
        
        # Udržuje pouze posledních 100 pokusů
        self.login_attempts[email] = self.login_attempts[email][-100:]
    
    async def _update_last_login(self, user_id: str):
        """Aktualizuje čas posledního přihlášení"""
        # V reálné aplikaci by to bylo volání do databáze
        pass
    
    async def _is_token_revoked(self, jti: str) -> bool:
        """Kontroluje, zda byl token revokován"""
        if self.redis:
            return await self.redis.exists(f"revoked_token:{jti}")
        return False
    
    async def _revoke_token(self, jti: str):
        """Revokuje token"""
        if self.redis:
            await self.redis.setex(
                f"revoked_token:{jti}",
                self.refresh_token_expire_days * 24 * 60 * 60,
                "revoked"
            )
    
    async def _invalidate_session(self, session_id: str):
        """Invaliduje session"""
        if self.redis:
            await self.redis.delete(f"session:{session_id}")
        elif session_id in self.active_sessions:
            del self.active_sessions[session_id]
    
    async def _invalidate_user_sessions(self, user_id: str):
        """Invaliduje všechny sessions uživatele"""
        if self.redis:
            # Najde všechny sessions uživatele
            pattern = "session:*"
            async for key in self.redis.scan_iter(match=pattern):
                session_data = await self.redis.get(key)
                if session_data:
                    data = json.loads(session_data)
                    if data.get("user_id") == user_id:
                        await self.redis.delete(key)
        else:
            # Najde a smaže sessions v paměti
            to_delete = []
            for session_id, session_data in self.active_sessions.items():
                if session_data.get("user_id") == user_id:
                    to_delete.append(session_id)
            
            for session_id in to_delete:
                del self.active_sessions[session_id]
    
    async def _update_user_password(self, user_id: str, password_hash: str):
        """Aktualizuje heslo uživatele"""
        # V reálné aplikaci by to bylo volání do databáze
        pass

# Factory funkce
def create_auth_service(secret_key: str, redis_url: str = None) -> AuthenticationService:
    """Vytvoří instanci autentifikační služby"""
    return AuthenticationService(secret_key, redis_url)

# Příklad použití
async def example_usage():
    """Příklad použití autentifikační služby"""
    auth_service = create_auth_service("your-secret-key-here")
    
    # Pokus o přihlášení
    result = await auth_service.authenticate_user(
        email="admin@example.com",
        password="password123",
        ip_address="192.168.1.1",
        user_agent="Mozilla/5.0..."
    )
    
    if result["success"]:
        print("Login successful!")
        print(f"Access token: {result['tokens']['access_token'][:50]}...")
        
        # Ověření tokenu
        verification = await auth_service.verify_token(result['tokens']['access_token'])
        print(f"Token valid: {verification['valid']}")
        
        # Refresh token
        refresh_result = await auth_service.refresh_token(result['tokens']['refresh_token'])
        if refresh_result["success"]:
            print("Token refreshed successfully!")
    else:
        print(f"Login failed: {result['message']}")

if __name__ == "__main__":
    import os
    asyncio.run(example_usage())