import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base


class AuctionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ENDED = "ENDED"
    SOLD = "SOLD"
    CANCELLED = "CANCELLED"
    RESERVE_NOT_MET = "RESERVE_NOT_MET"


class OrderStatus(str, enum.Enum):
    PENDING_PAYMENT = "PENDING_PAYMENT"
    PAID = "PAID"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    HELD = "HELD"
    COMPLETED = "COMPLETED"
    RELEASED = "RELEASED"
    REFUNDED = "REFUNDED"
    FAILED = "FAILED"


class FeedbackType(str, enum.Enum):
    BUYER_TO_SELLER = "BUYER_TO_SELLER"
    SELLER_TO_BUYER = "SELLER_TO_BUYER"


class DisputeStatus(str, enum.Enum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    ESCALATED = "ESCALATED"


class NotificationType(str, enum.Enum):
    OUTBID = "OUTBID"
    AUCTION_WON = "AUCTION_WON"
    AUCTION_ENDED = "AUCTION_ENDED"
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"
    ITEM_SHIPPED = "ITEM_SHIPPED"
    ITEM_DELIVERED = "ITEM_DELIVERED"
    FEEDBACK_RECEIVED = "FEEDBACK_RECEIVED"
    DISPUTE_OPENED = "DISPUTE_OPENED"
    DISPUTE_RESOLVED = "DISPUTE_RESOLVED"
    WATCHLIST_ENDING = "WATCHLIST_ENDING"
    BID_PLACED = "BID_PLACED"


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    state: Mapped[str | None] = mapped_column(String, nullable=True)
    zipCode: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    avatarUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=0)
    totalRatings: Mapped[int] = mapped_column(Integer, default=0)
    positiveRate: Mapped[float] = mapped_column(Float, default=0)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    auctions = relationship("Auction", back_populates="seller", foreign_keys="Auction.sellerId")
    bids = relationship("Bid", back_populates="bidder")
    buyerOrders = relationship("Order", back_populates="buyer", foreign_keys="Order.buyerId")
    sellerOrders = relationship("Order", back_populates="seller", foreign_keys="Order.sellerId")
    feedbackGiven = relationship("Feedback", back_populates="fromUser", foreign_keys="Feedback.fromUserId")
    feedbackReceived = relationship("Feedback", back_populates="toUser", foreign_keys="Feedback.toUserId")
    disputesRaised = relationship("Dispute", back_populates="raisedBy")
    notifications = relationship("Notification", back_populates="user")
    watchlist = relationship("Watchlist", back_populates="user")


class Auction(Base):
    __tablename__ = "Auction"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    images: Mapped[list] = mapped_column(ARRAY(String), default=[])
    category: Mapped[str] = mapped_column(String, nullable=False)
    condition: Mapped[str] = mapped_column(String, default="New")
    startPrice: Mapped[float] = mapped_column(Float, nullable=False)
    reservePrice: Mapped[float | None] = mapped_column(Float, nullable=True)
    currentPrice: Mapped[float] = mapped_column(Float, nullable=False)
    bidIncrement: Mapped[float] = mapped_column(Float, default=1.00)
    startTime: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    endTime: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[AuctionStatus] = mapped_column(Enum(AuctionStatus, name="AuctionStatus", create_type=False), default=AuctionStatus.DRAFT)
    shippingCost: Mapped[float] = mapped_column(Float, default=0)
    shippingMethod: Mapped[str | None] = mapped_column(String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    returnPolicy: Mapped[str | None] = mapped_column(String, nullable=True)
    views: Mapped[int] = mapped_column(Integer, default=0)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sellerId: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("User.id"), nullable=False)
    seller = relationship("User", back_populates="auctions", foreign_keys=[sellerId])

    bids = relationship("Bid", back_populates="auction", order_by="Bid.createdAt.desc()")
    order = relationship("Order", back_populates="auction", uselist=False)
    watchlist = relationship("Watchlist", back_populates="auction")

    __table_args__ = (
        Index("idx_auction_status", "status"),
        Index("idx_auction_category", "category"),
        Index("idx_auction_endTime", "endTime"),
        Index("idx_auction_sellerId", "sellerId"),
    )


