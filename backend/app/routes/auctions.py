from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config.database import get_db
from app.middleware.auth import get_current_user, get_optional_user
from app.models.models import Auction, AuctionStatus, Bid, User, Watchlist

router = APIRouter(prefix="/api/auctions", tags=["auctions"])


def _utc_iso(dt):
    """Serialize a naive-UTC datetime with 'Z' suffix so JS interprets it as UTC."""
    return dt.isoformat() + "Z" if dt else None


def auction_to_dict(auction, bid_count=None, watchlist_count=None, is_watching=False):
    d = {
        "id": auction.id,
        "title": auction.title,
        "description": auction.description,
        "images": auction.images or [],
        "category": auction.category,
        "condition": auction.condition,
        "startPrice": auction.startPrice,
        "reservePrice": auction.reservePrice,
        "currentPrice": auction.currentPrice,
        "bidIncrement": auction.bidIncrement,
        "startTime": _utc_iso(auction.startTime),
        "endTime": _utc_iso(auction.endTime),
        "status": auction.status.value if hasattr(auction.status, "value") else auction.status,
        "shippingCost": auction.shippingCost,
        "shippingMethod": auction.shippingMethod,
        "location": auction.location,
        "returnPolicy": auction.returnPolicy,
        "views": auction.views,
        "createdAt": _utc_iso(auction.createdAt),
        "updatedAt": _utc_iso(auction.updatedAt),
        "sellerId": auction.sellerId,
    }
    if hasattr(auction, "seller") and auction.seller:
        d["seller"] = {
            "id": auction.seller.id,
            "username": auction.seller.username,
            "name": auction.seller.name,
            "rating": auction.seller.rating,
            "positiveRate": auction.seller.positiveRate,
            "totalRatings": auction.seller.totalRatings,
            "avatarUrl": auction.seller.avatarUrl,
            "createdAt": _utc_iso(auction.seller.createdAt),
        }
    if bid_count is not None:
        d["_count"] = {"bids": bid_count, "watchlist": watchlist_count or 0}
    if is_watching:
        d["isWatching"] = is_watching
    return d


@router.get("/user/selling")
async def get_user_selling(
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Auction).where(Auction.sellerId == user.id).options(
        selectinload(Auction.bids).selectinload(Bid.bidder)
    ).order_by(Auction.createdAt.desc())

    if status:
        query = query.where(Auction.status == status)

    result = await db.execute(query)
    auctions = result.scalars().all()

    items = []
    for a in auctions:
        bid_count = len(a.bids)
        unique_bidders = {}
        for b in a.bids:
            if b.bidderId not in unique_bidders:
                unique_bidders[b.bidderId] = {
                    "id": b.bidder.id if b.bidder else b.bidderId,
                    "username": b.bidder.username if b.bidder else "Unknown",
                    "name": b.bidder.name if b.bidder else "Unknown",
                    "avatarUrl": b.bidder.avatarUrl if b.bidder else None,
                }
        sorted_bids = sorted(a.bids, key=lambda b: b.createdAt, reverse=True)
        d = auction_to_dict(a, bid_count=bid_count)
        d["uniqueBidderCount"] = len(unique_bidders)
        d["bidders"] = list(unique_bidders.values())
        d["bids"] = [
            {
                "id": b.id,
                "amount": b.amount,
                "isWinning": b.isWinning,
                "createdAt": _utc_iso(b.createdAt),
                "bidderId": b.bidderId,
                "bidder": {
                    "id": b.bidder.id,
                    "username": b.bidder.username,
                    "name": b.bidder.name,
                    "avatarUrl": b.bidder.avatarUrl,
                } if b.bidder else None,
            }
            for b in sorted_bids
        ]
        items.append(d)

    return items


