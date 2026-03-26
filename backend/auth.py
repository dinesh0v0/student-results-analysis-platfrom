# =============================================================================
# JWT Authentication Middleware
# =============================================================================
import base64
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from config import get_settings
from typing import Optional

security = HTTPBearer()
settings = get_settings()


class AuthenticatedUser:
    """Represents a verified authenticated user from Supabase JWT."""

    def __init__(self, user_id: str, email: str, role: str, access_token: str):
        self.user_id = user_id
        self.email = email
        self.role = role
        self.access_token = access_token


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> AuthenticatedUser:
    """
    Verify the JWT Bearer token from Supabase and extract user info.
    Tries both raw and base64-decoded secrets to ensure compatibility.
    """
    token = credentials.credentials
    secret = settings.SUPABASE_JWT_SECRET
    
    # Try decoding with base64-decoded secret first (standard for Supabase)
    # then fallback to raw secret if that fails.
    payload = None
    last_error = None
    
    # List of keys to try
    keys_to_try = []
    try:
        keys_to_try.append(base64.b64decode(secret))
    except Exception:
        pass
    keys_to_try.append(secret)
    
    for key in keys_to_try:
        try:
            payload = jwt.decode(
                token,
                key,
                algorithms=["HS256", "HS384", "HS512"],
                options={"verify_aud": False}  # Temporarily disable aud check to debug if needed
            )
            if payload:
                break
        except JWTError as e:
            last_error = str(e)
            continue
            
    if payload is None:
        raise HTTPException(
            status_code=401,
            detail=f"Authentication failed: {last_error or 'Invalid token'}",
        )

    user_id: Optional[str] = payload.get("sub")
    email: Optional[str] = payload.get("email")
    role: str = payload.get("role", "authenticated")

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token: missing user ID (sub)",
        )

    return AuthenticatedUser(
        user_id=user_id,
        email=email or "",
        role=role,
        access_token=token,
    )

