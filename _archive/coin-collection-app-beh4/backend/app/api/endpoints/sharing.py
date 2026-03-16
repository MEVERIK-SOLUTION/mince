from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime

from ...database import get_db
from ...services.sharing_service import SharingService
from ...models.user import User
from ...models.collection_sharing import SharePermission, ShareStatus
from ...core.auth import get_current_user

router = APIRouter()

@router.post("/collections/{collection_id}/share")
async def share_collection(
    collection_id: int,
    shared_with_email: str,
    permission: SharePermission = SharePermission.VIEW,
    invitation_message: Optional[str] = None,
    expires_days: Optional[int] = Query(None, description="Počet dní do vypršení", ge=1, le=365),
    allow_download: bool = Query(False, description="Povolit stahování"),
    allow_comments: bool = Query(True, description="Povolit komentáře"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sdílí kolekci s jiným uživatelem
    """
    try:
        sharing_service = SharingService(db)
        
        result = sharing_service.share_collection(
            collection_id=collection_id,
            owner_id=current_user.id,
            shared_with_email=shared_with_email,
            permission=permission,
            invitation_message=invitation_message,
            expires_days=expires_days,
            allow_download=allow_download,
            allow_comments=allow_comments
        )
        
        return {
            "message": "Pozvánka ke sdílení byla odeslána",
            "share_info": result
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při sdílení kolekce: {str(e)}")

@router.post("/shares/{share_id}/respond")
async def respond_to_invitation(
    share_id: int,
    accept: bool,
    decline_reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Odpověď na pozvánku ke sdílení
    """
    try:
        sharing_service = SharingService(db)
        
        result = sharing_service.respond_to_invitation(
            share_id=share_id,
            user_id=current_user.id,
            accept=accept,
            decline_reason=decline_reason
        )
        
        message = "Pozvánka byla přijata" if accept else "Pozvánka byla odmítnuta"
        
        return {
            "message": message,
            "response_info": result
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při odpovědi na pozvánku: {str(e)}")

@router.delete("/shares/{share_id}")
async def revoke_share(
    share_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Zruší sdílení kolekce
    """
    try:
        sharing_service = SharingService(db)
        
        result = sharing_service.revoke_share(
            share_id=share_id,
            user_id=current_user.id
        )
        
        return {
            "message": "Sdílení bylo zrušeno",
            "revoke_info": result
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při rušení sdílení: {str(e)}")

@router.get("/shares/my-collections")
async def get_my_shared_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Získá kolekce, které uživatel sdílí s ostatními
    """
    try:
        sharing_service = SharingService(db)
        
        shared_collections = sharing_service.get_shared_collections(
            user_id=current_user.id,
            as_owner=True
        )
        
        return {
            "shared_collections": shared_collections,
            "total": len(shared_collections)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při načítání sdílených kolekcí: {str(e)}")

@router.get("/shares/shared-with-me")
async def get_collections_shared_with_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Získá kolekce, které jsou sdíleny s uživatelem
    """
    try:
        sharing_service = SharingService(db)
        
        shared_collections = sharing_service.get_shared_collections(
            user_id=current_user.id,
            as_owner=False
        )
        
        return {
            "shared_collections": shared_collections,
            "total": len(shared_collections)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při načítání sdílených kolekcí: {str(e)}")

@router.post("/collections/{collection_id}/public")
async def create_public_share(
    collection_id: int,
    public_title: Optional[str] = None,
    public_description: Optional[str] = None,
    tags: Optional[str] = None,
    allow_comments: bool = Query(True, description="Povolit komentáře"),
    allow_downloads: bool = Query(False, description="Povolit stahování"),
    require_registration: bool = Query(False, description="Vyžadovat registraci"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Vytvoří veřejné sdílení kolekce
    """
    try:
        sharing_service = SharingService(db)
        
        result = sharing_service.create_public_share(
            collection_id=collection_id,
            user_id=current_user.id,
            public_title=public_title,
            public_description=public_description,
            tags=tags,
            allow_comments=allow_comments,
            allow_downloads=allow_downloads,
            require_registration=require_registration
        )
        
        return {
            "message": "Kolekce byla zveřejněna",
            "public_share": result
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při zveřejňování kolekce: {str(e)}")

@router.get("/public/{slug}")
async def get_public_collection(
    slug: str,
    db: Session = Depends(get_db)
):
    """
    Získá veřejně sdílenou kolekci
    """
    try:
        sharing_service = SharingService(db)
        
        result = sharing_service.get_public_collection(
            slug=slug,
            increment_view=True
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při načítání veřejné kolekce: {str(e)}")

@router.post("/collections/{collection_id}/comments")
async def add_comment(
    collection_id: int,
    content: str,
    parent_id: Optional[int] = None,
    is_private: bool = Query(False, description="Soukromý komentář (pouze pro vlastníka)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Přidá komentář ke kolekci
    """
    try:
        sharing_service = SharingService(db)
        
        result = sharing_service.add_comment(
            collection_id=collection_id,
            user_id=current_user.id,
            content=content,
            parent_id=parent_id,
            is_private=is_private
        )
        
        return {
            "message": "Komentář byl přidán",
            "comment": result
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při přidávání komentáře: {str(e)}")

@router.get("/collections/{collection_id}/comments")
async def get_comments(
    collection_id: int,
    include_private: bool = Query(False, description="Zahrnout soukromé komentáře"),
    limit: int = Query(50, description="Maximální počet komentářů", ge=1, le=100),
    offset: int = Query(0, description="Offset", ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Získá komentáře ke kolekci
    """
    try:
        from ...models.collection_sharing import CollectionComment
        from ...models.collection import Collection
        from sqlalchemy import and_, desc
        
        # Ověření přístupu ke kolekci
        collection = db.query(Collection).filter(Collection.id == collection_id).first()
        if not collection:
            raise HTTPException(status_code=404, detail="Kolekce nenalezena")
        
        # Základní query
        query = db.query(CollectionComment).filter(
            CollectionComment.collection_id == collection_id
        )
        
        # Filtrování soukromých komentářů
        if not include_private or collection.user_id != current_user.id:
            query = query.filter(CollectionComment.is_private == False)
        
        # Pouze top-level komentáře (bez parent_id)
        query = query.filter(CollectionComment.parent_id.is_(None))
        
        # Řazení a paginace
        comments = query.order_by(desc(CollectionComment.created_at)).offset(offset).limit(limit).all()
        
        result = []
        for comment in comments:
            comment_data = {
                "id": comment.id,
                "content": comment.content,
                "user_name": comment.user.full_name,
                "user_email": comment.user.email if collection.user_id == current_user.id else None,
                "is_private": comment.is_private,
                "created_at": comment.created_at.isoformat(),
                "replies": []
            }
            
            # Přidání odpovědí
            for reply in comment.replies:
                if not reply.is_private or collection.user_id == current_user.id:
                    comment_data["replies"].append({
                        "id": reply.id,
                        "content": reply.content,
                        "user_name": reply.user.full_name,
                        "is_private": reply.is_private,
                        "created_at": reply.created_at.isoformat()
                    })
            
            result.append(comment_data)
        
        return {
            "comments": result,
            "total": len(result),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při načítání komentářů: {str(e)}")

@router.post("/teams")
async def create_team(
    name: str,
    description: Optional[str] = None,
    is_public: bool = Query(False, description="Veřejný tým"),
    allow_member_invites: bool = Query(True, description="Povolit členům zvát další"),
    max_members: int = Query(50, description="Maximální počet členů", ge=2, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Vytvoří nový tým
    """
    try:
        sharing_service = SharingService(db)
        
        result = sharing_service.create_team(
            owner_id=current_user.id,
            name=name,
            description=description,
            is_public=is_public,
            allow_member_invites=allow_member_invites,
            max_members=max_members
        )
        
        return {
            "message": "Tým byl vytvořen",
            "team": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při vytváření týmu: {str(e)}")

@router.post("/teams/{team_id}/invite")
async def invite_to_team(
    team_id: int,
    user_email: str,
    role: SharePermission = SharePermission.VIEW,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Pozve uživatele do týmu
    """
    try:
        sharing_service = SharingService(db)
        
        result = sharing_service.invite_to_team(
            team_id=team_id,
            inviter_id=current_user.id,
            user_email=user_email,
            role=role
        )
        
        return {
            "message": "Pozvánka do týmu byla odeslána",
            "invitation": result
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při pozývání do týmu: {str(e)}")

@router.get("/teams")
async def get_my_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Získá týmy uživatele
    """
    try:
        from ...models.collection_sharing import Team, TeamMembership
        from sqlalchemy import or_
        
        # Týmy, které uživatel vlastní nebo je jejich členem
        teams_query = db.query(Team).join(TeamMembership).filter(
            and_(
                TeamMembership.user_id == current_user.id,
                TeamMembership.status == ShareStatus.ACCEPTED
            )
        ).all()
        
        result = []
        for team in teams_query:
            # Počet členů
            member_count = db.query(TeamMembership).filter(
                and_(
                    TeamMembership.team_id == team.id,
                    TeamMembership.status == ShareStatus.ACCEPTED
                )
            ).count()
            
            # Role uživatele v týmu
            user_membership = db.query(TeamMembership).filter(
                and_(
                    TeamMembership.team_id == team.id,
                    TeamMembership.user_id == current_user.id
                )
            ).first()
            
            result.append({
                "id": team.id,
                "name": team.name,
                "description": team.description,
                "is_public": team.is_public,
                "member_count": member_count,
                "max_members": team.max_members,
                "user_role": user_membership.role.value if user_membership else None,
                "is_owner": team.owner_id == current_user.id,
                "created_at": team.created_at.isoformat()
            })
        
        return {
            "teams": result,
            "total": len(result)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při načítání týmů: {str(e)}")

@router.get("/sharing/statistics")
async def get_sharing_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Získá statistiky sdílení pro uživatele
    """
    try:
        sharing_service = SharingService(db)
        
        statistics = sharing_service.get_sharing_statistics(current_user.id)
        
        return {
            "statistics": statistics
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při načítání statistik: {str(e)}")

@router.get("/invitations")
async def get_pending_invitations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Získá nevyřízené pozvánky uživatele
    """
    try:
        from ...models.collection_sharing import CollectionShare, TeamMembership
        
        # Pozvánky ke sdílení kolekcí
        collection_invitations = db.query(CollectionShare).filter(
            and_(
                CollectionShare.shared_with_id == current_user.id,
                CollectionShare.status == ShareStatus.PENDING
            )
        ).all()
        
        # Pozvánky do týmů
        team_invitations = db.query(TeamMembership).filter(
            and_(
                TeamMembership.user_id == current_user.id,
                TeamMembership.status == ShareStatus.PENDING
            )
        ).all()
        
        result = {
            "collection_invitations": [
                {
                    "id": inv.id,
                    "type": "collection",
                    "collection_name": inv.collection.name,
                    "owner_name": inv.owner.full_name,
                    "owner_email": inv.owner.email,
                    "permission": inv.permission.value,
                    "invitation_message": inv.invitation_message,
                    "shared_at": inv.shared_at.isoformat(),
                    "expires_at": inv.expires_at.isoformat() if inv.expires_at else None
                }
                for inv in collection_invitations
            ],
            "team_invitations": [
                {
                    "id": inv.id,
                    "type": "team",
                    "team_name": inv.team.name,
                    "team_description": inv.team.description,
                    "inviter_name": inv.inviter.full_name if inv.inviter else None,
                    "role": inv.role.value,
                    "joined_at": inv.joined_at.isoformat()
                }
                for inv in team_invitations
            ]
        }
        
        return {
            "invitations": result,
            "total_collection_invitations": len(result["collection_invitations"]),
            "total_team_invitations": len(result["team_invitations"])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při načítání pozvánek: {str(e)}")

@router.get("/public/collections")
async def browse_public_collections(
    search: Optional[str] = Query(None, description="Vyhledávací dotaz"),
    tags: Optional[str] = Query(None, description="Tagy oddělené čárkami"),
    limit: int = Query(20, description="Počet výsledků", ge=1, le=100),
    offset: int = Query(0, description="Offset", ge=0),
    sort_by: str = Query("created_at", description="Řazení: created_at, view_count, like_count"),
    sort_order: str = Query("desc", description="Směr řazení: asc, desc"),
    db: Session = Depends(get_db)
):
    """
    Prochází veřejné kolekce
    """
    try:
        from ...models.collection_sharing import PublicCollection
        from ...models.collection import Collection
        from sqlalchemy import desc, asc, or_
        
        # Základní query
        query = db.query(PublicCollection).join(Collection).filter(
            PublicCollection.is_active == True
        )
        
        # Vyhledávání
        if search:
            search_filter = or_(
                PublicCollection.public_title.ilike(f"%{search}%"),
                PublicCollection.public_description.ilike(f"%{search}%"),
                Collection.name.ilike(f"%{search}%")
            )
            query = query.filter(search_filter)
        
        # Filtrování podle tagů
        if tags:
            tag_list = [tag.strip() for tag in tags.split(",")]
            for tag in tag_list:
                query = query.filter(PublicCollection.tags.ilike(f"%{tag}%"))
        
        # Řazení
        sort_column = getattr(PublicCollection, sort_by, PublicCollection.created_at)
        if sort_order == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))
        
        # Paginace
        public_collections = query.offset(offset).limit(limit).all()
        total = query.count()
        
        result = []
        for pc in public_collections:
            collection = pc.collection
            owner = collection.user
            
            result.append({
                "slug": pc.public_slug,
                "title": pc.public_title,
                "description": pc.public_description,
                "tags": pc.tags.split(",") if pc.tags else [],
                "view_count": pc.view_count,
                "like_count": pc.like_count,
                "coin_count": len(collection.coins) if collection.coins else 0,
                "owner_name": owner.full_name,
                "created_at": pc.created_at.isoformat(),
                "thumbnail_url": None  # TODO: Implementovat thumbnail
            })
        
        return {
            "public_collections": result,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při procházení veřejných kolekcí: {str(e)}")