@router.get("")
async def list_auctions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: str | None = None,
    condition: str | None = None,
    minPrice: float | None = None,
    maxPrice: float | None = None,
    sort: str = "endTime",
    order: str = "asc",
    status: str = "ACTIVE",
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Auction).options(selectinload(Auction.seller))
    count_query = select(func.count(Auction.id))

    filters = [Auction.status == status]
    if category:
        filters.append(Auction.category == category)
    if condition:
        filters.append(Auction.condition == condition)
    if minPrice is not None:
        filters.append(Auction.currentPrice >= minPrice)
    if maxPrice is not None:
        filters.append(Auction.currentPrice <= maxPrice)

    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

    if sort == "price":
        order_col = Auction.currentPrice.asc() if order == "asc" else Auction.currentPrice.desc()
    elif sort == "newest":
        order_col = Auction.createdAt.desc()
    else:
        order_col = Auction.endTime.asc() if order == "asc" else Auction.endTime.desc()

    query = query.order_by(order_col).offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    auctions = result.scalars().all()

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    items = []
    for a in auctions:
        bid_count_r = await db.execute(select(func.count(Bid.id)).where(Bid.auctionId == a.id))
        wl_count_r = await db.execute(select(func.count(Watchlist.id)).where(Watchlist.auctionId == a.id))
        items.append(auction_to_dict(a, bid_count=bid_count_r.scalar(), watchlist_count=wl_count_r.scalar()))

    return {
        "auctions": items,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": -(-total // limit),
        },
    }


@router.get("/{auction_id}")
async def get_auction(
    auction_id: str,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Auction)
        .where(Auction.id == auction_id)
        .options(
            selectinload(Auction.seller),
            selectinload(Auction.bids).selectinload(Bid.bidder),
        )
    )
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    # Increment views
    auction.views += 1
    await db.commit()

    bid_count = len(auction.bids)
    wl_count_r = await db.execute(select(func.count(Watchlist.id)).where(Watchlist.auctionId == auction.id))
    wl_count = wl_count_r.scalar()

    is_watching = False
    if user:
        watch_r = await db.execute(
            select(Watchlist).where(Watchlist.userId == user.id, Watchlist.auctionId == auction.id)
        )
        is_watching = watch_r.scalar_one_or_none() is not None

    d = auction_to_dict(auction, bid_count=bid_count, watchlist_count=wl_count, is_watching=is_watching)

    # Add bids (last 20)
    sorted_bids = sorted(auction.bids, key=lambda b: b.createdAt, reverse=True)[:20]
    d["bids"] = [
        {
            "id": b.id,
            "amount": b.amount,
            "isProxy": b.isProxy,
            "isWinning": b.isWinning,
            "createdAt": _utc_iso(b.createdAt),
            "auctionId": b.auctionId,
            "bidderId": b.bidderId,
            "bidder": {"id": b.bidder.id, "username": b.bidder.username} if b.bidder else None,
        }
        for b in sorted_bids
    ]

    return d


class CreateAuctionRequest(BaseModel):
    title: str
    description: str
    images: list[str] = []
    category: str
    condition: str = "New"
    startPrice: float
    reservePrice: float | None = None
    duration: int | None = None  # legacy: days
    durationMinutes: int | None = None  # preferred: minutes (min 2)
    bidIncrement: float = 1.0
    shippingCost: float = 0.0
    shippingMethod: str | None = None
    location: str | None = None
    returnPolicy: str | None = None
    startImmediately: bool = True
    startTime: str | None = None


