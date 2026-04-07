import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Order, OrderStatus, Payment, PaymentStatus, User
from app.services.notification_service import create_notification

router = APIRouter(prefix="/api/payments", tags=["payments"])


class PayRequest(BaseModel):
    method: str
    couponCode: str | None = None


@router.post("/{order_id}/pay")
async def process_payment(
    order_id: str,
    body: PayRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.method not in ("card", "paypal", "googlepay", "applepay"):
        raise HTTPException(status_code=400, detail="Invalid payment method")

    result = await db.execute(
        select(Order).where(Order.id == order_id).options(selectinload(Order.auction))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyerId != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if order.status != OrderStatus.PENDING_PAYMENT:
        raise HTTPException(status_code=400, detail="Order already paid")

    discount = 0.0
    if body.couponCode:
        code = body.couponCode.upper()
        if code == "SAVE10":
            discount = order.totalAmount * 0.1
        elif code == "SAVE5":
            discount = order.totalAmount * 0.05

    final_amount = order.totalAmount - discount
    transaction_id = f"TXN-{str(uuid.uuid4())[:12].upper()}"

    payment = Payment(
        amount=final_amount,
        method=body.method,
        status=PaymentStatus.HELD,
        transactionId=transaction_id,
        heldUntil=datetime.utcnow() + timedelta(days=14),
        orderId=order.id,
    )
    db.add(payment)

    order.status = OrderStatus.PAID
    order.discountAmount = discount
    order.totalAmount = final_amount
    order.updatedAt = datetime.utcnow()

    await db.commit()
    await db.refresh(payment)
    await db.refresh(order)

    auction_title = order.auction.title if order.auction else "item"
    await create_notification(
        db, order.sellerId, "PAYMENT_RECEIVED", "Payment received!",
        f'Payment of ${final_amount:.2f} received for "{auction_title}". Please ship the item.',
        {"orderId": order.id},
    )

    return {
        "payment": {
            "id": payment.id,
            "amount": payment.amount,
            "method": payment.method,
            "status": payment.status.value if hasattr(payment.status, "value") else payment.status,
            "transactionId": payment.transactionId,
            "heldUntil": payment.heldUntil.isoformat() if payment.heldUntil else None,
            "createdAt": payment.createdAt.isoformat() if payment.createdAt else None,
        },
        "order": {
            "id": order.id,
            "status": order.status.value if hasattr(order.status, "value") else order.status,
            "totalAmount": order.totalAmount,
            "discountAmount": order.discountAmount,
        },
        "message": "Payment processed successfully",
    }


@router.get("/{order_id}")
async def get_payment(
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
    if order.buyerId != user.id and order.sellerId != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not order.payment:
        return None

    p = order.payment
    return {
        "id": p.id,
        "amount": p.amount,
        "method": p.method,
        "status": p.status.value if hasattr(p.status, "value") else p.status,
        "transactionId": p.transactionId,
        "heldUntil": p.heldUntil.isoformat() if p.heldUntil else None,
        "releasedAt": p.releasedAt.isoformat() if p.releasedAt else None,
        "createdAt": p.createdAt.isoformat() if p.createdAt else None,
    }


@router.post("/{order_id}/refund")
async def request_refund(
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
    if not order.payment or order.payment.status == PaymentStatus.REFUNDED:
        raise HTTPException(status_code=400, detail="Cannot refund")

    order.payment.status = PaymentStatus.REFUNDED
    order.payment.updatedAt = datetime.utcnow()
    order.status = OrderStatus.REFUNDED
    order.updatedAt = datetime.utcnow()

    await db.commit()
    await db.refresh(order)
    await db.refresh(order.payment)

    return {
        "payment": {
            "id": order.payment.id, "status": order.payment.status.value,
        },
        "order": {
            "id": order.id, "status": order.status.value,
        },
    }
