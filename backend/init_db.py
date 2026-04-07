import asyncio

from sqlalchemy import text

from app.config.database import engine, Base
from app.models.models import (
    User, Auction, Bid, Order, Payment, Feedback,
    Dispute, Notification, Watchlist,
)


async def create_enums(engine):
    """Create PostgreSQL enum types if they don't exist."""
    enum_definitions = [
        ("AuctionStatus", ["DRAFT", "ACTIVE", "ENDED", "SOLD", "CANCELLED", "RESERVE_NOT_MET"]),
        ("OrderStatus", ["PENDING_PAYMENT", "PAID", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED"]),
        ("PaymentStatus", ["PENDING", "HELD", "COMPLETED", "RELEASED", "REFUNDED", "FAILED"]),
        ("FeedbackType", ["BUYER_TO_SELLER", "SELLER_TO_BUYER"]),
        ("DisputeStatus", ["OPEN", "UNDER_REVIEW", "RESOLVED", "CLOSED", "ESCALATED"]),
        ("NotificationType", ["OUTBID", "AUCTION_WON", "AUCTION_ENDED", "PAYMENT_RECEIVED", "ITEM_SHIPPED", "ITEM_DELIVERED", "FEEDBACK_RECEIVED", "DISPUTE_OPENED", "DISPUTE_RESOLVED", "WATCHLIST_ENDING", "BID_PLACED"]),
    ]

    async with engine.begin() as conn:
        for name, values in enum_definitions:
            values_str = ", ".join(f"'{v}'" for v in values)
            await conn.execute(text(
                f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{name}') THEN "
                f"CREATE TYPE \"{name}\" AS ENUM ({values_str}); END IF; END $$;"
            ))


async def init():
    print("Creating enum types...")
    await create_enums(engine)
    print("Creating tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created!")


if __name__ == "__main__":
    asyncio.run(init())
