from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.config.settings import settings
from app.middleware.auth import get_current_user, _decode_supabase_token
from app.models.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_to_dict(user: User, include_private: bool = False) -> dict:
    d = {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "name": user.name,
        "rating": user.rating,
        "totalRatings": user.totalRatings,
        "positiveRate": user.positiveRate,
        "avatarUrl": user.avatarUrl,
    }
    if include_private:
        d.update({
            "address": user.address,
            "city": user.city,
            "state": user.state,
            "zipCode": user.zipCode,
            "country": user.country,
            "phone": user.phone,
            "createdAt": user.createdAt.isoformat() if user.createdAt else None,
        })
    return d


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    username: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    zipCode: str | None = None
    country: str | None = None
    phone: str | None = None


@router.post("/sync")
async def sync_user(request: Request, db: AsyncSession = Depends(get_db)):
    """Sync a Supabase-authenticated user to the application database.
    Creates the User row if it doesn't exist, returns the user profile."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        print(f"[AUTH SYNC] No Bearer token. Auth header: '{auth_header[:30] if auth_header else 'EMPTY'}'")
        raise HTTPException(status_code=401, detail="Authentication required")

    token = auth_header.split(" ")[1]
    try:
        payload = _decode_supabase_token(token)
    except JWTError as e:
        print(f"[AUTH SYNC] JWT decode error: {e}")
        print(f"[AUTH SYNC] Token prefix: {token[:50]}...")
        print(f"[AUTH SYNC] Secret: {settings.SUPABASE_JWT_SECRET[:10]}...")
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)}")
    except Exception as e:
        print(f"[AUTH SYNC] Unexpected error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=401, detail=f"Token error: {str(e)}")

    sub = payload.get("sub")
    email = payload.get("email", "")
    user_metadata = payload.get("user_metadata", {})
    name = user_metadata.get("name") or user_metadata.get("full_name") or email.split("@")[0]
    username = user_metadata.get("username") or email.split("@")[0]
    avatar = user_metadata.get("avatar_url") or user_metadata.get("picture")
    provider = payload.get("app_metadata", {}).get("provider", "email")

    if not sub or not email:
        raise HTTPException(status_code=401, detail="Invalid token claims")

    # Check if user already exists
    result = await db.execute(select(User).where(User.id == sub))
    user = result.scalar_one_or_none()

    if user:
        # Update provider info if changed
        if avatar and not user.avatarUrl:
            user.avatarUrl = avatar
        if provider != "email" and user.authProvider == "local":
            user.authProvider = provider
        await db.commit()
        await db.refresh(user)
        return user_to_dict(user, include_private=True)

    # Ensure unique username
    base_username = username
    counter = 1
    while True:
        check = await db.execute(select(User).where(User.username == username))
        if not check.scalar_one_or_none():
            break
        username = f"{base_username}{counter}"
        counter += 1

    user = User(
        id=sub,
        email=email,
        username=username,
        name=name,
        authProvider=provider,
        avatarUrl=avatar,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user_to_dict(user, include_private=True)


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return user_to_dict(user, include_private=True)


@router.put("/me")
async def update_profile(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    user.updatedAt = datetime.utcnow()
    await db.commit()
    await db.refresh(user)
    return user_to_dict(user, include_private=True)
