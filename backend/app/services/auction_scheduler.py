import random
import string
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config.database import async_session
from app.config.socket import sio
from app.models.models import Auction, AuctionStatus, Bid, Order
from app.services.notification_service import create_notification


async def check_ended_auctions():
    async with async_session() as db:
        try:
            result = await db.execute(
                select(Auction)
                .where(Auction.status == AuctionStatus.ACTIVE, Auction.endTime <= datetime.utcnow())
                .options(selectinload(Auction.bids).selectinload(Bid.bidder))
            )
            ended_auctions = result.scalars().all()

            for auction in ended_auctions:
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

                        await create_notification(
                            db, winning_bid.bidderId, "AUCTION_WON",
                            "Congratulations! You won!",
                            f'You won "{auction.title}" for ${winning_bid.amount:.2f}. Please complete payment.',
                            {"auctionId": auction.id},
                        )
                        await create_notification(
                            db, auction.sellerId, "AUCTION_ENDED",
                            "Your auction has sold!",
                            f'"{auction.title}" sold for ${winning_bid.amount:.2f}.',
                            {"auctionId": auction.id},
                        )
                    else:
                        auction.status = AuctionStatus.RESERVE_NOT_MET
                        await db.commit()

                        await create_notification(
                            db, auction.sellerId, "AUCTION_ENDED",
                            "Reserve price not met",
                            f'"{auction.title}" ended without meeting the reserve price.',
                            {"auctionId": auction.id},
                        )
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
                    await sio.emit("auction-ended", {
                        "auctionId": auction.id,
                        "winnerId": winning_bid.bidderId if winning_bid else None,
                        "finalPrice": winning_bid.amount if winning_bid else None,
                    }, room=f"auction:{auction.id}")
                except Exception:
                    pass

        except Exception as e:
            print(f"Auction scheduler error: {e}")
