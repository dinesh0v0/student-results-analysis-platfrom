# =============================================================================
# Student Router — Results, History, PDF Report
# =============================================================================
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from auth import get_current_user, AuthenticatedUser
from models.schemas import (
    ResultResponse, SemesterSummary, AcademicHistory, StudentResponse
)
from services.supabase_client import supabase_admin
from services.pdf_generator import generate_student_report
from typing import Optional, List, Dict

router = APIRouter(prefix="/api/student", tags=["Student"])


async def _get_student_record(user: AuthenticatedUser) -> Dict:
    """Get the student record for the authenticated user."""
    try:
        resp = supabase_admin.table("students") \
            .select("*") \
            .eq("auth_user_id", user.user_id) \
            .single() \
            .execute()
        if not resp.data:
            raise HTTPException(status_code=403, detail="No student profile found")
        return resp.data
    except Exception as e:
        if "No student profile" in str(e):
            raise
        raise HTTPException(status_code=500, detail=f"Error fetching student: {str(e)}")


@router.get("/profile", response_model=StudentResponse)
async def get_profile(user: AuthenticatedUser = Depends(get_current_user)):
    """Get the current student's profile."""
    try:
        student = await _get_student_record(user)
        return StudentResponse(
            id=student["id"],
            register_number=student["register_number"],
            student_name=student["student_name"],
            email=student.get("email"),
            institution_id=student["institution_id"],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/results", response_model=List[ResultResponse])
async def get_results(
    semester: Optional[int] = Query(None, ge=1, le=12),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Get the current student's results, optionally filtered by semester."""
    try:
        student = await _get_student_record(user)

        query = supabase_admin.table("results") \
            .select("*, subjects(subject_code, subject_name)") \
            .eq("student_id", student["id"])

        if semester:
            query = query.eq("semester", semester)

        resp = query.order("semester").execute()
        results = []
        for r in (resp.data or []):
            sub = r.get("subjects", {}) or {}
            results.append(ResultResponse(
                id=r["id"],
                student_id=r["student_id"],
                subject_code=sub.get("subject_code", "N/A"),
                subject_name=sub.get("subject_name", "N/A"),
                semester=r["semester"],
                marks_obtained=r.get("marks_obtained"),
                max_marks=r.get("max_marks", 100),
                grade=r.get("grade"),
                pass_status=r.get("pass_status", False),
            ))
        return results
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/history", response_model=AcademicHistory)
async def get_academic_history(user: AuthenticatedUser = Depends(get_current_user)):
    """Get the full academic history with semester-wise summaries."""
    try:
        student = await _get_student_record(user)

        # Get all results
        resp = supabase_admin.table("results") \
            .select("*, subjects(subject_code, subject_name)") \
            .eq("student_id", student["id"]) \
            .order("semester") \
            .execute()

        results_data = resp.data or []

        # Build result responses
        results = []
        by_semester: Dict[int, list] = {}

        for r in results_data:
            sub = r.get("subjects", {}) or {}
            result = ResultResponse(
                id=r["id"],
                student_id=r["student_id"],
                subject_code=sub.get("subject_code", "N/A"),
                subject_name=sub.get("subject_name", "N/A"),
                semester=r["semester"],
                marks_obtained=r.get("marks_obtained"),
                max_marks=r.get("max_marks", 100),
                grade=r.get("grade"),
                pass_status=r.get("pass_status", False),
            )
            results.append(result)

            sem = r["semester"]
            if sem not in by_semester:
                by_semester[sem] = []
            by_semester[sem].append(r)

        # Calculate semester summaries
        semesters = []
        for sem_num in sorted(by_semester.keys()):
            sem_results = by_semester[sem_num]
            total = len(sem_results)
            passed = sum(1 for r in sem_results if r.get("pass_status"))
            failed = total - passed

            total_marks = sum(
                float(r.get("marks_obtained", 0) or 0)
                for r in sem_results
            )
            total_max = sum(
                float(r.get("max_marks", 100) or 100)
                for r in sem_results
            )
            pct = round(total_marks / total_max * 100, 2) if total_max > 0 else 0

            # Simple GPA calculation (10-point scale)
            gpa = round(pct / 10, 2) if pct > 0 else 0

            semesters.append(SemesterSummary(
                semester=sem_num,
                total_subjects=total,
                passed=passed,
                failed=failed,
                percentage=pct,
                gpa=gpa,
            ))

        return AcademicHistory(
            student=StudentResponse(
                id=student["id"],
                register_number=student["register_number"],
                student_name=student["student_name"],
                email=student.get("email"),
                institution_id=student["institution_id"],
            ),
            semesters=semesters,
            results=results,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/report/pdf")
async def download_pdf_report(user: AuthenticatedUser = Depends(get_current_user)):
    """Download a PDF report of the student's academic history."""
    try:
        student = await _get_student_record(user)

        # Get institution name
        inst_resp = supabase_admin.table("institutions") \
            .select("name") \
            .eq("id", student["institution_id"]) \
            .single() \
            .execute()
        institution_name = inst_resp.data.get("name", "Institution") if inst_resp.data else "Institution"

        # Get results
        resp = supabase_admin.table("results") \
            .select("*, subjects(subject_code, subject_name)") \
            .eq("student_id", student["id"]) \
            .order("semester") \
            .execute()

        results_data = resp.data or []

        # Format results
        results = []
        by_semester: Dict[int, list] = {}
        for r in results_data:
            sub = r.get("subjects", {}) or {}
            formatted = {
                "subject_code": sub.get("subject_code", "N/A"),
                "subject_name": sub.get("subject_name", "N/A"),
                "semester": r["semester"],
                "marks_obtained": r.get("marks_obtained", 0),
                "max_marks": r.get("max_marks", 100),
                "grade": r.get("grade", "N/A"),
                "pass_status": r.get("pass_status", False),
            }
            results.append(formatted)

            sem = r["semester"]
            if sem not in by_semester:
                by_semester[sem] = []
            by_semester[sem].append(r)

        # Semester summaries for PDF
        semesters = []
        for sem_num in sorted(by_semester.keys()):
            sem_results = by_semester[sem_num]
            total = len(sem_results)
            passed = sum(1 for r in sem_results if r.get("pass_status"))
            total_marks = sum(float(r.get("marks_obtained", 0) or 0) for r in sem_results)
            total_max = sum(float(r.get("max_marks", 100) or 100) for r in sem_results)
            pct = round(total_marks / total_max * 100, 2) if total_max > 0 else 0
            semesters.append({
                "semester": sem_num,
                "total_subjects": total,
                "passed": passed,
                "failed": total - passed,
                "percentage": pct,
            })

        pdf_buffer = generate_student_report(
            student=student,
            results=results,
            semesters=semesters,
            institution_name=institution_name,
        )

        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=report_{student['register_number']}.pdf"
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")
