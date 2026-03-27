from datetime import datetime, timezone
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from auth import AuthenticatedUser, get_current_user, require_role
from models.schemas import (
    AdminDashboardStats,
    DashboardResponse,
    GradeDistribution,
    StudentResponse,
    SubjectPerformance,
    UploadResponse,
)
from services.analytics import (
    calculate_dashboard_stats,
    calculate_grade_distribution,
    calculate_subject_performance,
    get_top_performers,
)
from services.data_processor import parse_upload_file
from services.supabase_client import get_authenticated_client

router = APIRouter(prefix="/api/admin", tags=["Admin"])


async def _get_institution_id(client, user: AuthenticatedUser) -> str:
    require_role(user, "admin")
    try:
        resp = (
            client.table("institutions")
            .select("id")
            .eq("admin_user_id", user.user_id)
            .limit(1)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load the admin institution.",
        )

    if not resp.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No institution is linked to this admin account.",
        )
    return resp.data[0]["id"]


def _safe_update_batch(client, batch_id: str, payload: dict) -> None:
    try:
        client.table("upload_batches").update(payload).eq("id", batch_id).execute()
    except Exception:
        return


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    semester: Optional[int] = Query(None, ge=1, le=12),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Get dashboard analytics for the authenticated admin."""
    client = get_authenticated_client(user.access_token)
    institution_id = await _get_institution_id(client, user)

    stats = calculate_dashboard_stats(client, institution_id)
    grades = calculate_grade_distribution(client, institution_id, semester)
    subjects = calculate_subject_performance(client, institution_id, semester)
    top_students = get_top_performers(client, institution_id, limit=10, semester=semester)

    return DashboardResponse(
        stats=AdminDashboardStats(**stats),
        grade_distribution=[GradeDistribution(**row) for row in grades],
        subject_performance=[SubjectPerformance(**row) for row in subjects],
        top_performers=[StudentResponse(**row) for row in top_students],
    )


@router.post("/upload", response_model=UploadResponse)
async def upload_results(
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Upload and atomically process a validated CSV/XLSX results file."""
    client = get_authenticated_client(user.access_token)
    institution_id = await _get_institution_id(client, user)
    filename = (file.filename or "upload").strip()

    if not filename.lower().endswith((".csv", ".xlsx")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload a .csv or .xlsx file.",
        )

    batch_id = str(uuid.uuid4())
    try:
        client.table("upload_batches").insert(
            {
                "id": batch_id,
                "institution_id": institution_id,
                "file_name": filename,
                "status": "processing",
            }
        ).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create the upload batch record.",
        )

    rows, errors = await parse_upload_file(file)
    if errors:
        _safe_update_batch(
            client,
            batch_id,
            {
                "status": "failed",
                "records_processed": 0,
                "records_failed": len(errors),
                "error_log": errors[:100],
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        return UploadResponse(
            batch_id=batch_id,
            records_processed=0,
            records_failed=len(errors),
            errors=errors[:50],
            status="failed",
        )

    try:
        rpc_resp = client.rpc(
            "process_result_upload_batch",
            {"p_institution_id": institution_id, "p_rows": rows},
        ).execute()
        result = rpc_resp.data or {}
        records_processed = int(result.get("records_processed", len(rows)))
    except Exception:
        upload_errors = [
            "The upload could not be saved. No records were imported and the batch was rolled back."
        ]
        _safe_update_batch(
            client,
            batch_id,
            {
                "status": "failed",
                "records_processed": 0,
                "records_failed": len(rows),
                "error_log": upload_errors,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=upload_errors[0],
        )

    _safe_update_batch(
        client,
        batch_id,
        {
            "status": "completed",
            "records_processed": records_processed,
            "records_failed": 0,
            "error_log": [],
            "completed_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    return UploadResponse(
        batch_id=batch_id,
        records_processed=records_processed,
        records_failed=0,
        errors=[],
        status="completed",
    )


@router.get("/students", response_model=List[StudentResponse])
async def list_students(
    search: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """List students in the authenticated admin's institution."""
    client = get_authenticated_client(user.access_token)
    institution_id = await _get_institution_id(client, user)

    try:
        query = (
            client.table("students")
            .select("id, register_number, student_name, email, institution_id")
            .eq("institution_id", institution_id)
        )
        if search and search.strip():
            search_term = search.strip()
            query = query.or_(
                f"register_number.ilike.%{search_term}%,student_name.ilike.%{search_term}%"
            )

        resp = query.order("student_name").limit(100).execute()
        return resp.data or []
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load the student directory.",
        )


@router.get("/students/{register_number}", response_model=dict)
async def lookup_student(
    register_number: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Lookup a student and their results inside the admin's institution."""
    client = get_authenticated_client(user.access_token)
    institution_id = await _get_institution_id(client, user)

    try:
        student_resp = (
            client.table("students")
            .select("*")
            .eq("institution_id", institution_id)
            .eq("register_number", register_number.strip().upper())
            .limit(1)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load the student profile.",
        )

    if not student_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found.",
        )

    student = student_resp.data[0]

    try:
        results_resp = (
            client.table("results")
            .select("*, subjects(subject_code, subject_name)")
            .eq("student_id", student["id"])
            .order("semester")
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load the student's academic results.",
        )

    results = []
    for row in results_resp.data or []:
        subject = row.get("subjects", {}) or {}
        results.append(
            {
                "id": row["id"],
                "student_id": row["student_id"],
                "subject_code": subject.get("subject_code", "N/A"),
                "subject_name": subject.get("subject_name", "N/A"),
                "semester": row["semester"],
                "marks_obtained": row.get("marks_obtained"),
                "max_marks": row.get("max_marks", 100),
                "grade": row.get("grade"),
                "pass_status": row.get("pass_status", False),
            }
        )

    return {"student": student, "results": results}


@router.get("/upload-history")
async def get_upload_history(user: AuthenticatedUser = Depends(get_current_user)):
    """Get upload history for the authenticated admin."""
    client = get_authenticated_client(user.access_token)
    institution_id = await _get_institution_id(client, user)

    try:
        resp = (
            client.table("upload_batches")
            .select("*")
            .eq("institution_id", institution_id)
            .order("uploaded_at", desc=True)
            .limit(20)
            .execute()
        )
        return resp.data or []
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load upload history.",
        )
