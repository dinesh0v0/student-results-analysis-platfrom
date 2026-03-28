from collections import defaultdict, deque
import logging
import time

from fastapi import APIRouter, Depends, HTTPException, status

from auth import AuthenticatedUser, get_current_user, require_role
from models.schemas import ChatRequest, ChatResponse
from services.ai_service import (
    AI_OVERLOADED_MESSAGE,
    admin_chat,
    student_chat,
)
from services.supabase_client import get_authenticated_client

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])
logger = logging.getLogger(__name__)

RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_REQUESTS = 8
_rate_limit_buckets: dict[str, deque[float]] = defaultdict(deque)


def _enforce_rate_limit(user_id: str) -> None:
    now = time.time()
    bucket = _rate_limit_buckets[user_id]
    while bucket and now - bucket[0] > RATE_LIMIT_WINDOW_SECONDS:
        bucket.popleft()

    if len(bucket) >= RATE_LIMIT_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=AI_OVERLOADED_MESSAGE,
        )

    bucket.append(now)


def _store_chat_history(client, user_id: str, institution_id: str, role: str, message: str, response: str) -> None:
    try:
        (
            client.table("chat_history")
            .insert(
                {
                    "user_id": user_id,
                    "institution_id": institution_id,
                    "role": role,
                    "message": message,
                    "response": response,
                }
            )
            .execute()
        )
    except Exception as exc:
        logger.exception("Failed to store %s chat history for user %s: %s", role, user_id, exc)
        return


@router.post("/admin/chat", response_model=ChatResponse)
async def admin_ai_chat(
    request: ChatRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Answer admin questions about institution-scoped academic analytics."""
    require_role(user, "admin")
    _enforce_rate_limit(user.user_id)
    client = get_authenticated_client(user.access_token)

    try:
        institution_resp = (
            client.table("institutions")
            .select("id")
            .eq("admin_user_id", user.user_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.exception("Unable to load admin AI context for user %s: %s", user.user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load institution context for the AI assistant.",
        )

    if not institution_resp.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No institution is linked to this admin account.",
        )

    institution_id = institution_resp.data[0]["id"]
    result = await admin_chat(request.message, institution_id, client)
    logger.info("Admin AI response generated for user %s in institution %s", user.user_id, institution_id)
    _store_chat_history(client, user.user_id, institution_id, "admin", request.message, result["response"])
    return ChatResponse(**result)


@router.post("/student/chat", response_model=ChatResponse)
async def student_ai_chat(
    request: ChatRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Answer student questions about the student's own academic data."""
    require_role(user, "student")
    _enforce_rate_limit(user.user_id)
    client = get_authenticated_client(user.access_token)

    try:
        student_resp = (
            client.table("students")
            .select("id, institution_id")
            .eq("auth_user_id", user.user_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.exception("Unable to load student AI context for user %s: %s", user.user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load student context for the AI assistant.",
        )

    if not student_resp.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No student profile is linked to this account.",
        )

    student = student_resp.data[0]
    result = await student_chat(request.message, student["id"], client)
    logger.info("Student AI response generated for user %s and student %s", user.user_id, student["id"])
    _store_chat_history(
        client,
        user.user_id,
        student["institution_id"],
        "student",
        request.message,
        result["response"],
    )
    return ChatResponse(**result)
