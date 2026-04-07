from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Bid, User
from app.services.bidding_engine import process_bid

router = APIRouter(prefix="/api/bids", tags=["bids"])


class PlaceBidRequest(BaseModel):
    amount: float
    maxBid: float | None = None


@router.post("/{auction_id}", status_code=201)
async def place_bid(
    auction_id: str,
    body: PlaceBidRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.amount < 0.01:
        raise HTTPException(status_code=400, detail="Amount must be at least 0.01")

    max_bid = body.maxBid if body.maxBid else body.amount
    try:
        result = await process_bid(db, auction_id, user.id, body.amount, max_bid)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/auction/{auction_id}")
async def get_auction_bids(auction_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Bid)
        .where(Bid.auctionId == auction_id)
        .options(selectinload(Bid.bidder))
        .order_by(Bid.createdAt.desc())
    )
    bids = result.scalars().all()

    return [
        {
            "id": b.id,
            "amount": b.amount,
            "isProxy": b.isProxy,
            "isWinning": b.isWinning,
            "createdAt": b.createdAt.isoformat(),
            "auctionId": b.auctionId,
            "bidderId": b.bidderId,
            "bidder": {"id": b.bidder.id, "username": b.bidder.username, "rating": b.bidder.rating} if b.bidder else None,
        }
        for b in bids
    ]


@router.get("/user/my-bids")
async def get_my_bids(
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get distinct auction IDs user has bid on
    bid_result = await db.execute(
        select(Bid)
        .where(Bid.bidderId == user.id)
        .options(
            selectinload(Bid.auction).selectinload("seller"),
            selectinload(Bid.auction).selectinload("bids"),
        )
        .order_by(Bid.createdAt.desc())
    )
    all_bids = bid_result.scalars().all()

    # Deduplicate by auction
    seen_auctions = set()
    unique_bids = []
    for b in all_bids:
        if b.auctionId not in seen_auctions:
            seen_auctions.add(b.auctionId)
            unique_bids.append(b)

    results = []
    for bid in unique_bids:
        auction = bid.auction
        if not auction:
            continue

        # Get highest bid for this auction
        highest_r = await db.execute(
            select(Bid).where(Bid.auctionId == auction.id).order_by(Bid.amount.desc()).limit(1)
        )
        highest_bid = highest_r.scalar_one_or_none()

        is_winning = highest_bid and highest_bid.bidderId == user.id

        # Get user's max bid for this auction
        user_max_r = await db.execute(
            select(func.max(Bid.maxBid), func.max(Bid.amount))
            .where(Bid.auctionId == auction.id, Bid.bidderId == user.id)
        )
        user_max = user_max_r.one_or_none()

        bid_count_r = await db.execute(
            select(func.count(Bid.id)).where(Bid.auctionId == auction.id)
        )
        bid_count = bid_count_r.scalar()

        auction_status = auction.status.value if hasattr(auction.status, "value") else auction.status
        if auction_status in ("SOLD", "ENDED"):
            bid_status = "won" if is_winning else "lost"
        elif auction_status == "ACTIVE":
            bid_status = "winning" if is_winning else "outbid"
        else:
            bid_status = "active"

        # Load seller
        seller_data = None
        if auction.seller:
            seller_data = {
                "id": auction.seller.id,
                "username": auction.seller.username,
                "rating": auction.seller.rating,
                "positiveRate": auction.seller.positiveRate,
            }

        results.append({
            "auction": {
                "id": auction.id,
                "title": auction.title,
                "images": auction.images or [],
                "category": auction.category,
                "condition": auction.condition,
                "currentPrice": auction.currentPrice,
                "endTime": auction.endTime.isoformat() if auction.endTime else None,
                "status": auction_status,
                "sellerId": auction.sellerId,
                "seller": seller_data,
                "_count": {"bids": bid_count},
            },
            "userMaxBid": user_max[0] if user_max else None,
            "userCurrentBid": user_max[1] if user_max else None,
            "highestBid": highest_bid.amount if highest_bid else None,
            "isWinning": is_winning,
            "bidStatus": bid_status,
            "bidCount": bid_count,
        })

    # Filter by status
    if status == "active":
        results = [r for r in results if r["auction"]["status"] == "ACTIVE"]
    elif status == "won":
        results = [r for r in results if r["bidStatus"] == "won"]
    elif status == "lost":
        results = [r for r in results if r["bidStatus"] == "lost"]

    return results
