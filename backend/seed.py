import asyncio
import random
from datetime import datetime, timedelta

from passlib.context import CryptContext
from sqlalchemy import select

from app.config.database import async_session, engine
from app.config.database import Base
from app.models.models import (
    Auction,
    AuctionStatus,
    Bid,
    Order,
    OrderStatus,
    User,
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed():
    async with async_session() as db:
        print("Seeding database...")

        password = pwd_context.hash("password123")
        now = datetime.utcnow()

        # Check if already seeded
        existing = await db.execute(select(User).where(User.email == "jamestronix@auction.com"))
        if existing.scalar_one_or_none():
            print("Seed skipped (may already exist)")
            return

        seller1 = User(
            email="jamestronix@auction.com", username="jamestronix", password=password,
            name="James Tronix", rating=4.8, totalRatings=62700, positiveRate=99.5,
            address="123 Tech Street", city="San Francisco", state="CA", zipCode="94102", country="United States",
        )
        seller2 = User(
            email="applestore@auction.com", username="AppleStoreCertified", password=password,
            name="Apple Store Certified", rating=4.9, totalRatings=15200, positiveRate=99.8,
            address="1 Apple Park Way", city="Cupertino", state="CA", zipCode="95014", country="United States",
        )
        seller3 = User(
            email="techdeals@auction.com", username="TechDeals", password=password,
            name="Tech Deals Official", rating=4.6, totalRatings=8900, positiveRate=98.2,
            address="456 Commerce Ave", city="New York", state="NY", zipCode="10001", country="United States",
        )
        buyer1 = User(
            email="buyer@auction.com", username="smartbuyer", password=password,
            name="Smart Buyer",
            address="SS AALLEEPPHH, kazipara", city="Mirpur", state="Dhaka", zipCode="1216", country="Bangladesh",
        )
        buyer2 = User(
            email="nixin305@auction.com", username="nixin305", password=password,
            name="Nixin Three-Oh-Five", rating=5.0, totalRatings=862, positiveRate=100,
            address="789 Buyer Lane", city="Austin", state="TX", zipCode="73301", country="United States",
        )

        db.add_all([seller1, seller2, seller3, buyer1, buyer2])
        await db.commit()

        for u in [seller1, seller2, seller3, buyer1, buyer2]:
            await db.refresh(u)

        # Auctions
        auction1 = Auction(
            title="Meta Quest 3 128GB VR Headset Only (No Controllers) Works Great!",
            description="Pre-owned Meta Quest 3 128GB VR Headset in excellent condition. Fully functional, tested and working. No controllers included. Perfect for those who already have controllers or want to use hand tracking. Almost gone - 69 sold!",
            images=["https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=600&h=400&fit=crop"],
            category="Electronics", condition="Pre-Owned", startPrice=150.00, currentPrice=174.97,
            reservePrice=160.00, bidIncrement=1.00,
            startTime=now - timedelta(days=5), endTime=now + timedelta(days=2),
            status=AuctionStatus.ACTIVE, shippingCost=121.26, shippingMethod="eBay International Shipping",
            location="United States", returnPolicy="30 days returns. Buyer pays for return shipping.",
            sellerId=seller1.id, views=210,
        )
        auction2 = Auction(
            title="Meta Quest 3 512GB VR Headset - White",
            description="Brand new Meta Quest 3 512GB VR Headset in White. Full package with controllers. 210 viewed in the last 24 hours! Automatic bidding is active.",
            images=["https://images.unsplash.com/photo-1617802690992-15d93263d3a9?w=600&h=400&fit=crop"],
            category="Electronics", condition="New", startPrice=250.00, currentPrice=325.00, bidIncrement=5.00,
            startTime=now - timedelta(days=3), endTime=now + timedelta(days=2, hours=5),
            status=AuctionStatus.ACTIVE, shippingCost=15.00, shippingMethod="USPS Priority",
            location="United States", returnPolicy="30 days returns. Buyer pays for return shipping.",
            sellerId=buyer2.id, views=210,
        )
        auction3 = Auction(
            title="Meta Quest 3 Virtual Reality Headset 128GB With Original Box Barely Used",
            description="Barely used Meta Quest 3 128GB with original box and all accessories. In excellent condition.",
            images=["https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=600&h=400&fit=crop"],
            category="Electronics", condition="Pre-Owned", startPrice=200.00, currentPrice=325.00, bidIncrement=5.00,
            startTime=now - timedelta(days=6), endTime=now + timedelta(hours=4, minutes=46),
            status=AuctionStatus.ACTIVE, shippingCost=196.46, shippingMethod="eBay International Shipping",
            location="United States", sellerId=seller2.id, views=145,
        )
        auction4 = Auction(
            title="Sony PlayStation 5 Slim Console - Digital Edition with Controller",
            description="Brand new PS5 Slim Digital Edition with DualSense controller.",
            images=["https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=600&h=400&fit=crop"],
            category="Electronics", condition="New", startPrice=300.00, currentPrice=425.00, bidIncrement=5.00,
            startTime=now - timedelta(days=7), endTime=now - timedelta(days=1),
            status=AuctionStatus.SOLD, shippingCost=15.00, sellerId=seller3.id, views=380,
        )
        auction5 = Auction(
            title="Apple iPhone 15 Pro Max 256GB - Natural Titanium (Unlocked)",
            description="Unlocked iPhone 15 Pro Max in Natural Titanium. Brand new sealed.",
            images=["https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&h=400&fit=crop"],
            category="Cell Phones & Accessories", condition="New", startPrice=800.00, currentPrice=1200.00,
            bidIncrement=10.00, startTime=now - timedelta(days=10), endTime=now - timedelta(days=2),
            status=AuctionStatus.ENDED, shippingCost=0, shippingMethod="Free Shipping",
            sellerId=seller3.id, views=520,
        )

        db.add_all([auction1, auction2, auction3, auction4, auction5])
        await db.commit()
        for a in [auction1, auction2, auction3, auction4, auction5]:
            await db.refresh(a)

        # Sample items
        sample_items = [
            {"title": "Vintage Rolex Submariner Watch", "cat": "Fashion", "price": 5000, "image": "https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=600&h=400&fit=crop"},
            {"title": "Gaming PC RTX 4090 Custom Build", "cat": "Electronics", "price": 2500, "image": "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&h=400&fit=crop"},
            {"title": "Rare Pokemon Card Collection", "cat": "Collectibles and Art", "price": 800, "image": "https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?w=600&h=400&fit=crop"},
            {"title": "Nike Air Jordan 1 Retro High OG", "cat": "Fashion", "price": 250, "image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=400&fit=crop"},
            {"title": "DJI Mavic 3 Pro Drone", "cat": "Electronics", "price": 1500, "image": "https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?w=600&h=400&fit=crop"},
            {"title": "Signed Baseball Collection", "cat": "Sports", "price": 300, "image": "https://images.unsplash.com/photo-1508344928928-7165b67de128?w=600&h=400&fit=crop"},
            {"title": "Dyson V15 Detect Vacuum", "cat": "Home & Garden", "price": 400, "image": "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&h=400&fit=crop"},
            {"title": "Canon EOS R5 Mirrorless Camera", "cat": "Electronics", "price": 3000, "image": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&h=400&fit=crop"},
            {"title": "Antique Victorian Writing Desk", "cat": "Home & Garden", "price": 1200, "image": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=400&fit=crop"},
            {"title": "Samsung Galaxy S24 Ultra 512GB", "cat": "Cell Phones & Accessories", "price": 900, "image": "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&h=400&fit=crop"},
            {"title": "Bose QuietComfort Ultra Headphones", "cat": "Electronics", "price": 300, "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop"},
            {"title": "Louis Vuitton Speedy Bandouliere 25", "cat": "Fashion", "price": 1500, "image": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=400&fit=crop"},
        ]

        sellers = [seller1, seller2, seller3]
        conditions = ["New", "Pre-Owned", "Refurbished"]

        for item in sample_items:
            a = Auction(
                title=item["title"],
                description=f'High quality {item["title"]}. Great condition and ready for auction. Don\'t miss this opportunity!',
                images=[item["image"]],
                category=item["cat"],
                condition=random.choice(conditions),
                startPrice=item["price"] * 0.5,
                currentPrice=item["price"] * (0.6 + random.random() * 0.3),
                bidIncrement=10 if item["price"] > 1000 else 5,
                startTime=now - timedelta(days=random.random() * 5),
                endTime=now + timedelta(days=1 + random.random() * 6),
                status=AuctionStatus.ACTIVE,
                shippingCost=random.randint(5, 35),
                location="United States",
                sellerId=random.choice(sellers).id,
                views=random.randint(0, 500),
            )
            db.add(a)

        await db.commit()

        # Create bids for auction2
        for bidder in [buyer1, buyer2]:
            bid = Bid(
                amount=325.00, maxBid=330.00, isProxy=True, isWinning=True,
                auctionId=auction2.id, bidderId=bidder.id,
            )
            db.add(bid)

        await db.commit()

        # Create sold order for PS5
        order = Order(
            orderNumber="EB-2026-417769", totalAmount=440.00, itemAmount=425.00,
            shippingAmount=15.00, status=OrderStatus.PAID,
            auctionId=auction4.id, buyerId=buyer1.id, sellerId=seller3.id,
        )
        db.add(order)
        await db.commit()

        print("Seeding completed!")


if __name__ == "__main__":
    asyncio.run(seed())
