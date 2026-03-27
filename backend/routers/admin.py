from datetime import datetime, timezone
from typing import Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from auth import AuthenticatedUser, get_current_user, require_role
from models.schemas import (
    AdminDashboardStats,
    DashboardFilterOptions,
    DashboardResponse,
    DeleteBatchResponse,
    GradeDistribution,
    HierarchyFilters,
    ResultResponse,
    SectionOverview,
    StudentResponse,
    SubjectPerformance,
    UpdateResultRequest,
    UploadResponse,
)
from services.analytics import (
    calculate_dashboard_stats,
    calculate_grade_distribution,
    calculate_subject_performance,
    get_hierarchy_options,
    get_results_management_rows,
    get_section_overview,
    get_top_performers,
)
from services.data_processor import calculate_grade, parse_upload_file
from services.supabase_client import get_authenticated_client

router = APIRouter(prefix="/api/admin", tags=["Admin"])


def _build_filters(
    campus: Optional[str] = None,
    faculty: Optional[str] = None,
    department: Optional[str] = None,
    branch: Optional[str] = None,
    section: Optional[str] = None,
) -> Dict[str, Optional[str]]:
    return {
        "campus": campus.strip() if campus and campus.strip() else None,
        "faculty": faculty.strip() if faculty and faculty.strip() else None,
        "department": department.strip() if department and department.strip() else None,
        "branch": branch.strip() if branch and branch.strip() else None,
        "section": section.strip() if section and section.strip() else None,
    }


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
    campus: Optional[str] = Query(None),
    faculty: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Get dashboard analytics for the authenticated admin."""
    client = get_authenticated_client(user.access_token)
    institution_id = await _get_institution_id(client, user)
    filters = _build_filters(campus, faculty, department, branch, section)

    stats = calculate_dashboard_stats(client, institution_id, filters)
    grades = calculate_grade_distribution(client, institution_id, filters, semester)
    subjects = calculate_subject_performance(client, institution_id, filters, semester)
    top_students = get_top_performers(client, institution_id, filters, limit=10, semester=semester)
    section_rows = get_section_overview(client, institution_id, filters, semester)
    hierarchy_options = get_hierarchy_options(client, institution_id, filters)

    return DashboardResponse(
        stats=AdminDashboardStats(**stats),
        grade_distribution=[GradeDistribution(**row) for row in grades],
        subject_performance=[SubjectPerformance(**row) for row in subjects],
        top_performers=[StudentResponse(**row) for row in top_students],
        filters=DashboardFilterOptions(**filters, **hierarchy_options),
        section_overview=[SectionOverview(**row) for row in section_rows],
    )


@router.get("/results", response_model=List[ResultResponse])
async def get_results_management(
    semester: Optional[int] = Query(None, ge=1, le=12),
    search: Optional[str] = Query(None),
    campus: Optional[str] = Query(None),
    faculty: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(get_current_user),
):
    client = get_authenticated_client(user.access_token)
    institution_id = await _get_institution_id(client, user)
    filters = _build_filters(campus, faculty, department, branch, section)
    rows = get_results_management_rows(client, institution_id, filters, semester, search)
    return [ResultResponse(**row) for row in rows]


@router.patch("/results/{result_id}", response_model=ResultResponse)
async def update_result(
    result_id: str,
    request: UpdateResultRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    client = get_authenticated_client(user.access_token)
    institution_id = await _get_institution_id(client, user)

    max_marks = request.max_marks or 100.0
    if request.marks_obtained > max_marks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Marks obtained cannot be greater than max marks.",
        )

    grade = (request.grade or calculate_grade(request.marks_obtained, max_marks)).strip().upper()
    pass_status = ((request.marks_obtained / max_marks) * 100) >= 40 if max_marks else False

    try:
        update_resp = (
            client.table("results")
            .update(
                {
                    "marks_obtained": request.marks_obtained,
                    "max_marks": max_marks,
                    "grade": grade,
                    "pass_status": pass_status,
                }
            )
            .eq("id", result_id)
            .eq("institution_id", institution_id)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update the result record.",
        )

    if not update_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result record not found.",
        )

    rows = get_results_management_rows(client, institution_id, {}, None, None, 1000)
    updated_row = next((row for row in rows if row["id"] == result_id), None)
    if not updated_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Updated result record could not be reloaded.",
        )
    return ResultResponse(**updated_row)


@router.delete("/results/{result_id}")
async def delete_result(
    result_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    client = get_authenticated_client(user.access_token)
    institution_id = await _get_institution_id(client, user)

    try:
        existing_resp = (
            client.table("results")
            .select("id")
            .eq("id", result_id)
            .eq("institution_id", institution_id)
            .limit(1)
            .execute()
        )
        if not existing_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Result record not found.",
            )

        client.table("results").delete().eq("id", result_id).eq("institution_id", institution_id).execute()
        return {"deleted": True, "result_id": result_id}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to delete the result record.",
        )


@router.delete("/upload-batches/{batch_id}", response_model=DeleteBatchResponse)
async def delete_upload_batch(
    batch_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    client = get_authenticated_client(user.access_token)
    institution_id = await _get_institution_id(client, user)

    try:
        batch_resp = (
            client.table("upload_batches")
            .select("id")
            .eq("id", batch_id)
            .eq("institution_id", institution_id)
            .limit(1)
            .execute()
        )
        if not batch_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload batch not found.",
            )

        results_resp = (
            client.table("results")
            .select("id")
            .eq("institution_id", institution_id)
            .eq("upload_batch_id", batch_id)
            .execute()
        )
        deleted_results = len(results_resp.data or [])

        client.table("results").delete().eq("institution_id", institution_id).eq("upload_batch_id", batch_id).execute()
        client.table("upload_batches").delete().eq("institution_id", institution_id).eq("id", batch_id).execute()

        return DeleteBatchResponse(deleted_results=deleted_results, deleted_batch_id=batch_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to delete the upload batch.",
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
            {"p_institution_id": institution_id, "p_batch_id": batch_id, "p_rows": rows},
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
    campus: Optional[str] = Query(None),
    faculty: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """List students in the authenticated admin's institution."""
    client = get_authenticated_client(user.access_token)
    institution_id = await _get_institution_id(client, user)
    filters = _build_filters(campus, faculty, department, branch, section)

    try:
        query = _apply_student_filters(
            client.table("students").select(
                "id, register_number, student_name, email, institution_id, campus, faculty, department, branch, section"
            ),
            institution_id,
            filters,
        )
        resp = query.order("student_name").limit(250).execute()
        rows = resp.data or []
        if search and search.strip():
            search_value = search.strip().lower()
            rows = [
                row
                for row in rows
                if search_value in (row.get("register_number") or "").lower()
                or search_value in (row.get("student_name") or "").lower()
            ]
        return rows
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load the student directory.",
        )


def _apply_student_filters(query, institution_id: str, filters: Dict[str, Optional[str]]):
    query = query.eq("institution_id", institution_id)
    for field, value in filters.items():
        if value:
            query = query.eq(field, value)
    return query


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
    rows = get_results_management_rows(client, institution_id, {}, None, student["register_number"], 500)
    rows = [row for row in rows if row.get("register_number") == student["register_number"]]
    return {"student": student, "results": rows}


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
            .limit(50)
            .execute()
        )
        return resp.data or []
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load upload history.",
        )
