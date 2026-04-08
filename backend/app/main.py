from contextlib import asynccontextmanager
import traceback

import socketio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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


app = FastAPI(title="Auction API", lifespan=lifespan, redirect_slashes=False)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print(f"Unhandled error on {request.method} {request.url}: {exc}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
