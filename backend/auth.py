# =============================================================================
# JWT Authentication Middleware
# Uses Supabase's own auth API to verify tokens — most reliable approach.
# =============================================================================
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from services.supabase_client import supabase_admin
from typing import Optional

security = HTTPBearer()


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
    Verify the JWT Bearer token by calling Supabase's auth.get_user() API.
    This is the most reliable method — no local key/algorithm issues.
    """
    token = credentials.credentials

    try:
        # Use Supabase admin client to verify the token via their API
        user_response = supabase_admin.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired authentication token",
            )

        user = user_response.user
        user_id = str(user.id)
        email = user.email or ""
        role = (user.user_metadata or {}).get("role", "authenticated")

        return AuthenticatedUser(
            user_id=user_id,
            email=email,
            role=role,
            access_token=token,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Authentication failed: {str(e)}",
        )
