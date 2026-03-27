from typing import Any, Dict, List, Optional


def calculate_dashboard_stats(client: Any, institution_id: str) -> Dict[str, Any]:
    """Calculate overall dashboard statistics for an institution."""
    try:
        students_resp = (
            client.table("students")
            .select("id", count="exact")
            .eq("institution_id", institution_id)
            .execute()
        )
        subjects_resp = (
            client.table("subjects")
            .select("id", count="exact")
            .eq("institution_id", institution_id)
            .execute()
        )
        results_resp = (
            client.table("results")
            .select("id, pass_status, semester")
            .eq("institution_id", institution_id)
            .execute()
        )

        results_data = results_resp.data or []
        total_results = len(results_data)
        passed = sum(1 for row in results_data if row.get("pass_status"))
        pass_percentage = round((passed / total_results) * 100, 2) if total_results else 0.0
        semesters = sorted({row["semester"] for row in results_data if row.get("semester")})

        return {
            "total_students": students_resp.count or 0,
            "total_subjects": subjects_resp.count or 0,
            "total_results": total_results,
            "overall_pass_percentage": pass_percentage,
            "semesters_available": semesters,
        }
    except Exception:
        return {
            "total_students": 0,
            "total_subjects": 0,
            "total_results": 0,
            "overall_pass_percentage": 0.0,
            "semesters_available": [],
        }


def calculate_grade_distribution(
    client: Any,
    institution_id: str,
    semester: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Calculate grade distribution for an institution."""
    try:
        query = client.table("results").select("grade").eq("institution_id", institution_id)
        if semester:
            query = query.eq("semester", semester)

        resp = query.execute()
        data = resp.data or []
        if not data:
            return []

        grade_counts: Dict[str, int] = {}
        for row in data:
            grade = row.get("grade") or "N/A"
            grade_counts[grade] = grade_counts.get(grade, 0) + 1

        total = len(data)
        ordered_grades = ["O", "A+", "A", "B+", "B", "C", "F", "PASS", "FAIL", "AB", "N/A"]
        distribution: List[Dict[str, Any]] = []

        for grade in ordered_grades:
            if grade in grade_counts:
                distribution.append(
                    {
                        "grade": grade,
                        "count": grade_counts[grade],
                        "percentage": round((grade_counts[grade] / total) * 100, 2),
                    }
                )

        for grade, count in grade_counts.items():
            if grade not in ordered_grades:
                distribution.append(
                    {
                        "grade": grade,
                        "count": count,
                        "percentage": round((count / total) * 100, 2),
                    }
                )

        return distribution
    except Exception:
        return []


def calculate_subject_performance(
    client: Any,
    institution_id: str,
    semester: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Calculate per-subject performance metrics."""
    try:
        query = (
            client.table("results")
            .select("subject_id, marks_obtained, pass_status, semester")
            .eq("institution_id", institution_id)
        )
        if semester:
            query = query.eq("semester", semester)

        results_resp = query.execute()
        results = results_resp.data or []
        if not results:
            return []

        subject_ids = sorted({row["subject_id"] for row in results if row.get("subject_id")})
        subjects_resp = (
            client.table("subjects")
            .select("id, subject_code, subject_name, semester")
            .in_("id", subject_ids)
            .execute()
        )
        subjects_map = {subject["id"]: subject for subject in (subjects_resp.data or [])}

        subject_stats: Dict[str, Dict[str, Any]] = {}
        for row in results:
            subject_id = row["subject_id"]
            if subject_id not in subject_stats:
                subject_info = subjects_map.get(subject_id, {})
                subject_stats[subject_id] = {
                    "subject_code": subject_info.get("subject_code", "Unknown"),
                    "subject_name": subject_info.get("subject_name", "Unknown"),
                    "semester": subject_info.get("semester", row.get("semester", 0)),
                    "total_students": 0,
                    "passed": 0,
                    "total_marks": 0.0,
                }

            stats = subject_stats[subject_id]
            stats["total_students"] += 1
            if row.get("pass_status"):
                stats["passed"] += 1
            if row.get("marks_obtained") is not None:
                stats["total_marks"] += float(row["marks_obtained"])

        return [
            {
                "subject_code": stats["subject_code"],
                "subject_name": stats["subject_name"],
                "semester": stats["semester"],
                "total_students": stats["total_students"],
                "passed": stats["passed"],
                "failed": stats["total_students"] - stats["passed"],
                "pass_percentage": round((stats["passed"] / stats["total_students"]) * 100, 2)
                if stats["total_students"]
                else 0,
                "average_marks": round((stats["total_marks"] / stats["total_students"]), 2)
                if stats["total_students"]
                else 0,
            }
            for stats in subject_stats.values()
        ]
    except Exception:
        return []


def get_top_performers(
    client: Any,
    institution_id: str,
    limit: int = 10,
    semester: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Get top-performing students by average percentage."""
    try:
        query = (
            client.table("results")
            .select("student_id, marks_obtained, max_marks")
            .eq("institution_id", institution_id)
        )
        if semester:
            query = query.eq("semester", semester)

        results_resp = query.execute()
        results = results_resp.data or []
        if not results:
            return []

        student_scores: Dict[str, Dict[str, float]] = {}
        for row in results:
            student_id = row["student_id"]
            if student_id not in student_scores:
                student_scores[student_id] = {"marks": 0.0, "max": 0.0}

            if row.get("marks_obtained") is not None and row.get("max_marks"):
                student_scores[student_id]["marks"] += float(row["marks_obtained"])
                student_scores[student_id]["max"] += float(row["max_marks"])

        ranked_students = sorted(
            student_scores.items(),
            key=lambda item: (item[1]["marks"] / item[1]["max"]) if item[1]["max"] else 0,
            reverse=True,
        )[:limit]

        ranked_ids = [student_id for student_id, _ in ranked_students]
        if not ranked_ids:
            return []

        students_resp = (
            client.table("students")
            .select("id, register_number, student_name, email, institution_id")
            .in_("id", ranked_ids)
            .execute()
        )
        students_map = {student["id"]: student for student in (students_resp.data or [])}
        return [students_map[student_id] for student_id in ranked_ids if student_id in students_map]
    except Exception:
        return []
