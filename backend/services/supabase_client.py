# =============================================================================
# Supabase Client Wrapper
# =============================================================================
from supabase import create_client, Client
from config import get_settings

settings = get_settings()

# Public client (uses anon key — respects RLS)
supabase_public: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_ANON_KEY
)

# Admin client (uses service role key — bypasses RLS)
supabase_admin: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY
)


def get_authenticated_client(access_token: str) -> Client:
    """
    Creates a Supabase client authenticated with the user's JWT.
    This ensures all queries respect RLS policies scoped to the user.
    """
    client: Client = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,
    )
    client.auth.set_session(access_token, "")
    return client
