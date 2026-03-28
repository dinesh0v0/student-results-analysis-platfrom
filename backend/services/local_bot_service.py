import re
from typing import Any, Dict, Optional


ADMIN_FALLBACK_RESPONSE = (
    "I am your custom institutional assistant. I can currently help you find: "
    "Overall Pass Rates, Top Performers, and Subject Averages. What would you like to know?"
)
STUDENT_FALLBACK_RESPONSE = (
    "I am your personal academic assistant. I can help you check your: "
    "Current GPA, Failed Subjects, and Highest Marks. What would you like to know?"
)
AI_OVERLOADED_MESSAGE = "I am currently overloaded, please try again in a moment."


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def extract_entities(message: str) -> Dict[str, Optional[str | int]]:
    normalized = _normalize(message)
    semester_match = re.search(r"semester\s*(\d{1,2})|sem\s*(\d{1,2})", normalized)
    semester = None
    if semester_match:
        semester_value = semester_match.group(1) or semester_match.group(2)
        semester = int(semester_value)

    subject = None
    subject_patterns = [
        r"subject\s+([a-z0-9+\-\s]+)",
        r"for\s+([a-z0-9+\-\s]+)",
        r"in\s+([a-z0-9+\-\s]+)",
    ]
    for pattern in subject_patterns:
        match = re.search(pattern, normalized)
        if match:
            candidate = match.group(1).strip(" .?!,")
            if candidate and not candidate.startswith(("semester", "sem")):
                subject = candidate
                break

    return {"semester": semester, "subject": subject}


def classify_intent(message: str, role: str) -> str:
    normalized = _normalize(message)

    if role == "admin":
        if any(phrase in normalized for phrase in ["pass percentage", "overall pass rate", "pass rate"]):
            return "overall_pass_rate"
        if any(phrase in normalized for phrase in ["top student", "highest marks", "highest scorer", "top performer"]):
            return "top_performer"
        if any(phrase in normalized for phrase in ["subject average", "average marks", "average score", "subject avg"]):
            return "subject_average"
        return "fallback"

    if any(phrase in normalized for phrase in ["my gpa", "my percentage", "current gpa", "current percentage", "average"]):
        return "student_percentage"
    if any(phrase in normalized for phrase in ["my arrears", "failed subjects", "backlogs", "fail status", "arrear"]):
        return "failed_subjects"
    if any(phrase in normalized for phrase in ["highest marks", "highest score", "best subject", "top score"]):
        return "highest_marks"
    return "fallback"


def _find_subject(client: Any, institution_id: str, subject_query: Optional[str]) -> Optional[Dict[str, Any]]:
    if not subject_query:
        return None

    response = (
        client.table("subjects")
        .select("id, subject_code, subject_name, semester")
        .eq("institution_id", institution_id)
        .execute()
    )
    subjects = response.data or []
    normalized_query = _normalize(subject_query)

    exact = next(
        (
            subject
            for subject in subjects
            if normalized_query == _normalize(subject.get("subject_code", ""))
            or normalized_query == _normalize(subject.get("subject_name", ""))
        ),
        None,
    )
    if exact:
        return exact

    return next(
        (
            subject
            for subject in subjects
            if normalized_query in _normalize(subject.get("subject_code", ""))
            or normalized_query in _normalize(subject.get("subject_name", ""))
        ),
        None,
    )


def _admin_overall_pass_rate(client: Any, institution_id: str, semester: Optional[int]) -> str:
    query = client.table("results").select("pass_status, semester").eq("institution_id", institution_id)
    if semester:
        query = query.eq("semester", semester)
    results = query.execute().data or []
    if not results:
        return "I could not find any result records for that scope yet."

    passed = sum(1 for row in results if row.get("pass_status"))
    total = len(results)
    percentage = round((passed / total) * 100, 2) if total else 0.0
    scope = f" for Semester {semester}" if semester else ""
    return f"The overall pass rate{scope} is {percentage}% ({passed} passed out of {total} result entries)."


def _admin_top_performer(client: Any, institution_id: str, semester: Optional[int]) -> str:
    query = (
        client.table("results")
        .select("student_id, marks_obtained, max_marks, semester")
        .eq("institution_id", institution_id)
    )
    if semester:
        query = query.eq("semester", semester)
    results = query.execute().data or []
    if not results:
        return "I could not find any scored results for that scope yet."

    scoreboard: Dict[str, Dict[str, float]] = {}
    for row in results:
        student_id = row.get("student_id")
        marks = float(row.get("marks_obtained") or 0)
        max_marks = float(row.get("max_marks") or 0)
        if not student_id or max_marks <= 0:
            continue
        scoreboard.setdefault(student_id, {"marks": 0.0, "max_marks": 0.0})
        scoreboard[student_id]["marks"] += marks
        scoreboard[student_id]["max_marks"] += max_marks

    if not scoreboard:
        return "I could not calculate a top performer because the marks data is incomplete."

    top_student_id, top_scores = max(
        scoreboard.items(),
        key=lambda item: (item[1]["marks"] / item[1]["max_marks"]) if item[1]["max_marks"] else 0,
    )
    student_resp = (
        client.table("students")
        .select("student_name, register_number")
        .eq("id", top_student_id)
        .single()
        .execute()
    )
    student = student_resp.data or {}
    percentage = round((top_scores["marks"] / top_scores["max_marks"]) * 100, 2) if top_scores["max_marks"] else 0.0
    scope = f" in Semester {semester}" if semester else ""
    return (
        f"The top performer{scope} is {student.get('student_name', 'Unknown Student')} "
        f"({student.get('register_number', 'N/A')}) with {top_scores['marks']:.2f}/"
        f"{top_scores['max_marks']:.2f}, which is {percentage}%."
    )