@router.post("", status_code=201)
async def create_auction(
    body: CreateAuctionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(body.title) < 3:
        raise HTTPException(status_code=400, detail="Title must be at least 3 characters")
    if len(body.description) < 10:
        raise HTTPException(status_code=400, detail="Description must be at least 10 characters")
    if body.startPrice < 0.01:
        raise HTTPException(status_code=400, detail="Start price must be at least 0.01")

    # Determine duration
    if body.durationMinutes is not None:
        if body.durationMinutes < 2:
            raise HTTPException(status_code=400, detail="Auction duration must be at least 2 minutes")
        duration_delta = timedelta(minutes=body.durationMinutes)
    elif body.duration is not None:
        duration_delta = timedelta(days=body.duration)
    else:
        raise HTTPException(status_code=400, detail="Duration is required")

    start_time = datetime.utcnow() if body.startImmediately else datetime.fromisoformat(body.startTime)
    end_time = start_time + duration_delta

    auction = Auction(
        title=body.title,
        description=body.description,
        images=body.images,
        category=body.category,
        condition=body.condition,
        startPrice=body.startPrice,
        reservePrice=body.reservePrice,
        currentPrice=body.startPrice,
        bidIncrement=body.bidIncrement,
        startTime=start_time,
        endTime=end_time,
        status=AuctionStatus.ACTIVE if body.startImmediately else AuctionStatus.DRAFT,
        shippingCost=body.shippingCost,
        shippingMethod=body.shippingMethod,
        location=body.location,
        returnPolicy=body.returnPolicy,
        sellerId=user.id,
    )
    db.add(auction)
    await db.commit()
    await db.refresh(auction)

    # Load seller
    await db.refresh(auction, ["seller"])
    return auction_to_dict(auction)


class UpdateAuctionRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    images: list[str] | None = None
    category: str | None = None
    condition: str | None = None
    startPrice: float | None = None
    reservePrice: float | None = None
    bidIncrement: float | None = None
    shippingCost: float | None = None
    shippingMethod: str | None = None
    location: str | None = None
    returnPolicy: str | None = None


@router.put("/{auction_id}")
async def update_auction(
    auction_id: str,
    body: UpdateAuctionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Auction).where(Auction.id == auction_id).options(selectinload(Auction.bids)))
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.sellerId != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if len(auction.bids) > 0:
        raise HTTPException(status_code=400, detail="Cannot edit auction with bids")

    update_data = body.model_dump(exclude_unset=True)
    if "startPrice" in update_data and update_data["startPrice"] is not None:
        update_data["currentPrice"] = update_data["startPrice"]

    for key, value in update_data.items():
        if value is not None or key in ("reservePrice", "shippingMethod", "location", "returnPolicy"):
            setattr(auction, key, value)

    auction.updatedAt = datetime.utcnow()
    await db.commit()
    await db.refresh(auction, ["seller"])
    return auction_to_dict(auction)


@router.post("/{auction_id}/cancel")
async def cancel_auction(
    auction_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Auction).where(Auction.id == auction_id).options(selectinload(Auction.bids)))
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.sellerId != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if len(auction.bids) > 0:
        raise HTTPException(status_code=400, detail="Cannot cancel auction with bids")

    auction.status = AuctionStatus.CANCELLED
    auction.updatedAt = datetime.utcnow()
    await db.commit()
    await db.refresh(auction)
    return auction_to_dict(auction)


