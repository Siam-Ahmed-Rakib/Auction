import logging
import random
import string
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config.database import async_session
from app.config.socket import sio
from app.models.models import Auction, AuctionStatus, Bid, Order, User
from app.services.notification_service import create_notification
from app.services.webhook_service import notify_auction_ended

logger = logging.getLogger(__name__)


async def check_ended_auctions():
    async with async_session() as db:
        try:
            result = await db.execute(
                select(Auction)
                .where(Auction.status == AuctionStatus.ACTIVE, Auction.endTime <= datetime.utcnow())
                .options(
                    selectinload(Auction.bids).selectinload(Bid.bidder),
                    selectinload(Auction.seller)
                )
                .with_for_update(skip_locked=True)
            )
            ended_auctions = result.scalars().all()

            for auction in ended_auctions:
                sorted_bids = sorted(auction.bids, key=lambda b: b.amount, reverse=True)
                winning_bid = sorted_bids[0] if sorted_bids else None

                # Get seller username
                seller_username = auction.seller.username if auction.seller else "Unknown"

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

                        winner_username = winning_bid.bidder.username if winning_bid.bidder else "a buyer"

                        # Collect all losing bidder IDs
                        losing_bidder_ids = list(set(
                            bid.bidderId for bid in sorted_bids 
                            if bid.bidderId != winning_bid.bidderId and bid.bidderId != auction.sellerId
                        ))

                        # Notify the winner via database + socket
                        await create_notification(
                            db, winning_bid.bidderId, "AUCTION_WON",
                            "Congratulations! You won!",
                            f'You won "{auction.title}" for ${winning_bid.amount:.2f}. Please complete payment.',
                            {"auctionId": auction.id},
                        )
                        # Notify the seller via database + socket
                        await create_notification(
                            db, auction.sellerId, "AUCTION_ENDED",
                            "Your auction has sold!",
                            f'"{auction.title}" sold to {winner_username} for ${winning_bid.amount:.2f}.',
                            {"auctionId": auction.id},
                        )

                        # Send live webhook/SSE notifications for immediate delivery
                        try:
                            webhook_result = await notify_auction_ended(
                                auction_id=auction.id,
                                auction_title=auction.title,
                                seller_id=auction.sellerId,
                                seller_username=seller_username,
                                winner_id=winning_bid.bidderId,
                                winner_username=winner_username,
                                final_price=winning_bid.amount,
                                status=auction.status.value,
                                losing_bidder_ids=losing_bidder_ids,
                            )
                            logger.info(f"Webhook notifications sent for auction {auction.id}: {webhook_result}")
                        except Exception as e:
                            logger.error(f"Failed to send webhook notifications for auction {auction.id}: {e}")

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
                    else:
                        auction.status = AuctionStatus.RESERVE_NOT_MET
                        await db.commit()

                        await create_notification(
                            db, auction.sellerId, "AUCTION_ENDED",
                            "Reserve price not met",
                            f'"{auction.title}" ended without meeting the reserve price.',
                            {"auctionId": auction.id},
                        )

                        # Send webhook notification to seller
                        try:
                            await notify_auction_ended(
                                auction_id=auction.id,
                                auction_title=auction.title,
                                seller_id=auction.sellerId,
                                seller_username=seller_username,
                                winner_id=None,
                                winner_username=None,
                                final_price=None,
                                status=auction.status.value,
                            )
                        except Exception as e:
                            logger.error(f"Failed to send webhook notification: {e}")
                else:
                    auction.status = AuctionStatus.ENDED
                    await db.commit()

                    await create_notification(
                        db, auction.sellerId, "AUCTION_ENDED",
                        "Auction ended",
                        f'"{auction.title}" ended with no bids.',
                        {"auctionId": auction.id},
                    )

                    # Send webhook notification to seller
                    try:
                        await notify_auction_ended(
                            auction_id=auction.id,
                            auction_title=auction.title,
                            seller_id=auction.sellerId,
                            seller_username=seller_username,
                            winner_id=None,
                            winner_username=None,
                            final_price=None,
                            status=auction.status.value,
                        )
                    except Exception as e:
                        logger.error(f"Failed to send webhook notification: {e}")

                # Emit socket events for real-time UI updates
                auction_ended_payload = {
                    "auctionId": auction.id,
                    "status": auction.status.value,
                    "winnerId": winning_bid.bidderId if winning_bid else None,
                    "winnerUsername": winning_bid.bidder.username if winning_bid and winning_bid.bidder else None,
                    "finalPrice": winning_bid.amount if winning_bid else None,
                }
                try:
                    # Emit to auction room (users currently viewing)
                    await sio.emit("auction-ended", auction_ended_payload, room=f"auction:{auction.id}")
                    # Emit to winner's and seller's user rooms (they may not be on the auction page)
                    if winning_bid:
                        await sio.emit("auction-won", auction_ended_payload, room=f"user:{winning_bid.bidderId}")
                    await sio.emit("auction-ended", auction_ended_payload, room=f"user:{auction.sellerId}")
                except Exception:
                    pass

        except Exception as e:
            logger.error(f"Auction scheduler error: {e}")
