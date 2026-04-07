from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Notification, User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/")
async def get_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    unreadOnly: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = [Notification.userId == user.id]
    if unreadOnly == "true":
        filters.append(Notification.read == False)

    query = (
        select(Notification)
        .where(*filters)
        .order_by(Notification.createdAt.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    notifications = result.scalars().all()

    total_r = await db.execute(select(func.count(Notification.id)).where(*filters))
    total = total_r.scalar()

    unread_r = await db.execute(
        select(func.count(Notification.id)).where(Notification.userId == user.id, Notification.read == False)
    )
    unread_count = unread_r.scalar()

    return {
        "notifications": [
            {
                "id": n.id,
                "type": n.type.value if hasattr(n.type, "value") else n.type,
                "title": n.title,
                "message": n.message,
                "read": n.read,
                "data": n.data,
                "createdAt": n.createdAt.isoformat(),
            }
            for n in notifications
        ],
        "total": total,
        "unreadCount": unread_count,
    }


@router.put("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Notification).where(Notification.id == notification_id))
    notification = result.scalar_one_or_none()
    if notification:
        notification.read = True
        await db.commit()
        await db.refresh(notification)
    return {
        "id": notification.id,
        "type": notification.type.value if hasattr(notification.type, "value") else notification.type,
        "title": notification.title,
        "message": notification.message,
        "read": notification.read,
        "data": notification.data,
        "createdAt": notification.createdAt.isoformat(),
    }


@router.put("/read-all")
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(Notification.userId == user.id, Notification.read == False)
        .values(read=True)
    )
    await db.commit()
    return {"message": "All notifications marked as read"}
