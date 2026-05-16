"""Lightweight helper for creating in-app notification rows."""
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def notify(
    db: AsyncSession,
    *,
    user_id: str,
    title: str,
    detail: Optional[str] = None,
    tone: str = "info",
    link: Optional[str] = None,
) -> Notification:
    n = Notification(user_id=user_id, title=title, detail=detail, tone=tone, link=link)
    db.add(n)
    await db.flush()
    return n
