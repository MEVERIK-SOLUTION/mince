from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from ..database import Base

class SharePermission(enum.Enum):
    VIEW = "view"
    EDIT = "edit"
    ADMIN = "admin"

class ShareStatus(enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    REVOKED = "revoked"

class CollectionShare(Base):
    """
    Model pro sdílení kolekcí mezi uživateli
    """
    __tablename__ = "collection_shares"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shared_with_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    permission = Column(Enum(SharePermission), nullable=False, default=SharePermission.VIEW)
    status = Column(Enum(ShareStatus), nullable=False, default=ShareStatus.PENDING)
    
    # Metadata
    shared_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Volitelné zprávy
    invitation_message = Column(Text, nullable=True)
    decline_reason = Column(Text, nullable=True)
    
    # Nastavení sdílení
    allow_download = Column(Boolean, default=False, nullable=False)
    allow_comments = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    collection = relationship("Collection", back_populates="shares")
    owner = relationship("User", foreign_keys=[owner_id], back_populates="shared_collections")
    shared_with = relationship("User", foreign_keys=[shared_with_id], back_populates="received_shares")

class CollectionComment(Base):
    """
    Model pro komentáře ke sdíleným kolekcím
    """
    __tablename__ = "collection_comments"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("collection_comments.id", ondelete="CASCADE"), nullable=True)
    
    content = Column(Text, nullable=False)
    is_private = Column(Boolean, default=False, nullable=False)  # Pouze pro vlastníka
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    
    # Relationships
    collection = relationship("Collection", back_populates="comments")
    user = relationship("User", back_populates="comments")
    parent = relationship("CollectionComment", remote_side=[id], back_populates="replies")
    replies = relationship("CollectionComment", back_populates="parent", cascade="all, delete-orphan")

class PublicCollection(Base):
    """
    Model pro veřejně sdílené kolekce
    """
    __tablename__ = "public_collections"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Veřejné URL
    public_slug = Column(String(100), unique=True, nullable=False, index=True)
    
    # Nastavení
    is_active = Column(Boolean, default=True, nullable=False)
    allow_comments = Column(Boolean, default=True, nullable=False)
    allow_downloads = Column(Boolean, default=False, nullable=False)
    require_registration = Column(Boolean, default=False, nullable=False)
    
    # SEO a metadata
    public_title = Column(String(200), nullable=True)
    public_description = Column(Text, nullable=True)
    tags = Column(String(500), nullable=True)  # Comma-separated tags
    
    # Statistiky
    view_count = Column(Integer, default=0, nullable=False)
    like_count = Column(Integer, default=0, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    
    # Relationships
    collection = relationship("Collection", back_populates="public_share")

class CollectionLike(Base):
    """
    Model pro lajky veřejných kolekcí
    """
    __tablename__ = "collection_likes"

    id = Column(Integer, primary_key=True, index=True)
    public_collection_id = Column(Integer, ForeignKey("public_collections.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)  # Nullable pro anonymní lajky
    
    # Pro anonymní uživatele
    ip_address = Column(String(45), nullable=True)  # IPv6 support
    user_agent = Column(String(500), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    public_collection = relationship("PublicCollection")
    user = relationship("User")

class TeamMembership(Base):
    """
    Model pro týmové členství a skupinové sdílení
    """
    __tablename__ = "team_memberships"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    role = Column(Enum(SharePermission), nullable=False, default=SharePermission.VIEW)
    status = Column(Enum(ShareStatus), nullable=False, default=ShareStatus.PENDING)
    
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships")
    inviter = relationship("User", foreign_keys=[invited_by])

class Team(Base):
    """
    Model pro týmy/skupiny uživatelů
    """
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Nastavení týmu
    is_public = Column(Boolean, default=False, nullable=False)
    allow_member_invites = Column(Boolean, default=True, nullable=False)
    max_members = Column(Integer, default=50, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    
    # Relationships
    owner = relationship("User", back_populates="owned_teams")
    members = relationship("TeamMembership", back_populates="team", cascade="all, delete-orphan")
    shared_collections = relationship("TeamCollectionShare", back_populates="team", cascade="all, delete-orphan")

class TeamCollectionShare(Base):
    """
    Model pro sdílení kolekcí s týmy
    """
    __tablename__ = "team_collection_shares"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    
    permission = Column(Enum(SharePermission), nullable=False, default=SharePermission.VIEW)
    shared_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    shared_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    collection = relationship("Collection")
    team = relationship("Team", back_populates="shared_collections")
    sharer = relationship("User")

# Rozšíření existujících modelů
def extend_existing_models():
    """
    Funkce pro rozšíření existujících modelů o vztahy pro sdílení
    """
    from .collection import Collection
    from .user import User
    
    # Přidání vztahů do Collection modelu
    Collection.shares = relationship("CollectionShare", back_populates="collection", cascade="all, delete-orphan")
    Collection.comments = relationship("CollectionComment", back_populates="collection", cascade="all, delete-orphan")
    Collection.public_share = relationship("PublicCollection", back_populates="collection", uselist=False, cascade="all, delete-orphan")
    
    # Přidání vztahů do User modelu
    User.shared_collections = relationship("CollectionShare", foreign_keys="CollectionShare.owner_id", back_populates="owner")
    User.received_shares = relationship("CollectionShare", foreign_keys="CollectionShare.shared_with_id", back_populates="shared_with")
    User.comments = relationship("CollectionComment", back_populates="user")
    User.team_memberships = relationship("TeamMembership", back_populates="user")
    User.owned_teams = relationship("Team", back_populates="owner")