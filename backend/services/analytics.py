from typing import Any, Dict, List, Optional


HIERARCHY_FIELDS = ["campus", "faculty", "department", "branch", "section"]


def _apply_filters(query: Any, institution_id: str, filters: Dict[str, Optional[str]]) -> Any:
    query = query.eq("institution_id", institution_id)
    for field in HIERARCHY_FIELDS:
        value = filters.get(field)
        if value:
            query = query.eq(field, value)
    return query


def _safe_string(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def build_scope_label(filters: Dict[str, Optional[str]]) -> str:
    active_parts = [filters[field] for field in HIERARCHY_FIELDS if filters.get(field)]
    return " / ".join(active_parts) if active_parts else "Institution-wide"


def get_hierarchy_options(
    client: Any,
    institution_id: str,
    filters: Dict[str, Optional[str]],
) -> Dict[str, List[str]]:
    try:
        students_resp = (
            client.table("students")
            .select("campus, faculty, department, branch, section")
            .eq("institution_id", institution_id)
            .execute()
        )
        students = students_resp.data or []
    except Exception:
        return {
            "campus_options": [],
            "faculty_options": [],
            "department_options": [],
            "branch_options": [],
            "section_options": [],
        }

    options: Dict[str, List[str]] = {}
    scoped_rows = students

    for field in HIERARCHY_FIELDS:
        options[f"{field}_options"] = sorted(
            {
                _safe_string(row.get(field))
                for row in scoped_rows
                if _safe_string(row.get(field)) is not None
            }
        )
        selected_value = filters.get(field)
        if selected_value:
            scoped_rows = [row for row in scoped_rows if _safe_string(row.get(field)) == selected_value]

    return options


def calculate_dashboard_stats(
    client: Any,
    institution_id: str,
    filters: Dict[str, Optional[str]],
) -> Dict[str, Any]:
    try:
        students_resp = _apply_filters(
            client.table("students").select("id", count="exact"), institution_id, filters
        ).execute()
        subjects_resp = (
            client.table("subjects")
            .select("id", count="exact")
            .eq("institution_id", institution_id)
            .execute()
        )
        results_resp = _apply_filters(
            client.table("results").select("id, pass_status, semester"), institution_id, filters
        ).execute()

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
            "active_scope_label": build_scope_label(filters),
        }
    except Exception:
        return {
            "total_students": 0,
            "total_subjects": 0,
            "total_results": 0,
            "overall_pass_percentage": 0.0,
            "semesters_available": [],
            "active_scope_label": build_scope_label(filters),
        }


def calculate_grade_distribution(
    client: Any,
    institution_id: str,
    filters: Dict[str, Optional[str]],
    semester: Optional[int] = None,
) -> List[Dict[str, Any]]:
    try:
        query = _apply_filters(client.table("results").select("grade, semester"), institution_id, filters)
        if semester:
            query = query.eq("semester", semester)

        data = query.execute().data or []
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
    filters: Dict[str, Optional[str]],
    semester: Optional[int] = None,
) -> List[Dict[str, Any]]:
    try:
        query = _apply_filters(
            client.table("results").select("subject_id, marks_obtained, pass_status, semester"),
            institution_id,
            filters,
        )
        if semester:
            query = query.eq("semester", semester)

        results = query.execute().data or []
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

        performance = [
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
        return sorted(performance, key=lambda item: (item["semester"], item["subject_code"]))
    except Exception:
        return []


def get_top_performers(
    client: Any,
    institution_id: str,
    filters: Dict[str, Optional[str]],
    limit: int = 10,
    semester: Optional[int] = None,
) -> List[Dict[str, Any]]:
    try:
        query = _apply_filters(
            client.table("results").select("student_id, marks_obtained, max_marks, semester"),
            institution_id,
            filters,
        )
        if semester:
            query = query.eq("semester", semester)

        results = query.execute().data or []
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
            .select(
                "id, register_number, student_name, email, institution_id, campus, faculty, department, branch, section"
            )
            .in_("id", ranked_ids)
            .execute()
        )
        students_map = {student["id"]: student for student in (students_resp.data or [])}
        return [students_map[student_id] for student_id in ranked_ids if student_id in students_map]
    except Exception:
        return []