class Bid(Base):
    __tablename__ = "Bid"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    maxBid: Mapped[float] = mapped_column(Float, nullable=False)
    isProxy: Mapped[bool] = mapped_column(Boolean, default=False)
    isWinning: Mapped[bool] = mapped_column(Boolean, default=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    auctionId: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("Auction.id"), nullable=False)
    auction = relationship("Auction", back_populates="bids")

    bidderId: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("User.id"), nullable=False)
    bidder = relationship("User", back_populates="bids")

    __table_args__ = (
        Index("idx_bid_auctionId", "auctionId"),
        Index("idx_bid_bidderId", "bidderId"),
    )


class Order(Base):
    __tablename__ = "Order"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    orderNumber: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    totalAmount: Mapped[float] = mapped_column(Float, nullable=False)
    itemAmount: Mapped[float] = mapped_column(Float, nullable=False)
    shippingAmount: Mapped[float] = mapped_column(Float, default=0)
    discountAmount: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus, name="OrderStatus", create_type=False), default=OrderStatus.PENDING_PAYMENT)
    shippingAddress: Mapped[str | None] = mapped_column(String, nullable=True)
    trackingNumber: Mapped[str | None] = mapped_column(String, nullable=True)
    shippingCarrier: Mapped[str | None] = mapped_column(String, nullable=True)
    estimatedDelivery: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deliveredAt: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    auctionId: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("Auction.id"), unique=True, nullable=False)
    auction = relationship("Auction", back_populates="order")

    buyerId: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("User.id"), nullable=False)
    buyer = relationship("User", back_populates="buyerOrders", foreign_keys=[buyerId])

    sellerId: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("User.id"), nullable=False)
    seller = relationship("User", back_populates="sellerOrders", foreign_keys=[sellerId])

    payment = relationship("Payment", back_populates="order", uselist=False)
    feedback = relationship("Feedback", back_populates="order")
    dispute = relationship("Dispute", back_populates="order", uselist=False)

    __table_args__ = (
        Index("idx_order_buyerId", "buyerId"),
        Index("idx_order_sellerId", "sellerId"),
    )


class Payment(Base):
    __tablename__ = "Payment"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    method: Mapped[str] = mapped_column(String, default="card")
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus, name="PaymentStatus", create_type=False), default=PaymentStatus.PENDING)
    transactionId: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    heldUntil: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    releasedAt: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    orderId: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("Order.id"), unique=True, nullable=False)
    order = relationship("Order", back_populates="payment")


class Feedback(Base):
    __tablename__ = "Feedback"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    communication: Mapped[int | None] = mapped_column(Integer, nullable=True)
    shipping: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[FeedbackType] = mapped_column(Enum(FeedbackType, name="FeedbackType", create_type=False), nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    orderId: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("Order.id"), nullable=False)
    order = relationship("Order", back_populates="feedback")

    fromUserId: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("User.id"), nullable=False)
    fromUser = relationship("User", back_populates="feedbackGiven", foreign_keys=[fromUserId])

    toUserId: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("User.id"), nullable=False)
    toUser = relationship("User", back_populates="feedbackReceived", foreign_keys=[toUserId])

    __table_args__ = (
        UniqueConstraint("orderId", "fromUserId", name="uq_feedback_order_from"),
    )


class Dispute(Base):
    __tablename__ = "Dispute"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    reason: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True, default="")
    status: Mapped[DisputeStatus] = mapped_column(Enum(DisputeStatus, name="DisputeStatus", create_type=False), default=DisputeStatus.OPEN)
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolvedAt: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    orderId: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("Order.id"), unique=True, nullable=False)
    order = relationship("Order", back_populates="dispute")

    raisedById: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("User.id"), nullable=False)
    raisedBy = relationship("User", back_populates="disputesRaised")


class Notification(Base):
    __tablename__ = "Notification"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType, name="NotificationType", create_type=False), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    userId: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("User.id"), nullable=False)
    user = relationship("User", back_populates="notifications")

    __table_args__ = (
        Index("idx_notification_userId_read", "userId", "read"),
    )


class Watchlist(Base):
    __tablename__ = "Watchlist"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    userId: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("User.id"), nullable=False)
    user = relationship("User", back_populates="watchlist")

    auctionId: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("Auction.id"), nullable=False)
    auction = relationship("Auction", back_populates="watchlist")

    __table_args__ = (
        UniqueConstraint("userId", "auctionId", name="uq_watchlist_user_auction"),
    )
