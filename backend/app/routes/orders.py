from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Order, OrderStatus, Payment, User
from app.services.notification_service import create_notification

router = APIRouter(prefix="/api/orders", tags=["orders"])


def order_to_dict(order, include_relations=False):
    d = {
        "id": order.id,
        "orderNumber": order.orderNumber,
        "totalAmount": order.totalAmount,
        "itemAmount": order.itemAmount,
        "shippingAmount": order.shippingAmount,
        "discountAmount": order.discountAmount,
        "status": order.status.value if hasattr(order.status, "value") else order.status,
        "shippingAddress": order.shippingAddress,
        "trackingNumber": order.trackingNumber,
        "shippingCarrier": order.shippingCarrier,
        "estimatedDelivery": order.estimatedDelivery.isoformat() if order.estimatedDelivery else None,
        "deliveredAt": order.deliveredAt.isoformat() if order.deliveredAt else None,
        "createdAt": order.createdAt.isoformat() if order.createdAt else None,
        "updatedAt": order.updatedAt.isoformat() if order.updatedAt else None,
        "auctionId": order.auctionId,
        "buyerId": order.buyerId,
        "sellerId": order.sellerId,
    }
    if include_relations:
        if order.auction:
            d["auction"] = {
                "id": order.auction.id,
                "title": order.auction.title,
                "images": order.auction.images or [],
                "category": order.auction.category,
            }
        if order.payment:
            d["payment"] = {
                "id": order.payment.id,
                "amount": order.payment.amount,
                "method": order.payment.method,
                "status": order.payment.status.value if hasattr(order.payment.status, "value") else order.payment.status,
                "transactionId": order.payment.transactionId,
                "createdAt": order.payment.createdAt.isoformat() if order.payment.createdAt else None,
            }
    return d


@router.get("/buying")
async def get_buying_orders(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .where(Order.buyerId == user.id)
        .options(selectinload(Order.auction), selectinload(Order.seller), selectinload(Order.payment))
        .order_by(Order.createdAt.desc())
    )
    orders = result.scalars().all()
    items = []
    for o in orders:
        d = order_to_dict(o, include_relations=True)
        if o.seller:
            d["seller"] = {"id": o.seller.id, "username": o.seller.username, "rating": o.seller.rating}
        items.append(d)
    return items


@router.get("/selling")
async def get_selling_orders(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .where(Order.sellerId == user.id)
        .options(selectinload(Order.auction), selectinload(Order.buyer), selectinload(Order.payment))
        .order_by(Order.createdAt.desc())
    )
    orders = result.scalars().all()
    items = []
    for o in orders:
        d = order_to_dict(o, include_relations=True)
        if o.buyer:
            d["buyer"] = {"id": o.buyer.id, "username": o.buyer.username, "rating": o.buyer.rating}
        items.append(d)
    return items


@router.get("/{order_id}")
async def get_order(
    order_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id)
        .options(
            selectinload(Order.auction),
            selectinload(Order.buyer),
            selectinload(Order.seller),
            selectinload(Order.payment),
            selectinload(Order.feedback),
            selectinload(Order.dispute),
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyerId != user.id and order.sellerId != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    d = order_to_dict(order, include_relations=True)
    if order.buyer:
        d["buyer"] = {
            "id": order.buyer.id, "username": order.buyer.username, "name": order.buyer.name,
            "email": order.buyer.email, "address": order.buyer.address, "city": order.buyer.city,
            "state": order.buyer.state, "zipCode": order.buyer.zipCode, "country": order.buyer.country,
        }
    if order.seller:
        d["seller"] = {"id": order.seller.id, "username": order.seller.username, "name": order.seller.name, "email": order.seller.email}
    if order.feedback:
        d["feedback"] = [
            {"id": f.id, "rating": f.rating, "comment": f.comment, "type": f.type.value if hasattr(f.type, "value") else f.type, "fromUserId": f.fromUserId, "toUserId": f.toUserId}
            for f in order.feedback
        ]
    if order.dispute:
        d["dispute"] = {
            "id": order.dispute.id, "reason": order.dispute.reason,
            "status": order.dispute.status.value if hasattr(order.dispute.status, "value") else order.dispute.status,
            "resolution": order.dispute.resolution,
        }
    return d


class ShipOrderRequest(BaseModel):
    trackingNumber: str
    shippingCarrier: str
    estimatedDelivery: str | None = None


@router.put("/{order_id}/ship")
async def ship_order(
    order_id: str,
    body: ShipOrderRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.sellerId != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if order.status != OrderStatus.PAID:
        raise HTTPException(status_code=400, detail="Order must be paid first")

    order.trackingNumber = body.trackingNumber
    order.shippingCarrier = body.shippingCarrier
    order.estimatedDelivery = (
        datetime.fromisoformat(body.estimatedDelivery) if body.estimatedDelivery
        else datetime.utcnow() + timedelta(days=7)
    )
    order.status = OrderStatus.SHIPPED
    order.updatedAt = datetime.utcnow()
    await db.commit()

    await create_notification(
        db, order.buyerId, "ITEM_SHIPPED", "Your item has shipped!",
        f"Tracking: {body.trackingNumber} via {body.shippingCarrier}",
        {"orderId": order.id},
    )

    await db.refresh(order)
    return order_to_dict(order)


@router.post("/{order_id}/deliver")
async def confirm_delivery(
    order_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order).where(Order.id == order_id).options(selectinload(Order.payment))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyerId != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if order.status != OrderStatus.SHIPPED:
        raise HTTPException(status_code=400, detail="Order must be shipped first")

    order.status = OrderStatus.DELIVERED
    order.deliveredAt = datetime.utcnow()
    order.updatedAt = datetime.utcnow()

    if order.payment:
        order.payment.status = "RELEASED"
        order.payment.releasedAt = datetime.utcnow()

    await db.commit()

    await create_notification(
        db, order.sellerId, "ITEM_DELIVERED", "Item delivered!",
        "Your item has been delivered. Payment has been released.",
        {"orderId": order.id},
    )

    await db.refresh(order)
    return order_to_dict(order)
