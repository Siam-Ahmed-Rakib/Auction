from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.config.settings import settings
from app.middleware.auth import get_current_user
from app.models.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_token(user_id: str) -> str:
    expire_days = int(settings.JWT_EXPIRES_IN.replace("d", "")) if "d" in settings.JWT_EXPIRES_IN else 7
    expire = datetime.utcnow() + timedelta(days=expire_days)
    return jwt.encode({"userId": user_id, "exp": expire}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


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


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    zipCode: str | None = None
    country: str | None = None
    phone: str | None = None


@router.post("/register", status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if len(body.username) < 3 or len(body.username) > 30:
        raise HTTPException(status_code=400, detail="Username must be 3-30 characters")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    result = await db.execute(
        select(User).where(or_(User.email == body.email, User.username == body.username))
    )
    existing = result.scalar_one_or_none()
    if existing:
        detail = "Email already registered" if existing.email == body.email else "Username taken"
        raise HTTPException(status_code=409, detail=detail)

    hashed = pwd_context.hash(body.password)
    user = User(email=body.email, username=body.username, password=hashed, name=body.name)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_token(user.id)
    return {
        "user": {"id": user.id, "email": user.email, "username": user.username, "name": user.name, "createdAt": user.createdAt.isoformat()},
        "token": token,
    }


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not pwd_context.verify(body.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user.id)
    return {"user": user_to_dict(user), "token": token}


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
