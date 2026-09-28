import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash

from database.app.database import get_db
from database.app.models import TeamMember


JWT_SECRET = os.getenv("AUTH_SECRET_KEY", "")
JWT_ALGORITHM = "HS256"
TOKEN_LIFETIME = timedelta(hours=8)
password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    return password_hash.verify(plain_password, stored_hash)


def hash_password(plain_password: str) -> str:
    return password_hash.hash(plain_password)


def create_access_token(member) -> str:
    if not JWT_SECRET:
        raise RuntimeError("AUTH_SECRET_KEY must be configured.")
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(member.id),
            "email": member.email,
            "name": member.name,
            "role": member.role,
            "iat": now,
            "exp": now + TOKEN_LIFETIME,
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db=Depends(get_db),
):
    if not JWT_SECRET:
        raise HTTPException(status_code=500, detail="Authentication is not configured.")
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign-in required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        member = db.query(TeamMember).filter(TeamMember.id == int(claims["sub"])).first()
        if not member or not member.is_active:
            raise HTTPException(status_code=401, detail="Account is inactive or unavailable.")
        return {"id": member.id, "email": member.email, "name": member.name, "role": member.role}
    except HTTPException:
        raise
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired sign-in token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error


def require_roles(*allowed_roles):
    def dependency(user=Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="You do not have permission for this action.")
        return user

    return dependency