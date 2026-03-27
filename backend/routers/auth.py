from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from auth import AuthenticatedUser, get_current_user, require_role
from models.schemas import (
    AdminRegisterRequest,
    AuthResponse,
    InstitutionResponse,
    LoginRequest,
    SessionResponse,
    StudentRegisterRequest,
    StudentVerifyRequest,
)
from services.supabase_client import (
    get_authenticated_client,
    supabase_admin,
    supabase_public,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _delete_auth_user(user_id: str) -> None:
    try:
        supabase_admin.auth.admin.delete_user(user_id)
    except Exception:
        return


@router.get("/me", response_model=SessionResponse)
async def get_session(user: AuthenticatedUser = Depends(get_current_user)):
    """Validate the current JWT and return the linked session details."""
    client = get_authenticated_client(user.access_token)

    if user.role == "admin":
        require_role(user, "admin")
        institution_resp = (
            client.table("institutions")
            .select("id")
            .eq("admin_user_id", user.user_id)
            .single()
            .execute()
        )
        if not institution_resp.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin account is not linked to an institution.",
            )

        return SessionResponse(
            user_id=user.user_id,
            email=user.email,
            role=user.role,
            institution_id=institution_resp.data["id"],
        )

    require_role(user, "student")
    student_resp = (
        client.table("students")
        .select("id, institution_id")
        .eq("auth_user_id", user.user_id)
        .single()
        .execute()
    )
    if not student_resp.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student account is not linked to a student record.",
        )

    return SessionResponse(
        user_id=user.user_id,
        email=user.email,
        role=user.role,
        institution_id=student_resp.data["institution_id"],
        student_id=student_resp.data["id"],
    )


@router.post("/admin/register", response_model=AuthResponse)
async def register_admin(request: AdminRegisterRequest):
    """Register a new admin and institution."""
    created_user_id: str | None = None

    try:
        auth_resp = supabase_admin.auth.admin.create_user(
            {
                "email": request.email,
                "password": request.password,
                "email_confirm": True,
                "user_metadata": {
                    "role": "admin",
                    "institution_name": request.institution_name,
                },
            }
        )
        created_user_id = str(auth_resp.user.id)
    except Exception as exc:
        error_message = str(exc).lower()
        if "already" in error_message or "duplicate" in error_message:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create the admin account right now.",
        )

    try:
        institution_resp = (
            supabase_admin.table("institutions")
            .insert(
                {
                    "name": request.institution_name.strip(),
                    "email": request.email,
                    "admin_user_id": created_user_id,
                }
            )
            .execute()
        )
        institution_id = institution_resp.data[0]["id"]
    except Exception as exc:
        _delete_auth_user(created_user_id)
        error_message = str(exc).lower()
        if "already" in error_message or "duplicate" in error_message:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An institution with this email already exists.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create the institution record.",
        )

    try:
        sign_in = supabase_public.auth.sign_in_with_password(
            {"email": request.email, "password": request.password}
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account created, but automatic sign-in failed. Please log in manually.",
        )

    return AuthResponse(
        access_token=sign_in.session.access_token,
        user_id=created_user_id,
        email=request.email,
        role="admin",
        institution_id=institution_id,
    )


@router.post("/admin/login", response_model=AuthResponse)
async def login_admin(request: LoginRequest):
    """Login an admin user."""
    try:
        sign_in = supabase_public.auth.sign_in_with_password(
            {"email": request.email, "password": request.password}
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user = sign_in.user
    role = (user.user_metadata or {}).get("role")
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not authorized for the admin portal.",
        )

    institution_resp = (
        supabase_admin.table("institutions")
        .select("id")
        .eq("admin_user_id", str(user.id))
        .single()
        .execute()
    )
    if not institution_resp.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No institution is linked to this admin account.",
        )

    return AuthResponse(
        access_token=sign_in.session.access_token,
        user_id=str(user.id),
        email=request.email,
        role="admin",
        institution_id=institution_resp.data["id"],
    )


@router.post("/student/verify")
async def verify_student(request: StudentVerifyRequest):
    """Verify that a student record is eligible for account registration."""
    register_number = request.register_number.strip().upper()

    try:
        student_resp = (
            supabase_admin.table("students")
            .select("id, student_name, register_number, auth_user_id")
            .eq("institution_id", request.institution_id)
            .eq("register_number", register_number)
            .limit(1)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to verify the student record right now.",
        )

    if not student_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found for this institution.",
        )

    student = student_resp.data[0]
    if student.get("auth_user_id"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This student record is already linked to an account.",
        )

    return {
        "verified": True,
        "student_id": student["id"],
        "student_name": student["student_name"],
        "register_number": student["register_number"],
    }


@router.post("/student/register", response_model=AuthResponse)
async def register_student(request: StudentRegisterRequest):
    """Register a student account and link it to an existing student record."""
    register_number = request.register_number.strip().upper()
    created_user_id: str | None = None

    student_resp = (
        supabase_admin.table("students")
        .select("id, student_name, institution_id, auth_user_id")
        .eq("institution_id", request.institution_id)
        .eq("register_number", register_number)
        .limit(1)
        .execute()
    )

    if not student_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found. Please verify your register number first.",
        )

    student = student_resp.data[0]
    if student.get("auth_user_id"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This student record is already linked to an account.",
        )

    try:
        auth_resp = supabase_admin.auth.admin.create_user(
            {
                "email": request.email,
                "password": request.password,
                "email_confirm": True,
                "user_metadata": {
                    "role": "student",
                    "register_number": register_number,
                    "student_name": student["student_name"],
                },
            }
        )
        created_user_id = str(auth_resp.user.id)
    except Exception as exc:
        error_message = str(exc).lower()
        if "already" in error_message or "duplicate" in error_message:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create the student account right now.",
        )

    try:
        (
            supabase_admin.table("students")
            .update({"auth_user_id": created_user_id, "email": request.email})
            .eq("id", student["id"])
            .execute()
        )
    except Exception:
        _delete_auth_user(created_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to link the student account to the academic record.",
        )

    try:
        sign_in = supabase_public.auth.sign_in_with_password(
            {"email": request.email, "password": request.password}
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account created, but automatic sign-in failed. Please log in manually.",
        )

    return AuthResponse(
        access_token=sign_in.session.access_token,
        user_id=created_user_id,
        email=request.email,
        role="student",
        institution_id=student["institution_id"],
        student_id=student["id"],
    )


@router.post("/student/login", response_model=AuthResponse)
async def login_student(request: LoginRequest):
    """Login a student user."""
    try:
        sign_in = supabase_public.auth.sign_in_with_password(
            {"email": request.email, "password": request.password}
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user = sign_in.user
    role = (user.user_metadata or {}).get("role")
    if role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not authorized for the student portal.",
        )

    student_resp = (
        supabase_admin.table("students")
        .select("id, institution_id")
        .eq("auth_user_id", str(user.id))
        .single()
        .execute()
    )
    if not student_resp.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No student record is linked to this account.",
        )

    return AuthResponse(
        access_token=sign_in.session.access_token,
        user_id=str(user.id),
        email=request.email,
        role="student",
        institution_id=student_resp.data["institution_id"],
        student_id=student_resp.data["id"],
    )


@router.get("/institutions", response_model=List[InstitutionResponse])
async def list_institutions():
    """List institutions for the student registration flow."""
    try:
        resp = supabase_admin.table("institutions").select("id, name, email").order("name").execute()
        return resp.data or []
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load institutions right now.",
        )
