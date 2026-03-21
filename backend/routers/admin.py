# =============================================================================
# Admin Router — Dashboard, Upload, Student Lookup
# =============================================================================
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from auth import get_current_user, AuthenticatedUser
from models.schemas import (
    AdminDashboardStats, DashboardResponse, UploadResponse,
    StudentResponse, GradeDistribution, SubjectPerformance,
)
from services.data_processor import parse_upload_file, calculate_grade
from services.analytics import (
    calculate_dashboard_stats, calculate_grade_distribution,
    calculate_subject_performance, get_top_performers,
)
from services.supabase_client import supabase_admin
from typing import Optional, List
import uuid

router = APIRouter(prefix="/api/admin", tags=["Admin"])


async def _get_institution_id(user: AuthenticatedUser) -> str:
    """Get the institution ID for the authenticated admin user."""
    try:
        resp = supabase_admin.table("institutions") \
            .select("id") \
            .eq("admin_user_id", user.user_id) \
            .single() \
            .execute()
        if not resp.data:
            raise HTTPException(status_code=403, detail="No institution found for this admin")
        return resp.data["id"]
    except Exception as e:
        if "No institution found" in str(e):
            raise
        raise HTTPException(status_code=500, detail=f"Error fetching institution: {str(e)}")


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    semester: Optional[int] = Query(None, ge=1, le=12),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Get comprehensive dashboard data for the admin's institution."""
    try:
        institution_id = await _get_institution_id(user)

        stats = calculate_dashboard_stats(institution_id)
        grades = calculate_grade_distribution(institution_id, semester)
        subjects = calculate_subject_performance(institution_id, semester)
        top = get_top_performers(institution_id, limit=10, semester=semester)

        return DashboardResponse(
            stats=AdminDashboardStats(**stats),
            grade_distribution=[GradeDistribution(**g) for g in grades],
            subject_performance=[SubjectPerformance(**s) for s in subjects],
            top_performers=[StudentResponse(**s) for s in top],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dashboard error: {str(e)}")


@router.post("/upload", response_model=UploadResponse)
async def upload_results(
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Upload and process a CSV/XLSX file of student results."""
    try:
        institution_id = await _get_institution_id(user)

        # Validate file type
        filename = file.filename or "unknown"
        if not filename.lower().endswith((".csv", ".xlsx", ".xls")):
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Please upload a .csv or .xlsx file.",
            )

        # Create upload batch record
        batch_id = str(uuid.uuid4())
        supabase_admin.table("upload_batches").insert({
            "id": batch_id,
            "institution_id": institution_id,
            "file_name": filename,
            "status": "processing",
        }).execute()

        # Parse and validate file
        df, errors = await parse_upload_file(file)

        if df.empty and errors:
            supabase_admin.table("upload_batches").update({
                "status": "failed",
                "records_failed": len(errors),
                "error_log": errors,
            }).eq("id", batch_id).execute()

            return UploadResponse(
                batch_id=batch_id,
                records_processed=0,
                records_failed=len(errors),
                errors=errors[:50],  # Limit error messages
                status="failed",
            )

        records_processed = 0
        records_failed = 0

        # Process each unique student
        students_cache = {}
        subjects_cache = {}

        for idx, row in df.iterrows():
            try:
                reg_no = str(row.get("register_number", "")).strip()
                student_name = str(row.get("student_name", "")).strip()
                semester = int(row.get("semester", 0))
                subject_code = str(row.get("subject_code", "")).strip()
                subject_name = str(row.get("subject_name", subject_code)).strip()
                marks = float(row.get("marks", 0)) if row.get("marks") is not None else None
                max_marks = float(row.get("max_marks", 100))
                grade = str(row.get("grade", "")) if row.get("grade") else None
                pass_status = bool(row.get("pass_status", True))

                # Upsert student
                if reg_no not in students_cache:
                    existing = supabase_admin.table("students") \
                        .select("id") \
                        .eq("institution_id", institution_id) \
                        .eq("register_number", reg_no) \
                        .execute()

                    if existing.data:
                        student_id = existing.data[0]["id"]
                    else:
                        new_student = supabase_admin.table("students").insert({
                            "institution_id": institution_id,
                            "register_number": reg_no,
                            "student_name": student_name,
                        }).execute()
                        student_id = new_student.data[0]["id"]
                    students_cache[reg_no] = student_id
                else:
                    student_id = students_cache[reg_no]

                # Upsert subject
                subj_key = f"{subject_code}_{semester}"
                if subj_key not in subjects_cache:
                    existing_sub = supabase_admin.table("subjects") \
                        .select("id") \
                        .eq("institution_id", institution_id) \
                        .eq("subject_code", subject_code) \
                        .eq("semester", semester) \
                        .execute()

                    if existing_sub.data:
                        subject_id = existing_sub.data[0]["id"]
                    else:
                        new_sub = supabase_admin.table("subjects").insert({
                            "institution_id": institution_id,
                            "subject_code": subject_code,
                            "subject_name": subject_name,
                            "semester": semester,
                            "max_marks": int(max_marks),
                        }).execute()
                        subject_id = new_sub.data[0]["id"]
                    subjects_cache[subj_key] = subject_id
                else:
                    subject_id = subjects_cache[subj_key]

                # Calculate grade if not provided
                if not grade and marks is not None:
                    grade = calculate_grade(marks, max_marks)

                # Upsert result
                supabase_admin.table("results").upsert({
                    "institution_id": institution_id,
                    "student_id": student_id,
                    "subject_id": subject_id,
                    "semester": semester,
                    "marks_obtained": marks,
                    "max_marks": max_marks,
                    "grade": grade,
                    "pass_status": pass_status,
                }, on_conflict="student_id,subject_id,semester").execute()

                records_processed += 1

            except Exception as row_err:
                records_failed += 1
                errors.append(f"Row {idx + 2}: {str(row_err)}")

        # Update batch record
        status = "completed" if records_failed == 0 else "completed"
        supabase_admin.table("upload_batches").update({
            "status": status,
            "records_processed": records_processed,
            "records_failed": records_failed,
            "error_log": errors[:100],
        }).eq("id", batch_id).execute()

        return UploadResponse(
            batch_id=batch_id,
            records_processed=records_processed,
            records_failed=records_failed,
            errors=errors[:50],
            status=status,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")


@router.get("/students", response_model=List[StudentResponse])
async def list_students(
    search: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """List all students or search by register number/name."""
    try:
        institution_id = await _get_institution_id(user)

        query = supabase_admin.table("students") \
            .select("id, register_number, student_name, email, institution_id") \
            .eq("institution_id", institution_id)

        if search:
            query = query.or_(
                f"register_number.ilike.%{search}%,student_name.ilike.%{search}%"
            )

        resp = query.order("student_name").limit(100).execute()
        return resp.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/students/{register_number}", response_model=dict)
async def lookup_student(
    register_number: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Lookup a specific student by register number with their results."""
    try:
        institution_id = await _get_institution_id(user)

        # Find student
        student_resp = supabase_admin.table("students") \
            .select("*") \
            .eq("institution_id", institution_id) \
            .eq("register_number", register_number) \
            .execute()

        if not student_resp.data:
            raise HTTPException(status_code=404, detail="Student not found")

        student = student_resp.data[0]

        # Get results
        results_resp = supabase_admin.table("results") \
            .select("*, subjects(subject_code, subject_name)") \
            .eq("student_id", student["id"]) \
            .order("semester") \
            .execute()

        results = []
        for r in (results_resp.data or []):
            sub = r.get("subjects", {}) or {}
            results.append({
                "id": r["id"],
                "student_id": r["student_id"],
                "subject_code": sub.get("subject_code", "N/A"),
                "subject_name": sub.get("subject_name", "N/A"),
                "semester": r["semester"],
                "marks_obtained": r.get("marks_obtained"),
                "max_marks": r.get("max_marks", 100),
                "grade": r.get("grade"),
                "pass_status": r.get("pass_status", False),
            })

        return {"student": student, "results": results}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/upload-history")
async def get_upload_history(
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Get the upload batch history for the admin's institution."""
    try:
        institution_id = await _get_institution_id(user)
        resp = supabase_admin.table("upload_batches") \
            .select("*") \
            .eq("institution_id", institution_id) \
            .order("uploaded_at", desc=True) \
            .limit(20) \
            .execute()
        return resp.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
