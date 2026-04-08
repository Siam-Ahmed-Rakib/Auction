"""
Webhook notification service for sending real-time notifications to users.
Supports both internal socket notifications and external webhook URLs.
"""

import asyncio
import hashlib
import hmac
import json
import logging
from datetime import datetime
from typing import Any

import httpx

from app.config.settings import settings

logger = logging.getLogger(__name__)

# In-memory store for SSE clients (user_id -> list of queues)
sse_clients: dict[str, list[asyncio.Queue]] = {}


def get_webhook_signature(payload: str, secret: str) -> str:
    """Generate HMAC-SHA256 signature for webhook payload."""
    return hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()


async def send_webhook(url: str, payload: dict, secret: str | None = None) -> bool:
    """Send webhook notification to an external URL."""
    try:
        headers = {"Content-Type": "application/json"}
        payload_str = json.dumps(payload)
        
        if secret:
            signature = get_webhook_signature(payload_str, secret)
            headers["X-Webhook-Signature"] = signature
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, content=payload_str, headers=headers)
            if response.status_code >= 200 and response.status_code < 300:
                logger.info(f"Webhook sent successfully to {url}")
                return True
            else:
                logger.warning(f"Webhook failed to {url}: {response.status_code}")
                return False
    except Exception as e:
        logger.error(f"Webhook error to {url}: {e}")
        return False


async def broadcast_to_user(user_id: str, event_type: str, data: dict) -> int:
    """
    Broadcast notification to all SSE clients subscribed to a user.
    Returns the number of clients notified.
    """
    if user_id not in sse_clients:
        return 0
    
    notification = {
        "event": event_type,
        "data": data,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    notified = 0
    dead_queues = []
    
    for queue in sse_clients[user_id]:
        try:
            queue.put_nowait(notification)
            notified += 1
        except asyncio.QueueFull:
            dead_queues.append(queue)
    
    # Clean up dead queues
    for queue in dead_queues:
        sse_clients[user_id].remove(queue)
    
    if not sse_clients[user_id]:
        del sse_clients[user_id]
    
    logger.info(f"Broadcast to user {user_id}: {notified} clients notified")
    return notified


def register_sse_client(user_id: str, queue: asyncio.Queue) -> None:
    """Register an SSE client for a user."""
    if user_id not in sse_clients:
        sse_clients[user_id] = []
    sse_clients[user_id].append(queue)
    logger.info(f"SSE client registered for user {user_id}, total: {len(sse_clients[user_id])}")


def unregister_sse_client(user_id: str, queue: asyncio.Queue) -> None:
    """Unregister an SSE client for a user."""
    if user_id in sse_clients:
        try:
            sse_clients[user_id].remove(queue)
            if not sse_clients[user_id]:
                del sse_clients[user_id]
            logger.info(f"SSE client unregistered for user {user_id}")
        except ValueError:
            pass


async def notify_auction_ended(
    auction_id: str,
    auction_title: str,
    seller_id: str,
    seller_username: str,
    winner_id: str | None,
    winner_username: str | None,
    final_price: float | None,
    status: str,
) -> dict:
    """
    Send auction ended notifications to seller and winner via SSE/webhooks.
    Returns a summary of notifications sent.
    """
    results = {"seller_notified": False, "winner_notified": False, "sse_clients": 0}
    
    # Notify seller
    seller_notification = {
        "type": "AUCTION_ENDED",
        "auctionId": auction_id,
        "title": auction_title,
        "status": status,
        "finalPrice": final_price,
        "winnerUsername": winner_username,
        "message": f'Your auction "{auction_title}" has ended.' + (
            f' Sold to {winner_username} for ${final_price:.2f}.' if winner_id else ' No bids received.'
        )
    }
    
    seller_sse_count = await broadcast_to_user(seller_id, "auction-ended", seller_notification)
    results["sse_clients"] += seller_sse_count
    results["seller_notified"] = seller_sse_count > 0
    
    # Notify winner
    if winner_id:
        winner_notification = {
            "type": "AUCTION_WON",
            "auctionId": auction_id,
            "title": auction_title,
            "status": status,
            "finalPrice": final_price,
            "sellerUsername": seller_username,
            "message": f'Congratulations! You won "{auction_title}" for ${final_price:.2f}. Please complete payment.'
        }
        
        winner_sse_count = await broadcast_to_user(winner_id, "auction-won", winner_notification)
        results["sse_clients"] += winner_sse_count
        results["winner_notified"] = winner_sse_count > 0
    
    return results


async def notify_outbid(
    auction_id: str,
    auction_title: str,
    bidder_id: str,
    new_price: float,
) -> int:
    """Send outbid notification to a bidder via SSE."""
    notification = {
        "type": "OUTBID",
        "auctionId": auction_id,
        "title": auction_title,
        "currentPrice": new_price,
        "message": f'You\'ve been outbid on "{auction_title}". Current price: ${new_price:.2f}'
    }
    
    return await broadcast_to_user(bidder_id, "outbid", notification)


async def notify_bid_placed(
    auction_id: str,
    auction_title: str,
    bidder_id: str,
    amount: float,
) -> int:
    """Send bid placed confirmation via SSE."""
    notification = {
        "type": "BID_PLACED",
        "auctionId": auction_id,
        "title": auction_title,
        "amount": amount,
        "message": f'Your bid of ${amount:.2f} on "{auction_title}" was placed successfully.'
    }
    
    return await broadcast_to_user(bidder_id, "bid-placed", notification)
