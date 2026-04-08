import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.socket import sio
from app.models.models import Notification
from app.services.webhook_service import broadcast_to_user

logger = logging.getLogger(__name__)


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

    notification_payload = {
        "id": notification.id,
        "type": notification.type.value if hasattr(notification.type, "value") else notification.type,
        "title": notification.title,
        "message": notification.message,
        "read": notification.read,
        "data": notification.data,
        "createdAt": notification.createdAt.isoformat(),
    }

    # Emit via Socket.IO
    try:
        await sio.emit(
            "notification",
            notification_payload,
            room=f"user:{user_id}",
        )
    except Exception as e:
        logger.error("Failed to emit notification socket event to user %s: %s", user_id, e)

    # Also broadcast via SSE/webhook system for live notifications
    try:
        await broadcast_to_user(user_id, "notification", notification_payload)
    except Exception as e:
        logger.error("Failed to broadcast notification via SSE to user %s: %s", user_id, e)

    return notification
