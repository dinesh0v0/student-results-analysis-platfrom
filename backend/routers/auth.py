# =============================================================================
# Auth Router — Registration & Login
# =============================================================================
from fastapi import APIRouter, HTTPException
from models.schemas import (
    AdminRegisterRequest, StudentRegisterRequest,
    StudentVerifyRequest, LoginRequest, AuthResponse,
    InstitutionResponse,
)
from services.supabase_client import supabase_admin, supabase_public
from typing import List

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/admin/register", response_model=AuthResponse)
async def register_admin(request: AdminRegisterRequest):
    """Register a new admin with their institution."""
    try:
        # Create Supabase auth user
        auth_resp = supabase_admin.auth.admin.create_user({
            "email": request.email,
            "password": request.password,
            "email_confirm": True,
            "user_metadata": {
                "role": "admin",
                "institution_name": request.institution_name,
            },
        })

        user_id = auth_resp.user.id

        # Create institution record
        inst_resp = supabase_admin.table("institutions").insert({
            "name": request.institution_name,
            "email": request.email,
            "admin_user_id": user_id,
        }).execute()

        institution_id = inst_resp.data[0]["id"]

        # Sign in to get tokens
        sign_in = supabase_public.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })

        return AuthResponse(
            access_token=sign_in.session.access_token,
            user_id=user_id,
            email=request.email,
            role="admin",
            institution_id=institution_id,
        )
    except Exception as e:
        error_msg = str(e)
        if "already" in error_msg.lower() or "duplicate" in error_msg.lower():
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        raise HTTPException(status_code=500, detail=f"Registration failed: {error_msg}")


@router.post("/admin/login", response_model=AuthResponse)
async def login_admin(request: LoginRequest):
    """Login an admin user."""
    try:
        sign_in = supabase_public.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })

        user_id = sign_in.user.id

        # Get institution
        inst_resp = supabase_admin.table("institutions") \
            .select("id") \
            .eq("admin_user_id", user_id) \
            .single() \
            .execute()

        if not inst_resp.data:
            raise HTTPException(status_code=403, detail="No institution found for this account. Are you an admin?")

        return AuthResponse(
            access_token=sign_in.session.access_token,
            user_id=user_id,
            email=request.email,
            role="admin",
            institution_id=inst_resp.data["id"],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid email or password")


@router.post("/student/verify")
async def verify_student(request: StudentVerifyRequest):
    """Check if a roll number exists in an institution's database."""
    try:
        resp = supabase_admin.table("students") \
            .select("id, register_number, student_name") \
            .eq("institution_id", request.institution_id) \
            .eq("register_number", request.register_number) \
            .execute()

        if not resp.data:
            raise HTTPException(
                status_code=404,
                detail="Roll number not found in this institution's database"
            )

        student = resp.data[0]
        return {
            "verified": True,
            "student_id": student["id"],
            "student_name": student["student_name"],
            "register_number": student["register_number"],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification error: {str(e)}")


@router.post("/student/register", response_model=AuthResponse)
async def register_student(request: StudentRegisterRequest):
    """Register a student after verification."""
    try:
        # Verify the student exists
        student_resp = supabase_admin.table("students") \
            .select("id, student_name") \
            .eq("institution_id", request.institution_id) \
            .eq("register_number", request.register_number) \
            .execute()

        if not student_resp.data:
            raise HTTPException(
                status_code=404,
                detail="Roll number not found. Please verify first."
            )

        student = student_resp.data[0]

        # Check if already registered
        if student_resp.data[0].get("auth_user_id"):
            # Check via a separate query
            pass

        existing_check = supabase_admin.table("students") \
            .select("auth_user_id") \
            .eq("id", student["id"]) \
            .single() \
            .execute()

        if existing_check.data and existing_check.data.get("auth_user_id"):
            raise HTTPException(
                status_code=409,
                detail="This roll number is already registered with an account"
            )

        # Create auth user
        auth_resp = supabase_admin.auth.admin.create_user({
            "email": request.email,
            "password": request.password,
            "email_confirm": True,
            "user_metadata": {
                "role": "student",
                "register_number": request.register_number,
                "student_name": student["student_name"],
            },
        })

        user_id = auth_resp.user.id

        # Link student record to auth user
        supabase_admin.table("students") \
            .update({
                "auth_user_id": user_id,
                "email": request.email,
            }) \
            .eq("id", student["id"]) \
            .execute()

        # Sign in
        sign_in = supabase_public.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })

        return AuthResponse(
            access_token=sign_in.session.access_token,
            user_id=user_id,
            email=request.email,
            role="student",
            institution_id=request.institution_id,
            student_id=student["id"],
        )
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "already" in error_msg.lower() or "duplicate" in error_msg.lower():
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        raise HTTPException(status_code=500, detail=f"Registration error: {error_msg}")


@router.post("/student/login", response_model=AuthResponse)
async def login_student(request: LoginRequest):
    """Login a student user."""
    try:
        sign_in = supabase_public.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })

        user_id = sign_in.user.id

        # Get student record
        student_resp = supabase_admin.table("students") \
            .select("id, institution_id") \
            .eq("auth_user_id", user_id) \
            .single() \
            .execute()

        if not student_resp.data:
            raise HTTPException(status_code=403, detail="No student profile found for this account")

        return AuthResponse(
            access_token=sign_in.session.access_token,
            user_id=user_id,
            email=request.email,
            role="student",
            institution_id=student_resp.data["institution_id"],
            student_id=student_resp.data["id"],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid email or password")


@router.get("/institutions", response_model=List[InstitutionResponse])
async def list_institutions():
    """List all institutions (for student registration dropdown)."""
    try:
        resp = supabase_admin.table("institutions") \
            .select("id, name, email") \
            .order("name") \
            .execute()
        return resp.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
