import os

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


COGNITO_REGION = os.getenv("AWS_REGION", os.getenv("COGNITO_REGION", "ap-south-1"))
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_CLIENT_ID = os.getenv("COGNITO_CLIENT_ID", "")

GROUP_PRECEDENCE = {"admin": 1, "support": 2, "employee": 3}
bearer_scheme = HTTPBearer(auto_error=False)

_jwks_client: PyJWKClient | None = None


def _cognito_issuer() -> str:
    return f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"


def _get_jwks_client() -> PyJWKClient:
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


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)):
    """Verify a Cognito ID token at the public API edge and forward it onward."""
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

    if claims.get("token_use") != "id":
        raise HTTPException(status_code=401, detail="An ID token is required.")

    email = (claims.get("email") or "").lower()
    role = _role_from_groups(claims.get("cognito:groups"))
    if not email or not role:
        raise HTTPException(status_code=403, detail="Account has no email or role group assigned.")

    return {
        "id": claims.get("sub"),
        "email": email,
        "name": claims.get("name") or email,
        "role": role,
        "token": token,
    }


def require_roles(*allowed_roles):
    def dependency(user=Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="You do not have permission for this action.")
        return user

    return dependency