@router.post("/{auction_id}/check-ended")
async def check_auction_ended(
    auction_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Webhook-style endpoint: called by frontend when countdown reaches zero.
    Processes auction end immediately instead of waiting for the background scheduler."""
    import random
    import string
    from app.models.models import Order
    from app.services.notification_service import create_notification
    from app.services.webhook_service import notify_auction_ended

    # Use FOR UPDATE to prevent race condition with the background scheduler
    result = await db.execute(
        select(Auction)
        .where(Auction.id == auction_id)
        .options(selectinload(Auction.bids).selectinload(Bid.bidder), selectinload(Auction.seller))
        .with_for_update()
    )
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    # Only process if still ACTIVE
    status_val = auction.status.value if hasattr(auction.status, "value") else auction.status
    if status_val != "ACTIVE":
        return {"status": status_val, "message": "Auction already processed"}

    # Only process if end time has actually passed
    if datetime.utcnow() < auction.endTime:
        return {"status": "ACTIVE", "message": "Auction has not ended yet"}

    seller_username = auction.seller.username if auction.seller else "Unknown"

    sorted_bids = sorted(auction.bids, key=lambda b: b.amount, reverse=True)
    winning_bid = sorted_bids[0] if sorted_bids else None

    if winning_bid:
        meets_reserve = not auction.reservePrice or winning_bid.amount >= auction.reservePrice

        if meets_reserve:
            suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
            order_number = f"EB-{datetime.utcnow().year}-{suffix}"

            auction.status = AuctionStatus.SOLD
            order = Order(
                orderNumber=order_number,
                totalAmount=winning_bid.amount + auction.shippingCost,
                itemAmount=winning_bid.amount,
                shippingAmount=auction.shippingCost,
                auctionId=auction.id,
                buyerId=winning_bid.bidderId,
                sellerId=auction.sellerId,
            )
            db.add(order)
            await db.commit()

            # Notify the winner
            await create_notification(
                db, winning_bid.bidderId, "AUCTION_WON",
                "Congratulations! You won!",
                f'You won "{auction.title}" for ${winning_bid.amount:.2f}. Please complete payment.',
                {"auctionId": auction.id},
            )
            # Notify the seller
            await create_notification(
                db, auction.sellerId, "AUCTION_ENDED",
                "Your auction has sold!",
                f'"{auction.title}" sold to {winning_bid.bidder.username if winning_bid.bidder else "a buyer"} for ${winning_bid.amount:.2f}.',
                {"auctionId": auction.id},
            )

            winner_username = winning_bid.bidder.username if winning_bid.bidder else "a buyer"

            # Collect all losing bidder IDs
            losing_bidder_ids = list(set(
                bid.bidderId for bid in sorted_bids
                if bid.bidderId != winning_bid.bidderId and bid.bidderId != auction.sellerId
            ))

            # Notify all other bidders that they lost
            notified = {winning_bid.bidderId, auction.sellerId}
            for bid in sorted_bids:
                if bid.bidderId not in notified:
                    notified.add(bid.bidderId)
                    try:
                        await create_notification(
                            db, bid.bidderId, "AUCTION_ENDED",
                            "Auction ended",
                            f'"{auction.title}" has ended. Unfortunately, you did not win.',
                            {"auctionId": auction.id},
                        )
                    except Exception:
                        pass

            # Send live SSE/webhook notifications for immediate delivery
            try:
                await notify_auction_ended(
                    auction_id=auction.id,
                    auction_title=auction.title,
                    seller_id=auction.sellerId,
                    seller_username=seller_username,
                    winner_id=winning_bid.bidderId,
                    winner_username=winner_username,
                    final_price=winning_bid.amount,
                    status=auction.status.value if hasattr(auction.status, "value") else auction.status,
                    losing_bidder_ids=losing_bidder_ids,
                )
            except Exception:
                pass
        else:
            auction.status = AuctionStatus.RESERVE_NOT_MET
            await db.commit()

            await create_notification(
                db, auction.sellerId, "AUCTION_ENDED",
                "Reserve price not met",
                f'"{auction.title}" ended without meeting the reserve price.',
                {"auctionId": auction.id},
            )

            try:
                await notify_auction_ended(
                    auction_id=auction.id,
                    auction_title=auction.title,
                    seller_id=auction.sellerId,
                    seller_username=seller_username,
                    winner_id=None,
                    winner_username=None,
                    final_price=None,
                    status=auction.status.value if hasattr(auction.status, "value") else auction.status,
                )
            except Exception:
                pass
    else:
        auction.status = AuctionStatus.ENDED
        await db.commit()

        await create_notification(
            db, auction.sellerId, "AUCTION_ENDED",
            "Auction ended",
            f'"{auction.title}" ended with no bids.',
            {"auctionId": auction.id},
        )

        try:
            await notify_auction_ended(
                auction_id=auction.id,
                auction_title=auction.title,
                seller_id=auction.sellerId,
                seller_username=seller_username,
                winner_id=None,
                winner_username=None,
                final_price=None,
                status=auction.status.value if hasattr(auction.status, "value") else auction.status,
            )
        except Exception:
            pass

    # Emit socket event for real-time UI updates
    from app.config.socket import sio
    auction_ended_payload = {
        "auctionId": auction.id,
        "status": auction.status.value if hasattr(auction.status, "value") else auction.status,
        "winnerId": winning_bid.bidderId if winning_bid else None,
        "winnerUsername": winning_bid.bidder.username if winning_bid and winning_bid.bidder else None,
        "finalPrice": winning_bid.amount if winning_bid else None,
    }
    try:
        # Emit to auction room (for users viewing the page)
        await sio.emit("auction-ended", auction_ended_payload, room=f"auction:{auction.id}")
        # Also emit to winner's and seller's user rooms (they may not be on the auction page)
        if winning_bid:
            await sio.emit("auction-won", auction_ended_payload, room=f"user:{winning_bid.bidderId}")
        await sio.emit("auction-ended", auction_ended_payload, room=f"user:{auction.sellerId}")
    except Exception:
        pass

    return {
        "status": auction.status.value if hasattr(auction.status, "value") else auction.status,
        "winnerId": winning_bid.bidderId if winning_bid else None,
        "finalPrice": winning_bid.amount if winning_bid else None,
        "message": "Auction ended and notifications sent",
    }


@router.post("/{auction_id}/watch")
async def toggle_watchlist(
    auction_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Watchlist).where(Watchlist.userId == user.id, Watchlist.auctionId == auction_id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        await db.commit()
        return {"watching": False}
    else:
        wl = Watchlist(userId=user.id, auctionId=auction_id)
        db.add(wl)
        await db.commit()
        return {"watching": True}
