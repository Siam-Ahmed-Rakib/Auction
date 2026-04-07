from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Auction, AuctionStatus, Bid, Order, OrderStatus, User, Watchlist

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me/watchlist")
async def get_watchlist(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Watchlist)
        .where(Watchlist.userId == user.id)
        .options(
            selectinload(Watchlist.auction).selectinload(Auction.seller),
            selectinload(Watchlist.auction).selectinload(Auction.bids),
        )
        .order_by(Watchlist.createdAt.desc())
    )
    items = result.scalars().all()

    auctions = []
    for w in items:
        a = w.auction
        if not a:
            continue
        bid_count = len(a.bids) if a.bids else 0
        auctions.append({
            "id": a.id,
            "title": a.title,
            "images": a.images or [],
            "category": a.category,
            "condition": a.condition,
            "currentPrice": a.currentPrice,
            "endTime": a.endTime.isoformat() if a.endTime else None,
            "status": a.status.value if hasattr(a.status, "value") else a.status,
            "sellerId": a.sellerId,
            "seller": {"id": a.seller.id, "username": a.seller.username} if a.seller else None,
            "_count": {"bids": bid_count},
        })
    return auctions


@router.get("/me/stats")
async def get_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    active_bids_r = await db.execute(
        select(func.count(Bid.id)).where(
            Bid.bidderId == user.id,
            Bid.isWinning == True,
        ).where(
            Bid.auctionId.in_(select(Auction.id).where(Auction.status == AuctionStatus.ACTIVE))
        )
    )
    active_bids = active_bids_r.scalar()

    won_r = await db.execute(select(func.count(Order.id)).where(Order.buyerId == user.id))
    won_items = won_r.scalar()

    lost_r = await db.execute(
        select(func.count(Bid.id)).where(
            Bid.bidderId == user.id,
            Bid.isWinning == False,
        ).where(
            Bid.auctionId.in_(
                select(Auction.id).where(Auction.status.in_([AuctionStatus.ENDED, AuctionStatus.SOLD, AuctionStatus.RESERVE_NOT_MET]))
            )
        )
    )
    lost_bids = lost_r.scalar()

    active_listings_r = await db.execute(
        select(func.count(Auction.id)).where(Auction.sellerId == user.id, Auction.status == AuctionStatus.ACTIVE)
    )
    active_listings = active_listings_r.scalar()

    sold_r = await db.execute(
        select(func.count(Auction.id)).where(Auction.sellerId == user.id, Auction.status == AuctionStatus.SOLD)
    )
    sold_items = sold_r.scalar()

    spent_r = await db.execute(
        select(func.coalesce(func.sum(Order.totalAmount), 0))
        .where(Order.buyerId == user.id, Order.status != OrderStatus.CANCELLED)
    )
    total_spent = spent_r.scalar()

    earned_r = await db.execute(
        select(func.coalesce(func.sum(Order.totalAmount), 0))
        .where(Order.sellerId == user.id, Order.status != OrderStatus.CANCELLED)
    )
    total_earned = earned_r.scalar()

    return {
        "activeBids": active_bids,
        "wonItems": won_items,
        "lostBids": lost_bids,
        "activeListings": active_listings,
        "soldItems": sold_items,
        "totalSpent": float(total_spent),
        "totalEarned": float(total_earned),
    }


@router.get("/{user_id}")
async def get_user_profile(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    auction_count_r = await db.execute(
        select(func.count(Auction.id)).where(Auction.sellerId == user.id)
    )
    auction_count = auction_count_r.scalar()

    return {
        "id": user.id,
        "username": user.username,
        "name": user.name,
        "avatarUrl": user.avatarUrl,
        "rating": user.rating,
        "totalRatings": user.totalRatings,
        "positiveRate": user.positiveRate,
        "createdAt": user.createdAt.isoformat() if user.createdAt else None,
        "_count": {"auctions": auction_count},
    }
