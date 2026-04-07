import asyncio
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config.database import async_session
from app.config.socket import sio
from app.models.models import Auction, Bid
from app.services.notification_service import create_notification


async def _post_bid_side_effects(
    auction_id: str,
    auction_title: str,
    bidder_id: str,
    new_current_price: float,
    previous_bidder_id: str | None,
):
    """Run notifications and socket emissions in the background so they don't block the bid response."""
    try:
        async with async_session() as db:
            # Notify previous highest bidder they were outbid
            if previous_bidder_id and previous_bidder_id != bidder_id:
                try:
                    await create_notification(
                        db, previous_bidder_id, "OUTBID", "You've been outbid!",
                        f'Another bidder has outbid you on "{auction_title}". Current price: ${new_current_price:.2f}',
                        {"auctionId": auction_id},
                    )
                except Exception:
                    pass
                try:
                    await sio.emit("outbid", {
                        "auctionId": auction_id, "title": auction_title, "currentPrice": new_current_price,
                    }, room=f"user:{previous_bidder_id}")
                except Exception:
                    pass

            # Notify bidder
            try:
                await create_notification(
                    db, bidder_id, "BID_PLACED", "Bid placed!",
                    f'Your bid of ${new_current_price:.2f} on "{auction_title}" was placed successfully.',
                    {"auctionId": auction_id},
                )
            except Exception:
                pass

            # Emit bid update to auction room
            bid_count_r = await db.execute(select(func.count(Bid.id)).where(Bid.auctionId == auction_id))
            bid_count = bid_count_r.scalar()

            try:
                await sio.emit("bid-update", {
                    "auctionId": auction_id,
                    "currentPrice": new_current_price,
                    "bidCount": bid_count,
                    "highestBidderId": bidder_id,
                }, room=f"auction:{auction_id}")
            except Exception:
                pass
    except Exception:
        pass


async def _post_outbid_side_effects(
    auction_id: str,
    auction_title: str,
    bidder_id: str,
    new_current_price: float,
    winning_bidder_id: str,
):
    """Background side effects for outbid scenario."""
    try:
        async with async_session() as db:
            try:
                await create_notification(
                    db, bidder_id, "OUTBID", "You've been outbid!",
                    f'Someone has a higher maximum bid on "{auction_title}". Current price: ${new_current_price:.2f}',
                    {"auctionId": auction_id},
                )
            except Exception:
                pass

            bid_count_r = await db.execute(select(func.count(Bid.id)).where(Bid.auctionId == auction_id))
            bid_count = bid_count_r.scalar()

            try:
                await sio.emit("bid-update", {
                    "auctionId": auction_id,
                    "currentPrice": new_current_price,
                    "bidCount": bid_count,
                    "highestBidderId": winning_bidder_id,
                }, room=f"auction:{auction_id}")
                await sio.emit("outbid", {"auctionId": auction_id, "title": auction_title}, room=f"user:{bidder_id}")
            except Exception:
                pass
    except Exception:
        pass


