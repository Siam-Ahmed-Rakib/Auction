from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Dispute, DisputeStatus, Order, OrderStatus, User
from app.services.notification_service import create_notification

router = APIRouter(prefix="/api/disputes", tags=["disputes"])


class OpenDisputeRequest(BaseModel):
    orderId: str
    reason: str


class ResolveDisputeRequest(BaseModel):
    resolution: str


@router.post("", status_code=201)
async def open_dispute(
    body: OpenDisputeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order).where(Order.id == body.orderId).options(selectinload(Order.buyer), selectinload(Order.seller))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyerId != user.id and order.sellerId != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    order_status = order.status.value if hasattr(order.status, "value") else order.status
    if order_status not in ("PAID", "SHIPPED", "DELIVERED"):
        raise HTTPException(status_code=400, detail="Cannot dispute this order")

    existing_r = await db.execute(
        select(Dispute).where(
            Dispute.orderId == body.orderId,
            Dispute.status.in_([DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW]),
        )
    )
    if existing_r.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Active dispute already exists for this order")

    dispute = Dispute(
        orderId=body.orderId,
        raisedById=user.id,
        reason=body.reason,
        status=DisputeStatus.OPEN,
    )
    db.add(dispute)
    await db.commit()
    await db.refresh(dispute)

    other_user_id = order.sellerId if order.buyerId == user.id else order.buyerId
    await create_notification(
        db, other_user_id, "DISPUTE_OPENED",
        "Dispute opened",
        f"A dispute has been opened for order #{order.orderNumber}",
        {"auctionId": order.auctionId},
    )

    return {
        "id": dispute.id,
        "orderId": dispute.orderId,
        "raisedById": dispute.raisedById,
        "reason": dispute.reason,
        "status": dispute.status.value if hasattr(dispute.status, "value") else dispute.status,
        "createdAt": dispute.createdAt.isoformat(),
    }


@router.get("")
async def get_disputes(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dispute)
        .where(
            or_(
                Dispute.raisedById == user.id,
                Dispute.orderId.in_(select(Order.id).where(Order.buyerId == user.id)),
                Dispute.orderId.in_(select(Order.id).where(Order.sellerId == user.id)),
            )
        )
        .options(
            selectinload(Dispute.order).selectinload(Order.auction),
            selectinload(Dispute.order).selectinload(Order.buyer),
            selectinload(Dispute.order).selectinload(Order.seller),
            selectinload(Dispute.raisedBy),
        )
        .order_by(Dispute.createdAt.desc())
    )
    disputes = result.scalars().all()

    return [
        {
            "id": d.id,
            "reason": d.reason,
            "status": d.status.value if hasattr(d.status, "value") else d.status,
            "resolution": d.resolution,
            "createdAt": d.createdAt.isoformat(),
            "order": {
                "id": d.order.id,
                "orderNumber": d.order.orderNumber,
                "auction": {
                    "id": d.order.auction.id,
                    "title": d.order.auction.title,
                    "images": d.order.auction.images or [],
                } if d.order.auction else None,
                "buyer": {"id": d.order.buyer.id, "username": d.order.buyer.username} if d.order.buyer else None,
                "seller": {"id": d.order.seller.id, "username": d.order.seller.username} if d.order.seller else None,
            } if d.order else None,
            "raisedBy": {"id": d.raisedBy.id, "username": d.raisedBy.username} if d.raisedBy else None,
        }
        for d in disputes
    ]


@router.get("/{dispute_id}")
async def get_dispute(
    dispute_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dispute)
        .where(Dispute.id == dispute_id)
        .options(
            selectinload(Dispute.order).selectinload(Order.auction),
            selectinload(Dispute.order).selectinload(Order.buyer),
            selectinload(Dispute.order).selectinload(Order.seller),
            selectinload(Dispute.raisedBy),
        )
    )
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    order = dispute.order
    if order.buyerId != user.id and order.sellerId != user.id and dispute.raisedById != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return {
        "id": dispute.id,
        "reason": dispute.reason,
        "description": dispute.description,
        "status": dispute.status.value if hasattr(dispute.status, "value") else dispute.status,
        "resolution": dispute.resolution,
        "resolvedAt": dispute.resolvedAt.isoformat() if dispute.resolvedAt else None,
        "createdAt": dispute.createdAt.isoformat(),
        "order": {
            "id": order.id,
            "orderNumber": order.orderNumber,
            "auction": {
                "id": order.auction.id, "title": order.auction.title,
                "images": order.auction.images or [], "description": order.auction.description,
            } if order.auction else None,
            "buyer": {
                "id": order.buyer.id, "username": order.buyer.username, "email": order.buyer.email,
            } if order.buyer else None,
            "seller": {
                "id": order.seller.id, "username": order.seller.username, "email": order.seller.email,
            } if order.seller else None,
        } if order else None,
        "raisedBy": {"id": dispute.raisedBy.id, "username": dispute.raisedBy.username} if dispute.raisedBy else None,
    }


@router.put("/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: str,
    body: ResolveDisputeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dispute).where(Dispute.id == dispute_id).options(selectinload(Dispute.order))
    )
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    dispute_status = dispute.status.value if hasattr(dispute.status, "value") else dispute.status
    if dispute_status not in ("OPEN", "UNDER_REVIEW"):
        raise HTTPException(status_code=400, detail="Dispute is already resolved")

    dispute.status = DisputeStatus.RESOLVED
    dispute.resolution = body.resolution
    dispute.resolvedAt = datetime.utcnow()
    dispute.updatedAt = datetime.utcnow()
    await db.commit()

    order = dispute.order
    if order:
        order.status = OrderStatus.COMPLETED
        order.updatedAt = datetime.utcnow()
        await db.commit()

        for uid in [order.buyerId, order.sellerId]:
            await create_notification(
                db, uid, "DISPUTE_OPENED",
                "Dispute resolved",
                f"Dispute for order #{order.orderNumber} has been resolved",
                {"auctionId": order.auctionId},
            )

    await db.refresh(dispute)
    return {
        "id": dispute.id,
        "reason": dispute.reason,
        "status": dispute.status.value if hasattr(dispute.status, "value") else dispute.status,
        "resolution": dispute.resolution,
        "resolvedAt": dispute.resolvedAt.isoformat() if dispute.resolvedAt else None,
        "createdAt": dispute.createdAt.isoformat(),
    }
