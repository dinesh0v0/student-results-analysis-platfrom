# =============================================================================
# AI Assistant Router
# =============================================================================
from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user, AuthenticatedUser
from models.schemas import ChatRequest, ChatResponse
from services.ai_service import admin_chat, student_chat
from services.supabase_client import supabase_admin

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])


@router.post("/admin/chat", response_model=ChatResponse)
async def admin_ai_chat(
    request: ChatRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Admin AI assistant — answers questions about institutional data."""
    try:
        # Get institution ID
        inst_resp = supabase_admin.table("institutions") \
            .select("id") \
            .eq("admin_user_id", user.user_id) \
            .single() \
            .execute()

        if not inst_resp.data:
            raise HTTPException(status_code=403, detail="No institution found")

        institution_id = inst_resp.data["id"]
        result = await admin_chat(request.message, institution_id)
        return ChatResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")


@router.post("/student/chat", response_model=ChatResponse)
async def student_ai_chat(
    request: ChatRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Student AI assistant — answers questions about the student's own data only."""
    try:
        # Get student record
        student_resp = supabase_admin.table("students") \
            .select("id, institution_id") \
            .eq("auth_user_id", user.user_id) \
            .single() \
            .execute()

        if not student_resp.data:
            raise HTTPException(status_code=403, detail="No student profile found")

        student_id = student_resp.data["id"]
        institution_id = student_resp.data["institution_id"]

        result = await student_chat(request.message, student_id, institution_id)
        return ChatResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")
