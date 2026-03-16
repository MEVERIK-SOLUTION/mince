import secrets
import string
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib

from ..models.collection_sharing import (
    CollectionShare, CollectionComment, PublicCollection, CollectionLike,
    TeamMembership, Team, TeamCollectionShare, SharePermission, ShareStatus
)
from ..models.collection import Collection
from ..models.user import User
from ..core.config import settings

class SharingService:
    def __init__(self, db: Session):
        self.db = db
    
    def share_collection(
        self,
        collection_id: int,
        owner_id: int,
        shared_with_email: str,
        permission: SharePermission = SharePermission.VIEW,
        invitation_message: Optional[str] = None,
        expires_days: Optional[int] = None,
        allow_download: bool = False,
        allow_comments: bool = True
    ) -> Dict[str, Any]:
        """
        Sdílí kolekci s jiným uživatelem
        """
        # Ověření existence kolekce a oprávnění
        collection = self.db.query(Collection).filter(
            and_(Collection.id == collection_id, Collection.user_id == owner_id)
        ).first()
        
        if not collection:
            raise ValueError("Kolekce nenalezena nebo nemáte oprávnění")
        
        # Najít uživatele podle emailu
        shared_with_user = self.db.query(User).filter(User.email == shared_with_email).first()
        
        if not shared_with_user:
            raise ValueError("Uživatel s tímto emailem neexistuje")
        
        if shared_with_user.id == owner_id:
            raise ValueError("Nemůžete sdílet kolekci sami se sebou")
        
        # Kontrola existujícího sdílení
        existing_share = self.db.query(CollectionShare).filter(
            and_(
                CollectionShare.collection_id == collection_id,
                CollectionShare.shared_with_id == shared_with_user.id
            )
        ).first()
        
        if existing_share:
            if existing_share.status == ShareStatus.PENDING:
                raise ValueError("Pozvánka již byla odeslána")
            elif existing_share.status == ShareStatus.ACCEPTED:
                raise ValueError("Kolekce je již sdílena s tímto uživatelem")
        
        # Vytvoření nového sdílení
        expires_at = None
        if expires_days:
            expires_at = datetime.now() + timedelta(days=expires_days)
        
        share = CollectionShare(
            collection_id=collection_id,
            owner_id=owner_id,
            shared_with_id=shared_with_user.id,
            permission=permission,
            status=ShareStatus.PENDING,
            invitation_message=invitation_message,
            expires_at=expires_at,
            allow_download=allow_download,
            allow_comments=allow_comments
        )
        
        self.db.add(share)
        self.db.commit()
        self.db.refresh(share)
        
        # Odeslání emailové pozvánky
        self._send_invitation_email(share, collection, shared_with_user)
        
        return {
            "share_id": share.id,
            "collection_name": collection.name,
            "shared_with": shared_with_user.email,
            "permission": permission.value,
            "status": share.status.value,
            "expires_at": expires_at.isoformat() if expires_at else None
        }
    
    def respond_to_invitation(
        self,
        share_id: int,
        user_id: int,
        accept: bool,
        decline_reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Odpověď na pozvánku ke sdílení
        """
        share = self.db.query(CollectionShare).filter(
            and_(
                CollectionShare.id == share_id,
                CollectionShare.shared_with_id == user_id,
                CollectionShare.status == ShareStatus.PENDING
            )
        ).first()
        
        if not share:
            raise ValueError("Pozvánka nenalezena nebo již byla zpracována")
        
        # Kontrola expirace
        if share.expires_at and share.expires_at < datetime.now():
            share.status = ShareStatus.REVOKED
            self.db.commit()
            raise ValueError("Pozvánka vypršela")
        
        if accept:
            share.status = ShareStatus.ACCEPTED
            share.accepted_at = datetime.now()
        else:
            share.status = ShareStatus.DECLINED
            share.decline_reason = decline_reason
        
        self.db.commit()
        
        # Notifikace vlastníka
        self._notify_owner_response(share, accept)
        
        return {
            "share_id": share.id,
            "status": share.status.value,
            "accepted_at": share.accepted_at.isoformat() if share.accepted_at else None
        }
    
    def revoke_share(
        self,
        share_id: int,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Zruší sdílení kolekce
        """
        share = self.db.query(CollectionShare).filter(
            and_(
                CollectionShare.id == share_id,
                or_(
                    CollectionShare.owner_id == user_id,
                    CollectionShare.shared_with_id == user_id
                )
            )
        ).first()
        
        if not share:
            raise ValueError("Sdílení nenalezeno")
        
        share.status = ShareStatus.REVOKED
        self.db.commit()
        
        return {
            "share_id": share.id,
            "status": share.status.value,
            "revoked_at": datetime.now().isoformat()
        }
    
    def get_shared_collections(
        self,
        user_id: int,
        as_owner: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Získá seznam sdílených kolekcí
        """
        if as_owner:
            # Kolekce, které uživatel sdílí s ostatními
            query = self.db.query(CollectionShare).filter(
                CollectionShare.owner_id == user_id
            )
        else:
            # Kolekce, které jsou sdíleny s uživatelem
            query = self.db.query(CollectionShare).filter(
                and_(
                    CollectionShare.shared_with_id == user_id,
                    CollectionShare.status == ShareStatus.ACCEPTED
                )
            )
        
        shares = query.all()
        
        result = []
        for share in shares:
            collection = share.collection
            shared_user = share.shared_with if as_owner else share.owner
            
            result.append({
                "share_id": share.id,
                "collection": {
                    "id": collection.id,
                    "name": collection.name,
                    "description": collection.description,
                    "coin_count": len(collection.coins) if collection.coins else 0
                },
                "shared_user": {
                    "id": shared_user.id,
                    "email": shared_user.email,
                    "full_name": shared_user.full_name
                },
                "permission": share.permission.value,
                "status": share.status.value,
                "shared_at": share.shared_at.isoformat(),
                "accepted_at": share.accepted_at.isoformat() if share.accepted_at else None,
                "expires_at": share.expires_at.isoformat() if share.expires_at else None,
                "allow_download": share.allow_download,
                "allow_comments": share.allow_comments
            })
        
        return result
    
    def create_public_share(
        self,
        collection_id: int,
        user_id: int,
        public_title: Optional[str] = None,
        public_description: Optional[str] = None,
        tags: Optional[str] = None,
        allow_comments: bool = True,
        allow_downloads: bool = False,
        require_registration: bool = False
    ) -> Dict[str, Any]:
        """
        Vytvoří veřejné sdílení kolekce
        """
        # Ověření oprávnění
        collection = self.db.query(Collection).filter(
            and_(Collection.id == collection_id, Collection.user_id == user_id)
        ).first()
        
        if not collection:
            raise ValueError("Kolekce nenalezena nebo nemáte oprávnění")
        
        # Kontrola existujícího veřejného sdílení
        existing_public = self.db.query(PublicCollection).filter(
            PublicCollection.collection_id == collection_id
        ).first()
        
        if existing_public:
            raise ValueError("Kolekce je již veřejně sdílena")
        
        # Generování unikátního slug
        public_slug = self._generate_public_slug(collection.name)
        
        public_collection = PublicCollection(
            collection_id=collection_id,
            public_slug=public_slug,
            public_title=public_title or collection.name,
            public_description=public_description or collection.description,
            tags=tags,
            allow_comments=allow_comments,
            allow_downloads=allow_downloads,
            require_registration=require_registration
        )
        
        self.db.add(public_collection)
        self.db.commit()
        self.db.refresh(public_collection)
        
        return {
            "public_id": public_collection.id,
            "public_slug": public_slug,
            "public_url": f"{settings.FRONTEND_URL}/public/{public_slug}",
            "collection_name": collection.name,
            "settings": {
                "allow_comments": allow_comments,
                "allow_downloads": allow_downloads,
                "require_registration": require_registration
            }
        }
    
    def get_public_collection(
        self,
        slug: str,
        increment_view: bool = True
    ) -> Dict[str, Any]:
        """
        Získá veřejně sdílenou kolekci
        """
        public_collection = self.db.query(PublicCollection).filter(
            and_(
                PublicCollection.public_slug == slug,
                PublicCollection.is_active == True
            )
        ).first()
        
        if not public_collection:
            raise ValueError("Veřejná kolekce nenalezena")
        
        # Zvýšení počtu zobrazení
        if increment_view:
            public_collection.view_count += 1
            self.db.commit()
        
        collection = public_collection.collection
        owner = collection.user
        
        # Získání komentářů
        comments = self.db.query(CollectionComment).filter(
            and_(
                CollectionComment.collection_id == collection.id,
                CollectionComment.is_private == False
            )
        ).order_by(desc(CollectionComment.created_at)).all()
        
        return {
            "public_collection": {
                "id": public_collection.id,
                "slug": public_collection.public_slug,
                "title": public_collection.public_title,
                "description": public_collection.public_description,
                "tags": public_collection.tags.split(",") if public_collection.tags else [],
                "view_count": public_collection.view_count,
                "like_count": public_collection.like_count,
                "created_at": public_collection.created_at.isoformat(),
                "settings": {
                    "allow_comments": public_collection.allow_comments,
                    "allow_downloads": public_collection.allow_downloads,
                    "require_registration": public_collection.require_registration
                }
            },
            "collection": {
                "id": collection.id,
                "name": collection.name,
                "description": collection.description,
                "coin_count": len(collection.coins) if collection.coins else 0,
                "created_at": collection.created_at.isoformat()
            },
            "owner": {
                "full_name": owner.full_name,
                "email": owner.email if not public_collection.require_registration else None
            },
            "comments": [
                {
                    "id": comment.id,
                    "content": comment.content,
                    "user_name": comment.user.full_name,
                    "created_at": comment.created_at.isoformat(),
                    "replies_count": len(comment.replies) if comment.replies else 0
                }
                for comment in comments if not comment.parent_id
            ]
        }
    
    def add_comment(
        self,
        collection_id: int,
        user_id: int,
        content: str,
        parent_id: Optional[int] = None,
        is_private: bool = False
    ) -> Dict[str, Any]:
        """
        Přidá komentář ke kolekci
        """
        # Ověření oprávnění ke komentování
        can_comment = self._can_user_comment(collection_id, user_id)
        
        if not can_comment:
            raise ValueError("Nemáte oprávnění komentovat tuto kolekci")
        
        comment = CollectionComment(
            collection_id=collection_id,
            user_id=user_id,
            content=content,
            parent_id=parent_id,
            is_private=is_private
        )
        
        self.db.add(comment)
        self.db.commit()
        self.db.refresh(comment)
        
        return {
            "comment_id": comment.id,
            "content": comment.content,
            "user_name": comment.user.full_name,
            "created_at": comment.created_at.isoformat(),
            "is_private": comment.is_private
        }
    
    def create_team(
        self,
        owner_id: int,
        name: str,
        description: Optional[str] = None,
        is_public: bool = False,
        allow_member_invites: bool = True,
        max_members: int = 50
    ) -> Dict[str, Any]:
        """
        Vytvoří nový tým
        """
        team = Team(
            name=name,
            description=description,
            owner_id=owner_id,
            is_public=is_public,
            allow_member_invites=allow_member_invites,
            max_members=max_members
        )
        
        self.db.add(team)
        self.db.commit()
        self.db.refresh(team)
        
        # Přidání vlastníka jako admin
        membership = TeamMembership(
            team_id=team.id,
            user_id=owner_id,
            role=SharePermission.ADMIN,
            status=ShareStatus.ACCEPTED
        )
        
        self.db.add(membership)
        self.db.commit()
        
        return {
            "team_id": team.id,
            "name": team.name,
            "description": team.description,
            "is_public": team.is_public,
            "member_count": 1,
            "created_at": team.created_at.isoformat()
        }
    
    def invite_to_team(
        self,
        team_id: int,
        inviter_id: int,
        user_email: str,
        role: SharePermission = SharePermission.VIEW
    ) -> Dict[str, Any]:
        """
        Pozve uživatele do týmu
        """
        # Ověření oprávnění
        membership = self.db.query(TeamMembership).filter(
            and_(
                TeamMembership.team_id == team_id,
                TeamMembership.user_id == inviter_id,
                TeamMembership.status == ShareStatus.ACCEPTED,
                TeamMembership.role.in_([SharePermission.ADMIN, SharePermission.EDIT])
            )
        ).first()
        
        if not membership:
            raise ValueError("Nemáte oprávnění zvát uživatele do tohoto týmu")
        
        # Najít uživatele
        user = self.db.query(User).filter(User.email == user_email).first()
        if not user:
            raise ValueError("Uživatel nenalezen")
        
        # Kontrola existujícího členství
        existing = self.db.query(TeamMembership).filter(
            and_(
                TeamMembership.team_id == team_id,
                TeamMembership.user_id == user.id
            )
        ).first()
        
        if existing:
            raise ValueError("Uživatel je již členem týmu nebo má nevyřízenou pozvánku")
        
        # Vytvoření pozvánky
        new_membership = TeamMembership(
            team_id=team_id,
            user_id=user.id,
            role=role,
            status=ShareStatus.PENDING,
            invited_by=inviter_id
        )
        
        self.db.add(new_membership)
        self.db.commit()
        
        return {
            "invitation_id": new_membership.id,
            "team_name": membership.team.name,
            "invited_user": user.email,
            "role": role.value
        }
    
    def _generate_public_slug(self, collection_name: str) -> str:
        """
        Generuje unikátní slug pro veřejné sdílení
        """
        # Základní slug z názvu
        base_slug = collection_name.lower().replace(" ", "-")
        base_slug = "".join(c for c in base_slug if c.isalnum() or c == "-")
        
        # Přidání náhodných znaků pro unikátnost
        random_suffix = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(8))
        slug = f"{base_slug}-{random_suffix}"
        
        # Kontrola unikátnosti
        while self.db.query(PublicCollection).filter(PublicCollection.public_slug == slug).first():
            random_suffix = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(8))
            slug = f"{base_slug}-{random_suffix}"
        
        return slug
    
    def _can_user_comment(self, collection_id: int, user_id: int) -> bool:
        """
        Kontroluje, zda může uživatel komentovat kolekci
        """
        # Vlastník může vždy komentovat
        collection = self.db.query(Collection).filter(Collection.id == collection_id).first()
        if collection and collection.user_id == user_id:
            return True
        
        # Uživatel s přístupem přes sdílení
        share = self.db.query(CollectionShare).filter(
            and_(
                CollectionShare.collection_id == collection_id,
                CollectionShare.shared_with_id == user_id,
                CollectionShare.status == ShareStatus.ACCEPTED,
                CollectionShare.allow_comments == True
            )
        ).first()
        
        if share:
            return True
        
        # Veřejná kolekce s povolenými komentáři
        public_collection = self.db.query(PublicCollection).filter(
            and_(
                PublicCollection.collection_id == collection_id,
                PublicCollection.is_active == True,
                PublicCollection.allow_comments == True
            )
        ).first()
        
        return public_collection is not None
    
    def _send_invitation_email(self, share: CollectionShare, collection: Collection, user: User):
        """
        Odešle emailovou pozvánku
        """
        if not settings.SMTP_HOST:
            return  # Email není nakonfigurován
        
        try:
            msg = MIMEMultipart()
            msg['From'] = settings.SMTP_USER
            msg['To'] = user.email
            msg['Subject'] = f"Pozvánka ke sdílení kolekce: {collection.name}"
            
            body = f"""
            Dobrý den {user.full_name},
            
            {share.owner.full_name} s vámi chce sdílet kolekci mincí "{collection.name}".
            
            {share.invitation_message or ""}
            
            Pro přijetí nebo odmítnutí pozvánky klikněte na následující odkaz:
            {settings.FRONTEND_URL}/invitations/{share.id}
            
            Oprávnění: {share.permission.value}
            {f"Pozvánka vyprší: {share.expires_at.strftime('%d.%m.%Y')}" if share.expires_at else ""}
            
            S pozdravem,
            Tým Coin Collection App
            """
            
            msg.attach(MIMEText(body, 'plain', 'utf-8'))
            
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            
            server.send_message(msg)
            server.quit()
            
        except Exception as e:
            print(f"Chyba při odesílání emailu: {e}")
    
    def _notify_owner_response(self, share: CollectionShare, accepted: bool):
        """
        Notifikuje vlastníka o odpovědi na pozvánku
        """
        # Zde by se implementovala notifikace (email, in-app notifikace, atd.)
        pass
    
    def get_sharing_statistics(self, user_id: int) -> Dict[str, Any]:
        """
        Získá statistiky sdílení pro uživatele
        """
        # Kolekce sdílené uživatelem
        shared_by_user = self.db.query(CollectionShare).filter(
            CollectionShare.owner_id == user_id
        ).count()
        
        # Kolekce sdílené s uživatelem
        shared_with_user = self.db.query(CollectionShare).filter(
            and_(
                CollectionShare.shared_with_id == user_id,
                CollectionShare.status == ShareStatus.ACCEPTED
            )
        ).count()
        
        # Veřejné kolekce
        public_collections = self.db.query(PublicCollection).join(Collection).filter(
            Collection.user_id == user_id
        ).count()
        
        # Celkové zobrazení veřejných kolekcí
        total_views = self.db.query(func.sum(PublicCollection.view_count)).join(Collection).filter(
            Collection.user_id == user_id
        ).scalar() or 0
        
        return {
            "collections_shared_by_user": shared_by_user,
            "collections_shared_with_user": shared_with_user,
            "public_collections": public_collections,
            "total_public_views": total_views,
            "teams_owned": self.db.query(Team).filter(Team.owner_id == user_id).count(),
            "teams_member": self.db.query(TeamMembership).filter(
                and_(
                    TeamMembership.user_id == user_id,
                    TeamMembership.status == ShareStatus.ACCEPTED
                )
            ).count()
        }