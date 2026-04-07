from contextlib import asynccontextmanager

import socketio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
