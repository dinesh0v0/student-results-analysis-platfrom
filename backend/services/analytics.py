# =============================================================================
# Analytics Service — Dashboard Metric Calculations
# =============================================================================
from typing import List, Dict, Any, Optional
from services.supabase_client import supabase_admin


def calculate_dashboard_stats(institution_id: str) -> Dict[str, Any]:
    """Calculate overall dashboard statistics for an institution."""
    try:
        # Total students
        students_resp = supabase_admin.table("students") \
            .select("id", count="exact") \
            .eq("institution_id", institution_id) \
            .execute()
        total_students = students_resp.count or 0

        # Total subjects
        subjects_resp = supabase_admin.table("subjects") \
            .select("id", count="exact") \
            .eq("institution_id", institution_id) \
            .execute()
        total_subjects = subjects_resp.count or 0

        # Results stats
        results_resp = supabase_admin.table("results") \
            .select("id, pass_status, semester") \
            .eq("institution_id", institution_id) \
            .execute()

        results_data = results_resp.data or []
        total_results = len(results_data)
        passed = sum(1 for r in results_data if r.get("pass_status"))
        pass_pct = round((passed / total_results * 100), 2) if total_results > 0 else 0.0

        semesters = sorted(set(r["semester"] for r in results_data if r.get("semester")))

        return {
            "total_students": total_students,
            "total_subjects": total_subjects,
            "total_results": total_results,
            "overall_pass_percentage": pass_pct,
            "semesters_available": semesters,
        }
    except Exception as e:
        return {
            "total_students": 0,
            "total_subjects": 0,
            "total_results": 0,
            "overall_pass_percentage": 0.0,
            "semesters_available": [],
            "error": str(e),
        }


def calculate_grade_distribution(institution_id: str, semester: Optional[int] = None) -> List[Dict[str, Any]]:
    """Calculate grade distribution for an institution, optionally filtered by semester."""
    try:
        query = supabase_admin.table("results") \
            .select("grade") \
            .eq("institution_id", institution_id)

        if semester:
            query = query.eq("semester", semester)

        resp = query.execute()
        data = resp.data or []

        if not data:
            return []

        grade_counts: Dict[str, int] = {}
        total = len(data)

        for r in data:
            grade = r.get("grade", "N/A") or "N/A"
            grade_counts[grade] = grade_counts.get(grade, 0) + 1

        # Sort grades in order
        grade_order = ["O", "A+", "A", "B+", "B", "C", "F", "N/A"]
        result = []
        for g in grade_order:
            if g in grade_counts:
                result.append({
                    "grade": g,
                    "count": grade_counts[g],
                    "percentage": round(grade_counts[g] / total * 100, 2),
                })

        # Add any grades not in standard order
        for g, count in grade_counts.items():
            if g not in grade_order:
                result.append({
                    "grade": g,
                    "count": count,
                    "percentage": round(count / total * 100, 2),
                })

        return result
    except Exception:
        return []


def calculate_subject_performance(institution_id: str, semester: Optional[int] = None) -> List[Dict[str, Any]]:
    """Calculate per-subject performance metrics."""
    try:
        query = supabase_admin.table("results") \
            .select("subject_id, marks_obtained, max_marks, pass_status, semester") \
            .eq("institution_id", institution_id)

        if semester:
            query = query.eq("semester", semester)

        resp = query.execute()
        results = resp.data or []

        if not results:
            return []

        # Get subject details
        subject_ids = list(set(r["subject_id"] for r in results))
        subjects_resp = supabase_admin.table("subjects") \
            .select("id, subject_code, subject_name, semester") \
            .in_("id", subject_ids) \
            .execute()
        subjects_map = {s["id"]: s for s in (subjects_resp.data or [])}

        # Group by subject
        subject_stats: Dict[str, Dict] = {}
        for r in results:
            sid = r["subject_id"]
            if sid not in subject_stats:
                sub_info = subjects_map.get(sid, {})
                subject_stats[sid] = {
                    "subject_code": sub_info.get("subject_code", "Unknown"),
                    "subject_name": sub_info.get("subject_name", "Unknown"),
                    "semester": sub_info.get("semester", r.get("semester", 0)),
                    "total": 0,
                    "passed": 0,
                    "total_marks": 0.0,
                }
            stats = subject_stats[sid]
            stats["total"] += 1
            if r.get("pass_status"):
                stats["passed"] += 1
            if r.get("marks_obtained") is not None:
                stats["total_marks"] += float(r["marks_obtained"])

        return [
            {
                "subject_code": s["subject_code"],
                "subject_name": s["subject_name"],
                "semester": s["semester"],
                "total_students": s["total"],
                "passed": s["passed"],
                "failed": s["total"] - s["passed"],
                "pass_percentage": round(s["passed"] / s["total"] * 100, 2) if s["total"] > 0 else 0,
                "average_marks": round(s["total_marks"] / s["total"], 2) if s["total"] > 0 else 0,
            }
            for s in subject_stats.values()
        ]
    except Exception:
        return []


def get_top_performers(institution_id: str, limit: int = 10, semester: Optional[int] = None) -> List[Dict[str, Any]]:
    """Get top performing students by average percentage."""
    try:
        query = supabase_admin.table("results") \
            .select("student_id, marks_obtained, max_marks") \
            .eq("institution_id", institution_id)

        if semester:
            query = query.eq("semester", semester)

        resp = query.execute()
        results = resp.data or []

        if not results:
            return []

        # Calculate average percentage per student
        student_marks: Dict[str, Dict] = {}
        for r in results:
            sid = r["student_id"]
            if sid not in student_marks:
                student_marks[sid] = {"total_marks": 0.0, "total_max": 0.0, "count": 0}
            if r.get("marks_obtained") is not None and r.get("max_marks"):
                student_marks[sid]["total_marks"] += float(r["marks_obtained"])
                student_marks[sid]["total_max"] += float(r["max_marks"])
                student_marks[sid]["count"] += 1

        # Sort by percentage
        student_pcts = [
            (sid, round(d["total_marks"] / d["total_max"] * 100, 2) if d["total_max"] > 0 else 0)
            for sid, d in student_marks.items()
        ]
        student_pcts.sort(key=lambda x: x[1], reverse=True)
        top_ids = [s[0] for s in student_pcts[:limit]]

        if not top_ids:
            return []

        # Get student names
        students_resp = supabase_admin.table("students") \
            .select("id, register_number, student_name, email, institution_id") \
            .in_("id", top_ids) \
            .execute()

        return students_resp.data or []
    except Exception:
        return []
