from sqlalchemy.ext.asyncio import AsyncSession

from app.config.socket import sio
from app.models.models import Notification


async def create_notification(
    db: AsyncSession,
    user_id: str,
    type: str,
    title: str,
    message: str,
    data: dict | None = None,
):
    notification = Notification(
        userId=user_id,
        type=type,
        title=title,
        message=message,
        data=data or {},
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)

    try:
        await sio.emit(
            "notification",
            {
                "id": notification.id,
                "type": notification.type.value if hasattr(notification.type, "value") else notification.type,
                "title": notification.title,
                "message": notification.message,
                "read": notification.read,
                "data": notification.data,
                "createdAt": notification.createdAt.isoformat(),
            },
            room=f"user:{user_id}",
        )
    except Exception:
        pass

    return notification
