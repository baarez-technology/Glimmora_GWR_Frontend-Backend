from typing import Optional, AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.auth_service import decode_token, get_user_by_id
from app.models.user import User

bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user = await get_user_by_id(db, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


async def require_organizer(user: User = Depends(get_current_user)) -> User:
    # admin is a superset that includes organizer + adjudicator access
    if user.role not in ("organizer", "adjudicator", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organizer access required")
    return user


async def require_adjudicator(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("adjudicator", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Adjudicator access required")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


async def assert_attempt_access(attempt, user: User, db: AsyncSession) -> None:
    """Authorize ``user`` for ``attempt``.

    Allowed: admin (any), the owning organizer, or an adjudicator assigned to
    the attempt's event. Raises 403 otherwise.
    """
    if user.role == "admin":
        return
    if user.role == "organizer" and attempt.organizer_id == user.id:
        return
    if user.role == "adjudicator" and attempt.event_id:
        from app.models.admin import AdminAdjudicator, AdminAssignment

        adj = (await db.execute(
            select(AdminAdjudicator).where(AdminAdjudicator.user_id == user.id)
        )).scalar_one_or_none()
        if not adj and user.email:
            adj = (await db.execute(
                select(AdminAdjudicator).where(AdminAdjudicator.email.ilike(user.email))
            )).scalar_one_or_none()
            if adj and not adj.user_id:
                adj.user_id = user.id
                await db.commit()
        if adj:
            assigned = (await db.execute(
                select(AdminAssignment).where(
                    AdminAssignment.adjudicator_id == adj.id,
                    AdminAssignment.event_id == attempt.event_id,
                )
            )).scalar_one_or_none()
            if assigned:
                return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this attempt")
