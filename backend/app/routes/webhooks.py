"""
Server-Sent Events (SSE) endpoint for live notifications.
This provides a webhook-style live notification system where clients
can receive real-time updates without maintaining a WebSocket connection.
"""

import asyncio
import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Request, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.middleware.auth import get_current_user, verify_token
from app.models.models import User
from app.services.webhook_service import register_sse_client, unregister_sse_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


async def notification_stream(user_id: str, queue: asyncio.Queue):
    """Generate SSE events from the notification queue."""
    try:
        # Send initial connection event
        yield f"event: connected\ndata: {json.dumps({'userId': user_id, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        while True:
            try:
                # Wait for notification with timeout (for keepalive)
                notification = await asyncio.wait_for(queue.get(), timeout=30.0)
                event_type = notification.get("event", "notification")
                data = json.dumps(notification.get("data", notification))
                yield f"event: {event_type}\ndata: {data}\n\n"
            except asyncio.TimeoutError:
                # Send keepalive ping
                yield f"event: ping\ndata: {json.dumps({'timestamp': datetime.utcnow().isoformat()})}\n\n"
    except asyncio.CancelledError:
        logger.info(f"SSE stream cancelled for user {user_id}")
        raise
    except Exception as e:
        logger.error(f"SSE stream error for user {user_id}: {e}")
        raise


@router.get("/live")
async def live_notifications(
    request: Request,
    token: str | None = Query(None, description="JWT token for authentication"),
    db: AsyncSession = Depends(get_db),
):
    """
    Server-Sent Events endpoint for live notifications.
    
    Accepts authentication via query parameter since EventSource doesn't support headers.
    
    Usage:
    ```javascript
    const token = 'your-jwt-token';
    const eventSource = new EventSource(`/api/webhooks/live?token=${token}`);
    
    eventSource.addEventListener('auction-ended', (e) => {
        const data = JSON.parse(e.data);
        console.log('Auction ended:', data);
    });
    
    eventSource.addEventListener('auction-won', (e) => {
        const data = JSON.parse(e.data);
        console.log('You won!', data);
    });
    
    eventSource.addEventListener('outbid', (e) => {
        const data = JSON.parse(e.data);
        console.log('Outbid:', data);
    });
    
    eventSource.addEventListener('notification', (e) => {
        const data = JSON.parse(e.data);
        console.log('Notification:', data);
    });
    ```
    """
    # Authenticate via token query param or header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
    
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Verify token and get user
    try:
        payload = verify_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Verify user exists
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    register_sse_client(user.id, queue)
    
    async def event_generator():
        try:
            async for event in notification_stream(user.id, queue):
                # Check if client disconnected
                if await request.is_disconnected():
                    break
                yield event
        finally:
            unregister_sse_client(user.id, queue)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.get("/status")
async def webhook_status(
    user: User = Depends(get_current_user),
):
    """Check webhook/SSE connection status for current user."""
    from app.services.webhook_service import sse_clients
    
    active_connections = len(sse_clients.get(user.id, []))
    
    return {
        "userId": user.id,
        "activeConnections": active_connections,
        "sseEndpoint": "/api/webhooks/live",
        "supportedEvents": [
            "connected",
            "ping",
            "notification",
            "auction-ended",
            "auction-won",
            "outbid",
            "bid-placed",
            "bid-update"
        ]
    }
