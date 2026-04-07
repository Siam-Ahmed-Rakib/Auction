import json
import urllib.request

from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt, jwk
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.config.settings import settings
from app.models.models import User

# Cache the JWKS keys at module load
_jwks_cache = None


def _get_jwks():
    global _jwks_cache
    if _jwks_cache is None:
        url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        resp = urllib.request.urlopen(url)
        _jwks_cache = json.loads(resp.read())["keys"]
    return _jwks_cache


def _decode_supabase_token(token: str) -> dict:
    """Decode and verify a Supabase JWT access token using JWKS (ES256)."""
    # First try ES256 with JWKS
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        alg = unverified_header.get("alg", "HS256")

        if alg == "ES256" and kid:
            keys = _get_jwks()
            key_data = next((k for k in keys if k["kid"] == kid), None)
            if not key_data:
                raise JWTError("No matching key found in JWKS")
            public_key = jwk.construct(key_data, algorithm="ES256")
            return jwt.decode(
                token,
                public_key,
                algorithms=["ES256"],
                options={"verify_aud": False},
            )
    except JWTError:
        raise
    except Exception:
        pass

    # Fallback to HS256 with JWT secret
    return jwt.decode(
        token,
        settings.SUPABASE_JWT_SECRET,
        algorithms=["HS256"],
        options={"verify_aud": False},
    )


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = auth_header.split(" ")[1]
    try:
        payload = _decode_supabase_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found. Please sync your profile first.")

    return user


async def get_optional_user(request: Request, db: AsyncSession = Depends(get_db)) -> User | None:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    try:
        payload = _decode_supabase_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None
    except JWTError:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
