from contextlib import asynccontextmanager

import socketio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config.settings import settings
from app.config.socket import sio
from app.routes import auctions, auth, bids, disputes, feedback, notifications, orders, payments, search, users
from app.services.auction_scheduler import check_ended_auctions

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(check_ended_auctions, "interval", seconds=60)
    scheduler.start()
    print("Auction scheduler started")
    yield
    scheduler.shutdown()


app = FastAPI(title="Auction API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(auctions.router)
app.include_router(bids.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(feedback.router)
app.include_router(notifications.router)
app.include_router(users.router)
app.include_router(search.router)
app.include_router(disputes.router)


@app.get("/api/health")
async def health_check():
    from datetime import datetime
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get("/api/debug/db")
async def debug_db():
    """Temporary endpoint to diagnose DB connectivity on Render."""
    from datetime import datetime
    from app.config.database import get_db
    info = {
        "timestamp": datetime.utcnow().isoformat(),
        "db_url_prefix": settings.DATABASE_URL[:50] + "..." if len(settings.DATABASE_URL) > 50 else settings.DATABASE_URL,
        "supabase_url": settings.SUPABASE_URL,
    }
    try:
        async for db in get_db():
            result = await db.execute(select(1))
            info["db_connected"] = True
            info["db_result"] = result.scalar()
    except Exception as e:
        info["db_connected"] = False
        info["db_error"] = f"{type(e).__name__}: {str(e)}"
    return info


# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
