from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from auth import AuthenticatedUser, get_current_user, require_role
from models.schemas import AcademicHistory, ResultResponse, SemesterSummary, StudentResponse
from services.pdf_generator import generate_student_report
from services.supabase_client import get_authenticated_client

router = APIRouter(prefix="/api/student", tags=["Student"])


async def _get_student_record(client, user: AuthenticatedUser) -> Dict:
    require_role(user, "student")
    try:
        resp = (
            client.table("students")
            .select("*")
            .eq("auth_user_id", user.user_id)
            .limit(1)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load the student profile.",
        )

    if not resp.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No student profile is linked to this account.",
        )

    return resp.data[0]


def _format_result_rows(rows: List[Dict]) -> List[ResultResponse]:
    formatted_results: List[ResultResponse] = []
    for row in rows:
        subject = row.get("subjects", {}) or {}
        formatted_results.append(
            ResultResponse(
                id=row["id"],
                student_id=row["student_id"],
                subject_code=subject.get("subject_code", "N/A"),
                subject_name=subject.get("subject_name", "N/A"),
                semester=row["semester"],
                marks_obtained=row.get("marks_obtained"),
                max_marks=row.get("max_marks", 100),
                grade=row.get("grade"),
                pass_status=row.get("pass_status", False),
            )
        )
    return formatted_results


def _build_semester_summaries(rows: List[Dict]) -> List[SemesterSummary]:
    grouped_results: Dict[int, List[Dict]] = {}
    for row in rows:
        grouped_results.setdefault(row["semester"], []).append(row)

    summaries: List[SemesterSummary] = []
    for semester in sorted(grouped_results):
        semester_rows = grouped_results[semester]
        total_subjects = len(semester_rows)
        passed = sum(1 for row in semester_rows if row.get("pass_status"))
        failed = total_subjects - passed
        total_marks = sum(float(row.get("marks_obtained") or 0) for row in semester_rows)
        total_max = sum(float(row.get("max_marks") or 100) for row in semester_rows)
        percentage = round((total_marks / total_max) * 100, 2) if total_max else 0.0

        summaries.append(
            SemesterSummary(
                semester=semester,
                total_subjects=total_subjects,
                passed=passed,
                failed=failed,
                percentage=percentage,
                gpa=round(percentage / 10, 2) if percentage else 0.0,
            )
        )
    return summaries


def _fetch_result_rows(client, student_id: str, semester: Optional[int] = None) -> List[Dict]:
    try:
        query = (
            client.table("results")
            .select("*, subjects(subject_code, subject_name)")
            .eq("student_id", student_id)
        )
        if semester is not None:
            query = query.eq("semester", semester)
        resp = query.order("semester").execute()
        return resp.data or []
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load academic results.",
        )


@router.get("/profile", response_model=StudentResponse)
async def get_profile(user: AuthenticatedUser = Depends(get_current_user)):
    """Get the authenticated student's profile."""
    client = get_authenticated_client(user.access_token)
    student = await _get_student_record(client, user)
    return StudentResponse(
        id=student["id"],
        register_number=student["register_number"],
        student_name=student["student_name"],
        email=student.get("email"),
        institution_id=student["institution_id"],
    )


@router.get("/results", response_model=List[ResultResponse])
async def get_results(
    semester: Optional[int] = Query(None, ge=1, le=12),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Get the authenticated student's results."""
    client = get_authenticated_client(user.access_token)
    student = await _get_student_record(client, user)

    return _format_result_rows(_fetch_result_rows(client, student["id"], semester))


@router.get("/results/latest")
async def get_latest_results(user: AuthenticatedUser = Depends(get_current_user)):
    """Get the latest semester's results for the authenticated student."""
    client = get_authenticated_client(user.access_token)
    student = await _get_student_record(client, user)

    try:
        latest_resp = (
            client.table("results")
            .select("semester")
            .eq("student_id", student["id"])
            .order("semester", desc=True)
            .limit(1)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load the latest results.",
        )

    if not latest_resp.data:
        return {"semester": None, "results": []}

    latest_semester = latest_resp.data[0]["semester"]
    rows = _fetch_result_rows(client, student["id"], latest_semester)
    return {"semester": latest_semester, "results": [result.model_dump() for result in _format_result_rows(rows)]}


@router.get("/history", response_model=AcademicHistory)
async def get_academic_history(user: AuthenticatedUser = Depends(get_current_user)):
    """Get the authenticated student's full academic history."""
    client = get_authenticated_client(user.access_token)
    student = await _get_student_record(client, user)

    rows = _fetch_result_rows(client, student["id"])
    return AcademicHistory(
        student=StudentResponse(
            id=student["id"],
            register_number=student["register_number"],
            student_name=student["student_name"],
            email=student.get("email"),
            institution_id=student["institution_id"],
        ),
        semesters=_build_semester_summaries(rows),
        results=_format_result_rows(rows),
    )


@router.get("/report/pdf")
async def download_pdf_report(user: AuthenticatedUser = Depends(get_current_user)):
    """Download a PDF report for the authenticated student."""
    client = get_authenticated_client(user.access_token)
    student = await _get_student_record(client, user)

    try:
        institution_resp = (
            client.table("institutions")
            .select("name")
            .eq("id", student["institution_id"])
            .limit(1)
            .execute()
        )
        institution_name = (
            institution_resp.data[0]["name"] if institution_resp.data else "Institution"
        )

        rows = _fetch_result_rows(client, student["id"])
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate the PDF report right now.",
        )

    semesters = [summary.model_dump() for summary in _build_semester_summaries(rows)]
    results = []
    for row in rows:
        subject = row.get("subjects", {}) or {}
        results.append(
            {
                "subject_code": subject.get("subject_code", "N/A"),
                "subject_name": subject.get("subject_name", "N/A"),
                "semester": row["semester"],
                "marks_obtained": row.get("marks_obtained", 0),
                "max_marks": row.get("max_marks", 100),
                "grade": row.get("grade", "N/A"),
                "pass_status": row.get("pass_status", False),
            }
        )

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