async def process_bid(db: AsyncSession, auction_id: str, bidder_id: str, amount: float, max_bid: float) -> dict:
    result = await db.execute(
        select(Auction)
        .where(Auction.id == auction_id)
        .options(selectinload(Auction.bids).selectinload(Bid.bidder))
    )
    auction = result.scalar_one_or_none()

    if not auction:
        raise ValueError("Auction not found")
    if auction.status.value != "ACTIVE" if hasattr(auction.status, "value") else auction.status != "ACTIVE":
        raise ValueError("Auction has ended or is not active")
    if datetime.utcnow() > auction.endTime:
        raise ValueError("Auction has ended")
    if auction.sellerId == bidder_id:
        raise ValueError("Cannot bid on your own auction")

    sorted_bids = sorted(auction.bids, key=lambda b: b.amount, reverse=True)
    current_highest_bid = sorted_bids[0] if sorted_bids else None

    minimum_bid = (current_highest_bid.amount + auction.bidIncrement) if current_highest_bid else auction.startPrice

    if amount < minimum_bid:
        raise ValueError(f"Bid must be at least ${minimum_bid:.2f}")
    if max_bid < amount:
        raise ValueError("Maximum bid must be greater than or equal to bid amount")

    # Check proxy bidding scenario — new bid loses to existing max bid
    if current_highest_bid and current_highest_bid.bidderId != bidder_id:
        prev_max_result = await db.execute(
            select(Bid)
            .where(Bid.auctionId == auction_id, Bid.bidderId == current_highest_bid.bidderId)
            .order_by(Bid.maxBid.desc())
            .limit(1)
        )
        previous_max_bid = prev_max_result.scalar_one_or_none()

        if previous_max_bid and previous_max_bid.maxBid >= max_bid:
            new_current_price = min(previous_max_bid.maxBid, max_bid + auction.bidIncrement)

            # Create new bidder's bid (outbid)
            new_bid = Bid(
                amount=amount,
                maxBid=max_bid,
                isProxy=max_bid > amount,
                isWinning=False,
                auctionId=auction_id,
                bidderId=bidder_id,
            )
            db.add(new_bid)

            # Create proxy bid for previous bidder
            proxy_bid = Bid(
                amount=new_current_price,
                maxBid=previous_max_bid.maxBid,
                isProxy=True,
                isWinning=True,
                auctionId=auction_id,
                bidderId=current_highest_bid.bidderId,
            )
            db.add(proxy_bid)

            # Mark previous winning bid as not winning
            await db.execute(
                update(Bid).where(Bid.id == current_highest_bid.id).values(isWinning=False)
            )

            # Update auction price and commit
            auction.currentPrice = new_current_price
            await db.commit()
            await db.refresh(new_bid)

            # Fire-and-forget side effects (notifications, socket)
            asyncio.create_task(_post_outbid_side_effects(
                auction_id, auction.title, bidder_id,
                new_current_price, current_highest_bid.bidderId,
            ))

            return {
                "bid": {
                    "id": new_bid.id, "amount": new_bid.amount, "isProxy": new_bid.isProxy,
                    "isWinning": new_bid.isWinning, "createdAt": new_bid.createdAt.isoformat(),
                    "auctionId": new_bid.auctionId, "bidderId": new_bid.bidderId,
                },
                "isHighestBidder": False,
                "currentPrice": new_current_price,
                "message": "You were outbid by automatic bidding. Try a higher maximum bid.",
            }

    # New bid wins
    if current_highest_bid and current_highest_bid.bidderId != bidder_id:
        prev_max_result = await db.execute(
            select(Bid)
            .where(Bid.auctionId == auction_id, Bid.bidderId == current_highest_bid.bidderId)
            .order_by(Bid.maxBid.desc())
            .limit(1)
        )
        previous_max_bid = prev_max_result.scalar_one_or_none()
        if previous_max_bid:
            new_current_price = min(max_bid, previous_max_bid.maxBid + auction.bidIncrement)
        else:
            new_current_price = amount
    else:
        new_current_price = amount

    previous_bidder_id = current_highest_bid.bidderId if current_highest_bid and current_highest_bid.bidderId != bidder_id else None

    # Mark previous winning bids
    await db.execute(
        update(Bid).where(Bid.auctionId == auction_id, Bid.isWinning == True).values(isWinning=False)
    )

    # Create winning bid
    bid = Bid(
        amount=new_current_price,
        maxBid=max_bid,
        isProxy=max_bid > new_current_price,
        isWinning=True,
        auctionId=auction_id,
        bidderId=bidder_id,
    )
    db.add(bid)

    auction.currentPrice = new_current_price
    await db.commit()

    # Try to load bidder info for the response, but don't fail if it errors
    bidder_info = None
    try:
        await db.refresh(bid, ["bidder"])
        if bid.bidder:
            bidder_info = {"id": bid.bidder.id, "username": bid.bidder.username}
    except Exception:
        pass

    # Fire-and-forget side effects (notifications, socket)
    asyncio.create_task(_post_bid_side_effects(
        auction_id, auction.title, bidder_id,
        new_current_price, previous_bidder_id,
    ))

    return {
        "bid": {
            "id": bid.id, "amount": bid.amount, "isProxy": bid.isProxy,
            "isWinning": bid.isWinning, "createdAt": bid.createdAt.isoformat(),
            "auctionId": bid.auctionId, "bidderId": bid.bidderId,
            "bidder": bidder_info,
        },
        "isHighestBidder": True,
        "currentPrice": new_current_price,
        "message": f"You're the highest bidder at ${new_current_price:.2f}",
    }