def get_section_overview(
    client: Any,
    institution_id: str,
    filters: Dict[str, Optional[str]],
    semester: Optional[int] = None,
) -> List[Dict[str, Any]]:
    try:
        query = _apply_filters(
            client.table("results").select(
                "campus, faculty, department, branch, section, pass_status, marks_obtained, max_marks, semester"
            ),
            institution_id,
            filters,
        )
        if semester:
            query = query.eq("semester", semester)

        results = query.execute().data or []
        if not results:
            return []

        overview: Dict[str, Dict[str, Any]] = {}
        for row in results:
            key_parts = [_safe_string(row.get(field)) or "Unassigned" for field in HIERARCHY_FIELDS]
            key = "|".join(key_parts)
            if key not in overview:
                overview[key] = {
                    "campus": _safe_string(row.get("campus")),
                    "faculty": _safe_string(row.get("faculty")),
                    "department": _safe_string(row.get("department")),
                    "branch": _safe_string(row.get("branch")),
                    "section": _safe_string(row.get("section")),
                    "total_results": 0,
                    "passed": 0,
                    "total_marks": 0.0,
                    "total_max_marks": 0.0,
                }

            stats = overview[key]
            stats["total_results"] += 1
            if row.get("pass_status"):
                stats["passed"] += 1
            stats["total_marks"] += float(row.get("marks_obtained") or 0)
            stats["total_max_marks"] += float(row.get("max_marks") or 0)

        output = []
        for stats in overview.values():
            total_results = stats["total_results"]
            output.append(
                {
                    "campus": stats["campus"],
                    "faculty": stats["faculty"],
                    "department": stats["department"],
                    "branch": stats["branch"],
                    "section": stats["section"],
                    "total_results": total_results,
                    "passed": stats["passed"],
                    "pass_percentage": round((stats["passed"] / total_results) * 100, 2)
                    if total_results
                    else 0,
                    "average_marks": round((stats["total_marks"] / total_results), 2)
                    if total_results
                    else 0,
                }
            )
        return sorted(
            output,
            key=lambda item: tuple((item.get(field) or "") for field in HIERARCHY_FIELDS),
        )
    except Exception:
        return []


def get_results_management_rows(
    client: Any,
    institution_id: str,
    filters: Dict[str, Optional[str]],
    semester: Optional[int] = None,
    search: Optional[str] = None,
    limit: int = 250,
) -> List[Dict[str, Any]]:
    try:
        query = _apply_filters(
            client.table("results").select(
                "id, upload_batch_id, student_id, semester, marks_obtained, max_marks, grade, pass_status, campus, faculty, department, branch, section, created_at, students(register_number, student_name), subjects(subject_code, subject_name), upload_batches(file_name)"
            ),
            institution_id,
            filters,
        )
        if semester:
            query = query.eq("semester", semester)

        rows = query.order("created_at", desc=True).limit(limit).execute().data or []
        search_value = (search or "").strip().lower()

        output: List[Dict[str, Any]] = []
        for row in rows:
            student = row.get("students", {}) or {}
            subject = row.get("subjects", {}) or {}
            batch = row.get("upload_batches", {}) or {}

            candidate = {
                "id": row["id"],
                "student_id": row["student_id"],
                "upload_batch_id": row.get("upload_batch_id"),
                "register_number": student.get("register_number"),
                "student_name": student.get("student_name"),
                "subject_code": subject.get("subject_code", "N/A"),
                "subject_name": subject.get("subject_name", "N/A"),
                "semester": row["semester"],
                "marks_obtained": row.get("marks_obtained"),
                "max_marks": row.get("max_marks", 100),
                "grade": row.get("grade"),
                "pass_status": row.get("pass_status", False),
                "campus": row.get("campus"),
                "faculty": row.get("faculty"),
                "department": row.get("department"),
                "branch": row.get("branch"),
                "section": row.get("section"),
                "file_name": batch.get("file_name"),
                "created_at": row.get("created_at"),
            }

            if search_value:
                haystack = " ".join(
                    str(candidate.get(field) or "")
                    for field in ["register_number", "student_name", "subject_code", "subject_name", "section"]
                ).lower()
                if search_value not in haystack:
                    continue

            output.append(candidate)
        return output
    except Exception:
        return []
