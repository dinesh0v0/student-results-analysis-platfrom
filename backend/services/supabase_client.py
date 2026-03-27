# =============================================================================
# Supabase Client Wrapper
# =============================================================================
from supabase import Client, create_client

from config import get_settings

settings = get_settings()


def _create_client(api_key: str) -> Client:
    return create_client(settings.SUPABASE_URL, api_key)


# Public client (uses anon key — respects RLS)
supabase_public: Client = _create_client(settings.SUPABASE_ANON_KEY)

# Admin client (uses service role key — bypasses RLS)
supabase_admin: Client = _create_client(settings.SUPABASE_SERVICE_ROLE_KEY)


def get_authenticated_client(access_token: str) -> Client:
    """
    Create a Supabase client that sends the caller's JWT to PostgREST.

    This keeps table and RPC requests inside the user's RLS scope instead of
    using the service-role client.
    """
    if not access_token or not access_token.strip():
        raise ValueError("A valid access token is required")

    client = _create_client(settings.SUPABASE_ANON_KEY)
    client.postgrest.auth(access_token.strip())
    return client
