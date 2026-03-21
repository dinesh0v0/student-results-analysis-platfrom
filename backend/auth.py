# =============================================================================
# JWT Authentication Middleware
# =============================================================================
from fastapi import HTTPException, Security, Depends
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
    Raises 401 if the token is invalid or expired.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id: Optional[str] = payload.get("sub")
        email: Optional[str] = payload.get("email")
        role: str = payload.get("role", "authenticated")

        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token: missing user ID",
            )

        return AuthenticatedUser(
            user_id=user_id,
            email=email or "",
            role=role,
            access_token=token,
        )
    except JWTError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid or expired token: {str(e)}",
        )
