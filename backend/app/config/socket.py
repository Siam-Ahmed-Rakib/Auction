import socketio

from app.config.settings import settings

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
)


@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")


@sio.event
async def join_auction(sid, auction_id):
    await sio.enter_room(sid, f"auction:{auction_id}")
    print(f"[Socket] {sid} joined auction room: auction:{auction_id}")


@sio.event
async def leave_auction(sid, auction_id):
    await sio.leave_room(sid, f"auction:{auction_id}")


@sio.event
async def join_user(sid, user_id):
    await sio.enter_room(sid, f"user:{user_id}")
    print(f"[Socket] {sid} joined user room: user:{user_id}")


# Also handle hyphenated event names for Socket.IO client compatibility
@sio.on("join-auction")
async def join_auction_hyphen(sid, auction_id):
    await sio.enter_room(sid, f"auction:{auction_id}")
    print(f"[Socket] {sid} joined auction room: auction:{auction_id}")


@sio.on("leave-auction")
async def leave_auction_hyphen(sid, auction_id):
    await sio.leave_room(sid, f"auction:{auction_id}")


@sio.on("join-user")
async def join_user_hyphen(sid, user_id):
    await sio.enter_room(sid, f"user:{user_id}")
    print(f"[Socket] {sid} joined user room: user:{user_id}")
