from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Feedback, FeedbackType, Order, OrderStatus, User
from app.services.notification_service import create_notification

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


class FeedbackRequest(BaseModel):
    rating: int
    communication: int | None = None
    shipping: int | None = None
    description: int | None = None
    comment: str | None = None


@router.post("/{order_id}", status_code=201)
async def leave_feedback(
    order_id: str,
    body: FeedbackRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    is_buyer = order.buyerId == user.id
    is_seller = order.sellerId == user.id
    if not is_buyer and not is_seller:
        raise HTTPException(status_code=403, detail="Not authorized")

    order_status = order.status.value if hasattr(order.status, "value") else order.status
    if order_status not in ("DELIVERED", "COMPLETED"):
        raise HTTPException(status_code=400, detail="Order must be delivered before leaving feedback")

    to_user_id = order.sellerId if is_buyer else order.buyerId
    fb_type = FeedbackType.BUYER_TO_SELLER if is_buyer else FeedbackType.SELLER_TO_BUYER

    # Check existing feedback
    existing = await db.execute(
        select(Feedback).where(Feedback.orderId == order.id, Feedback.fromUserId == user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You have already left feedback for this order")

    feedback = Feedback(
        rating=body.rating,
        communication=body.communication,
        shipping=body.shipping,
        description=body.description,
        comment=body.comment,
        type=fb_type,
        orderId=order.id,
        fromUserId=user.id,
        toUserId=to_user_id,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    # Update user rating
    all_fb_result = await db.execute(select(Feedback).where(Feedback.toUserId == to_user_id))
    all_feedback = all_fb_result.scalars().all()

    avg_rating = sum(f.rating for f in all_feedback) / len(all_feedback)
    positive_count = sum(1 for f in all_feedback if f.rating >= 4)

    target_user_r = await db.execute(select(User).where(User.id == to_user_id))
    target_user = target_user_r.scalar_one()
    target_user.rating = round(avg_rating, 1)
    target_user.totalRatings = len(all_feedback)
    target_user.positiveRate = round((positive_count / len(all_feedback)) * 100, 1)
    await db.commit()

    # Check if both parties left feedback
    other_fb = await db.execute(
        select(Feedback).where(Feedback.orderId == order.id, Feedback.fromUserId == to_user_id)
    )
    if other_fb.scalar_one_or_none():
        order.status = OrderStatus.COMPLETED
        order.updatedAt = datetime.utcnow()
        await db.commit()

    await create_notification(
        db, to_user_id, "FEEDBACK_RECEIVED", "New feedback received",
        f"You received a {body.rating}-star rating.",
        {"orderId": order.id},
    )

    return {
        "id": feedback.id,
        "rating": feedback.rating,
        "communication": feedback.communication,
        "shipping": feedback.shipping,
        "description": feedback.description,
        "comment": feedback.comment,
        "type": feedback.type.value if hasattr(feedback.type, "value") else feedback.type,
        "orderId": feedback.orderId,
        "fromUserId": feedback.fromUserId,
        "toUserId": feedback.toUserId,
        "createdAt": feedback.createdAt.isoformat(),
    }


@router.get("/user/{user_id}")
async def get_user_feedback(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Feedback)
        .where(Feedback.toUserId == user_id)
        .options(
            selectinload(Feedback.fromUser),
            selectinload(Feedback.order).selectinload(Order.auction),
        )
        .order_by(Feedback.createdAt.desc())
    )
    feedbacks = result.scalars().all()

    return [
        {
            "id": f.id,
            "rating": f.rating,
            "communication": f.communication,
            "shipping": f.shipping,
            "description": f.description,
            "comment": f.comment,
            "type": f.type.value if hasattr(f.type, "value") else f.type,
            "createdAt": f.createdAt.isoformat(),
            "fromUser": {"id": f.fromUser.id, "username": f.fromUser.username} if f.fromUser else None,
            "order": {
                "auction": {
                    "id": f.order.auction.id,
                    "title": f.order.auction.title,
                } if f.order and f.order.auction else None,
            } if f.order else None,
        }
        for f in feedbacks
    ]