def _admin_subject_average(client: Any, institution_id: str, subject_query: Optional[str], semester: Optional[int]) -> str:
    subject = _find_subject(client, institution_id, subject_query)
    if not subject:
        return "Please mention a subject code or subject name so I can calculate its average."

    query = (
        client.table("results")
        .select("marks_obtained, max_marks, semester")
        .eq("institution_id", institution_id)
        .eq("subject_id", subject["id"])
    )
    if semester:
        query = query.eq("semester", semester)
    results = query.execute().data or []
    if not results:
        return f"I could not find any marks for {subject['subject_code']} {subject['subject_name']}."

    total_marks = sum(float(row.get("marks_obtained") or 0) for row in results)
    total_max = sum(float(row.get("max_marks") or 0) for row in results)
    average_marks = round(total_marks / len(results), 2) if results else 0.0
    average_percentage = round((total_marks / total_max) * 100, 2) if total_max else 0.0
    return (
        f"The average for {subject['subject_code']} {subject['subject_name']} is {average_marks} marks "
        f"across {len(results)} result entries, which is {average_percentage}% overall."
    )


def _student_percentage(client: Any, student_id: str, semester: Optional[int]) -> str:
    query = client.table("results").select("marks_obtained, max_marks, semester").eq("student_id", student_id)
    if semester:
        query = query.eq("semester", semester)
    results = query.execute().data or []
    if not results:
        return "I could not find any marks for you in that scope yet."

    total_marks = sum(float(row.get("marks_obtained") or 0) for row in results)
    total_max = sum(float(row.get("max_marks") or 0) for row in results)
    percentage = round((total_marks / total_max) * 100, 2) if total_max else 0.0
    scope = f" for Semester {semester}" if semester else " overall"
    return f"Your current percentage{scope} is {percentage}% based on {len(results)} subject records."


def _student_failed_subjects(client: Any, student_id: str, semester: Optional[int]) -> str:
    query = (
        client.table("results")
        .select("subject_id, grade, pass_status, semester")
        .eq("student_id", student_id)
        .eq("pass_status", False)
    )
    if semester:
        query = query.eq("semester", semester)
    failed_results = query.execute().data or []
    if not failed_results:
        scope = f" in Semester {semester}" if semester else ""
        return f"Good news - you currently have no failed subjects{scope}."

    subject_ids = [row["subject_id"] for row in failed_results if row.get("subject_id")]
    subjects_map: Dict[str, Dict[str, Any]] = {}
    if subject_ids:
        subjects_resp = (
            client.table("subjects")
            .select("id, subject_code, subject_name")
            .in_("id", subject_ids)
            .execute()
        )
        subjects_map = {subject["id"]: subject for subject in (subjects_resp.data or [])}

    failed_subjects = []
    for row in failed_results:
        subject = subjects_map.get(row.get("subject_id"), {})
        failed_subjects.append(f"{subject.get('subject_code', 'N/A')} {subject.get('subject_name', 'Unknown Subject')}")

    return "You currently have arrears in: " + ", ".join(failed_subjects) + "."


def _student_highest_marks(client: Any, student_id: str, semester: Optional[int]) -> str:
    query = client.table("results").select("subject_id, marks_obtained, max_marks, semester").eq("student_id", student_id)
    if semester:
        query = query.eq("semester", semester)
    results = query.execute().data or []
    if not results:
        return "I could not find any marks to evaluate your highest score yet."

    best_row = max(results, key=lambda row: float(row.get("marks_obtained") or 0))
    subject_resp = (
        client.table("subjects")
        .select("subject_code, subject_name")
        .eq("id", best_row["subject_id"])
        .single()
        .execute()
    )
    subject = subject_resp.data or {}
    return (
        f"Your highest mark is {float(best_row.get('marks_obtained') or 0):.2f}/"
        f"{float(best_row.get('max_marks') or 0):.2f} in "
        f"{subject.get('subject_code', 'N/A')} {subject.get('subject_name', 'Unknown Subject')}."
    )


async def admin_chat(message: str, institution_id: str, client: Any) -> Dict[str, Any]:
    entities = extract_entities(message)
    intent = classify_intent(message, "admin")
    semester = entities.get("semester")
    subject = entities.get("subject")

    try:
        if intent == "overall_pass_rate":
            response = _admin_overall_pass_rate(client, institution_id, semester)
        elif intent == "top_performer":
            response = _admin_top_performer(client, institution_id, semester)
        elif intent == "subject_average":
            response = _admin_subject_average(client, institution_id, subject, semester)
        else:
            response = ADMIN_FALLBACK_RESPONSE
    except Exception:
        response = AI_OVERLOADED_MESSAGE

    return {"response": response, "query_used": intent}


async def student_chat(message: str, student_id: str, client: Any) -> Dict[str, Any]:
    entities = extract_entities(message)
    intent = classify_intent(message, "student")
    semester = entities.get("semester")

    try:
        if intent == "student_percentage":
            response = _student_percentage(client, student_id, semester)
        elif intent == "failed_subjects":
            response = _student_failed_subjects(client, student_id, semester)
        elif intent == "highest_marks":
            response = _student_highest_marks(client, student_id, semester)
        else:
            response = STUDENT_FALLBACK_RESPONSE
    except Exception:
        response = AI_OVERLOADED_MESSAGE

    return {"response": response, "query_used": intent}
