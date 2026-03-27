# =============================================================================
# JWT Authentication Middleware
# Uses Supabase's own auth API to verify tokens — most reliable approach.
# =============================================================================
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from services.supabase_client import supabase_admin

security = HTTPBearer(auto_error=False)
VALID_ROLES = {"admin", "student"}


class AuthenticatedUser:
    """Represents a verified authenticated user from Supabase JWT."""

    def __init__(self, user_id: str, email: str, role: str, access_token: str):
        self.user_id = user_id
        self.email = email
        self.role = role
        self.access_token = access_token


def require_role(user: AuthenticatedUser, *roles: str) -> AuthenticatedUser:
    """Ensure the authenticated user has one of the required roles."""
    if user.role not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this resource.",
        )
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> AuthenticatedUser:
    """
    Verify the JWT Bearer token by calling Supabase's auth.get_user() API.
    This is the most reliable method — no local key/algorithm issues.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )

    token = credentials.credentials.strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )

    try:
        user_response = supabase_admin.auth.get_user(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        )

    if not user_response or not user_response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        )

    user = user_response.user
    metadata = user.user_metadata or {}
    role = metadata.get("role")

    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not authorized for the platform.",
        )

    return AuthenticatedUser(
        user_id=str(user.id),
        email=user.email or "",
        role=role,
        access_token=token,
    )
