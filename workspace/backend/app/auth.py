import os
from datetime import datetime, timedelta, timezone

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash

from database.app.database import get_db
from database.app.models import TeamMember


# --- Legacy custom-JWT settings (kept for password hashing utilities) ---
JWT_SECRET = os.getenv("AUTH_SECRET_KEY", "")
JWT_ALGORITHM = "HS256"
TOKEN_LIFETIME = timedelta(hours=8)
password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)

# --- Cognito settings ---
COGNITO_REGION = os.getenv("AWS_REGION", os.getenv("COGNITO_REGION", "ap-south-1"))
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_CLIENT_ID = os.getenv("COGNITO_CLIENT_ID", "")

# Role is derived from Cognito groups; highest precedence wins.
GROUP_PRECEDENCE = {"admin": 1, "support": 2, "employee": 3}

_jwks_client: PyJWKClient | None = None


def _cognito_issuer() -> str:
    return f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"


def _get_jwks_client() -> PyJWKClient:
    """Lazily build and cache a JWKS client for the Cognito pool."""
    global _jwks_client
    if _jwks_client is None:
        if not COGNITO_USER_POOL_ID:
            raise HTTPException(status_code=500, detail="Cognito is not configured.")
        _jwks_client = PyJWKClient(f"{_cognito_issuer()}/.well-known/jwks.json")
    return _jwks_client


def _role_from_groups(groups) -> str | None:
    if not groups:
        return None
    known = [g for g in groups if g in GROUP_PRECEDENCE]
    if not known:
        return None
    return sorted(known, key=lambda g: GROUP_PRECEDENCE[g])[0]


# --- Password utilities (still used for any legacy/local flows) ---
def verify_password(plain_password: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    return password_hash.verify(plain_password, stored_hash)


def hash_password(plain_password: str) -> str:
    return password_hash.hash(plain_password)


def create_access_token(member) -> str:
    """Legacy custom token minting. Retained for backward compatibility/tests."""
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
    """Authenticate a request using a Cognito ID token.

    Verifies the token signature against the pool's JWKS, checks issuer/audience,
    and derives the role from the `cognito:groups` claim. The user does not need
    a team_members row to authenticate; email is used for employee isolation.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign-in required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not COGNITO_USER_POOL_ID or not COGNITO_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Authentication is not configured.")

    token = credentials.credentials
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=_cognito_issuer(),
            audience=COGNITO_CLIENT_ID,
            options={"require": ["exp", "iss", "sub"]},
        )
    except jwt.PyJWTError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired sign-in token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    # ID tokens have token_use == "id" and carry email/name. Reject access tokens
    # here since we rely on the email/groups claims that only the ID token has.
    if claims.get("token_use") != "id":
        raise HTTPException(status_code=401, detail="An ID token is required.")

    email = (claims.get("email") or "").lower()
    role = _role_from_groups(claims.get("cognito:groups"))
    if not email or not role:
        raise HTTPException(status_code=403, detail="Account has no email or role group assigned.")

    # Optionally reflect the Cognito identity against team_members (for name/id),
    # but do not require it — Cognito is the source of truth for auth.
    member = db.query(TeamMember).filter(TeamMember.email.ilike(email)).first()
    return {
        "id": member.id if member else None,
        "email": email,
        "name": claims.get("name") or (member.name if member else email),
        "role": role,
    }


def require_roles(*allowed_roles):
    def dependency(user=Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="You do not have permission for this action.")
        return user

    return dependency
