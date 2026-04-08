from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config.database import get_db
from app.middleware.auth import get_optional_user
from app.models.models import Auction, AuctionStatus, Bid, User

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
async def search_auctions(
    q: str | None = None,
    category: str | None = None,
    condition: str | None = None,
    minPrice: float | None = None,
    maxPrice: float | None = None,
    sort: str = "bestMatch",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Auction).options(selectinload(Auction.seller))
    count_query = select(func.count(Auction.id))

    filters = [Auction.status == AuctionStatus.ACTIVE]

    if q:
        filters.append(
            or_(
                Auction.title.ilike(f"%{q}%"),
                Auction.description.ilike(f"%{q}%"),
            )
        )
    if category:
        filters.append(Auction.category == category)
    if condition:
        filters.append(Auction.condition == condition)
    if minPrice is not None:
        filters.append(Auction.currentPrice >= minPrice)
    if maxPrice is not None:
        filters.append(Auction.currentPrice <= maxPrice)

    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

    if sort == "priceLow":
        order_col = Auction.currentPrice.asc()
    elif sort == "priceHigh":
        order_col = Auction.currentPrice.desc()
    elif sort == "endingSoon":
        order_col = Auction.endTime.asc()
    elif sort == "newest":
        order_col = Auction.createdAt.desc()
    else:
        order_col = Auction.views.desc()

    query = query.order_by(order_col).offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    auctions = result.scalars().all()

    total_r = await db.execute(count_query)
    total = total_r.scalar()

    items = []
    for a in auctions:
        bid_count_r = await db.execute(select(func.count(Bid.id)).where(Bid.auctionId == a.id))
        bid_count = bid_count_r.scalar()
        items.append({
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "images": a.images or [],
            "category": a.category,
            "condition": a.condition,
            "startPrice": a.startPrice,
            "currentPrice": a.currentPrice,
            "bidIncrement": a.bidIncrement,
            "endTime": a.endTime.isoformat() if a.endTime else None,
            "status": a.status.value if hasattr(a.status, "value") else a.status,
            "shippingCost": a.shippingCost,
            "views": a.views,
            "sellerId": a.sellerId,
            "seller": {
                "id": a.seller.id, "username": a.seller.username,
                "rating": a.seller.rating, "positiveRate": a.seller.positiveRate,
                "totalRatings": a.seller.totalRatings,
            } if a.seller else None,
            "_count": {"bids": bid_count},
        })

    # Categories facet
    cat_filters = [Auction.status == AuctionStatus.ACTIVE]
    if q:
        cat_filters.append(or_(Auction.title.ilike(f"%{q}%"), Auction.description.ilike(f"%{q}%")))

    cat_r = await db.execute(
        select(Auction.category, func.count(Auction.id).label("count"))
        .where(*cat_filters)
        .group_by(Auction.category)
        .order_by(func.count(Auction.id).desc())
    )
    categories = [{"category": row[0], "_count": row[1]} for row in cat_r.all()]

    return {
        "auctions": items,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": -(-total // limit)},
        "facets": {"categories": categories},
    }


@router.get("/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Auction.category, func.count(Auction.id).label("count"))
        .where(Auction.status == AuctionStatus.ACTIVE)
        .group_by(Auction.category)
        .order_by(func.count(Auction.id).desc())
    )
    return [{"category": row[0], "_count": row[1]} for row in result.all()]
