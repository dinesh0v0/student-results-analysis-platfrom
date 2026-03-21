# =============================================================================
# AI Service — Google Gemini Integration with Prompt Safety
# =============================================================================
import google.generativeai as genai
import re
from typing import Optional, Dict, Any, List
from config import get_settings
from services.supabase_client import supabase_admin

settings = get_settings()

# Configure Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.0-flash")


# =============================================================================
# Prompt Injection Defense
# =============================================================================
DANGEROUS_PATTERNS = [
    r"ignore\s+(previous|above|all)\s+instructions",
    r"disregard\s+(previous|above|all)",
    r"forget\s+(previous|everything|all)",
    r"you\s+are\s+now",
    r"pretend\s+to\s+be",
    r"act\s+as\s+if",
    r"system\s*prompt",
    r"reveal\s+(your|the)\s+(instructions|prompt|system)",
    r"show\s+me\s+(other|all)\s+students",
    r"give\s+me\s+data\s+(for|about)\s+(all|other|every)",
    r"bypass\s+(security|rls|access|restriction)",
    r"sql\s*injection",
    r"drop\s+table",
    r"delete\s+from",
    r"truncate\s+table",
    r";\s*(select|insert|update|delete|drop|alter)",
]


def sanitize_input(message: str) -> tuple[str, bool]:
    """
    Sanitize user input for prompt injection attempts.
    Returns (sanitized_message, is_safe).
    """
    if not message or not message.strip():
        return "", False

    lower = message.lower().strip()

    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, lower):
            return message, False

    # Remove any SQL-like syntax
    sanitized = re.sub(r'[;\'"\\]', '', message)
    sanitized = sanitized.strip()

    if len(sanitized) > 2000:
        sanitized = sanitized[:2000]

    return sanitized, True


# =============================================================================
# Admin AI Assistant
# =============================================================================
ADMIN_SYSTEM_PROMPT = """You are an AI assistant for a College Administrator on the Student Result Analysis Platform.
You help admins analyze student performance data for THEIR institution only.

RULES:
1. You can ONLY answer questions about academic data within the admin's institution.
2. You must NEVER reveal data from other institutions.
3. You must NEVER modify, delete, or insert data — you are read-only.
4. If asked about topics unrelated to academic analytics, politely decline.
5. Answer in a clear, professional manner with specific numbers when available.
6. If the data is insufficient to answer, say so honestly.

You have access to the following data summary for this institution:
{data_context}

Based on this data, answer the admin's question accurately and concisely."""


async def admin_chat(message: str, institution_id: str) -> Dict[str, Any]:
    """Process an admin's natural language query about their institution's data."""
    sanitized, is_safe = sanitize_input(message)

    if not is_safe:
        return {
            "response": "I'm sorry, but I can't process that request. Please ask a valid question about your institution's academic data.",
            "query_used": None,
        }

    try:
        # Gather institution data context
        context = _build_admin_context(institution_id)

        prompt = ADMIN_SYSTEM_PROMPT.format(data_context=context)
        response = model.generate_content(
            [prompt, f"Admin's question: {sanitized}"]
        )

        return {
            "response": response.text,
            "query_used": None,
        }
    except Exception as e:
        return {
            "response": f"I encountered an error while processing your request. Please try again. Error: {str(e)}",
            "query_used": None,
        }


def _build_admin_context(institution_id: str) -> str:
    """Build a data summary context string for the AI prompt."""
    try:
        # Get overall stats
        students = supabase_admin.table("students") \
            .select("id, register_number, student_name") \
            .eq("institution_id", institution_id) \
            .execute()

        subjects = supabase_admin.table("subjects") \
            .select("id, subject_code, subject_name, semester") \
            .eq("institution_id", institution_id) \
            .execute()

        results = supabase_admin.table("results") \
            .select("student_id, subject_id, semester, marks_obtained, max_marks, grade, pass_status") \
            .eq("institution_id", institution_id) \
            .execute()

        total_students = len(students.data or [])
        total_subjects = len(subjects.data or [])
        results_data = results.data or []
        total_results = len(results_data)
        passed = sum(1 for r in results_data if r.get("pass_status"))
        pass_pct = round(passed / total_results * 100, 2) if total_results > 0 else 0

        # Subject mapping
        sub_map = {s["id"]: s for s in (subjects.data or [])}

        # Grade distribution
        grade_counts: Dict[str, int] = {}
        for r in results_data:
            g = r.get("grade", "N/A")
            grade_counts[g] = grade_counts.get(g, 0) + 1

        # Subject-wise pass rates
        subject_stats: Dict[str, Dict] = {}
        for r in results_data:
            sid = r.get("subject_id")
            sub_info = sub_map.get(sid, {})
            code = sub_info.get("subject_code", "Unknown")
            name = sub_info.get("subject_name", "Unknown")
            sem = sub_info.get("semester", r.get("semester", 0))
            key = f"{code} (Sem {sem})"
            if key not in subject_stats:
                subject_stats[key] = {"name": name, "total": 0, "passed": 0, "marks_sum": 0}
            subject_stats[key]["total"] += 1
            if r.get("pass_status"):
                subject_stats[key]["passed"] += 1
            if r.get("marks_obtained") is not None:
                subject_stats[key]["marks_sum"] += float(r["marks_obtained"])

        # Build context string
        lines = [
            f"Total Students: {total_students}",
            f"Total Subjects: {total_subjects}",
            f"Total Result Entries: {total_results}",
            f"Overall Pass Percentage: {pass_pct}%",
            "",
            "Grade Distribution:",
        ]
        for g, c in sorted(grade_counts.items()):
            lines.append(f"  {g}: {c} students ({round(c/total_results*100, 1)}%)")

        lines.append("")
        lines.append("Subject-wise Performance:")
        for key, s in subject_stats.items():
            pp = round(s["passed"] / s["total"] * 100, 1) if s["total"] > 0 else 0
            avg = round(s["marks_sum"] / s["total"], 1) if s["total"] > 0 else 0
            lines.append(f"  {key} ({s['name']}): Pass Rate {pp}%, Avg Marks {avg}")

        # Semesters
        semesters = sorted(set(r.get("semester", 0) for r in results_data))
        lines.append(f"\nSemesters with data: {semesters}")

        # Top students (by avg marks)
        student_map = {s["id"]: s for s in (students.data or [])}
        student_avgs: Dict[str, Dict] = {}
        for r in results_data:
            stid = r.get("student_id")
            if stid not in student_avgs:
                student_avgs[stid] = {"total_marks": 0, "total_max": 0, "count": 0}
            if r.get("marks_obtained") is not None:
                student_avgs[stid]["total_marks"] += float(r["marks_obtained"])
                student_avgs[stid]["total_max"] += float(r.get("max_marks", 100))
                student_avgs[stid]["count"] += 1

        sorted_students = sorted(
            student_avgs.items(),
            key=lambda x: (x[1]["total_marks"] / x[1]["total_max"] * 100) if x[1]["total_max"] > 0 else 0,
            reverse=True
        )

        lines.append("\nTop 5 Performers:")
        for stid, stats in sorted_students[:5]:
            info = student_map.get(stid, {})
            pct = round(stats["total_marks"] / stats["total_max"] * 100, 1) if stats["total_max"] > 0 else 0
            lines.append(f"  {info.get('student_name', 'Unknown')} ({info.get('register_number', 'N/A')}): {pct}%")

        return "\n".join(lines)
    except Exception as e:
        return f"Unable to load data context: {str(e)}"


# =============================================================================
# Student AI Assistant
# =============================================================================
STUDENT_SYSTEM_PROMPT = """You are an AI assistant for a student on the Student Result Analysis Platform.
You help students understand THEIR OWN academic performance only.

RULES:
1. You can ONLY answer questions about THIS student's academic data.
2. You must NEVER reveal data of other students.
3. You must NEVER compare this student with specific other students by name.
4. You must NEVER modify any data — you are read-only.
5. If asked about other students' data, firmly decline.
6. Answer in a friendly, encouraging, and helpful manner.
7. If asked about topics unrelated to the student's academics, politely redirect.

Here is the student's academic data:
{data_context}

Answer the student's question based only on their data above."""


async def student_chat(message: str, student_id: str, institution_id: str) -> Dict[str, Any]:
    """Process a student's natural language query about their own data."""
    sanitized, is_safe = sanitize_input(message)

    if not is_safe:
        return {
            "response": "I'm sorry, but I can't process that request. Please ask a valid question about your academic performance.",
            "query_used": None,
        }

    try:
        context = _build_student_context(student_id)

        prompt = STUDENT_SYSTEM_PROMPT.format(data_context=context)
        response = model.generate_content(
            [prompt, f"Student's question: {sanitized}"]
        )

        return {
            "response": response.text,
            "query_used": None,
        }
    except Exception as e:
        return {
            "response": f"I encountered an error. Please try again. Error: {str(e)}",
            "query_used": None,
        }


def _build_student_context(student_id: str) -> str:
    """Build a data context string containing only the student's own data."""
    try:
        # Get student info
        student = supabase_admin.table("students") \
            .select("*") \
            .eq("id", student_id) \
            .single() \
            .execute()

        student_data = student.data

        # Get their results with subject info
        results = supabase_admin.table("results") \
            .select("subject_id, semester, marks_obtained, max_marks, grade, pass_status") \
            .eq("student_id", student_id) \
            .execute()

        results_data = results.data or []

        # Get subject details
        subject_ids = list(set(r["subject_id"] for r in results_data))
        subjects = {}
        if subject_ids:
            subs = supabase_admin.table("subjects") \
                .select("id, subject_code, subject_name") \
                .in_("id", subject_ids) \
                .execute()
            subjects = {s["id"]: s for s in (subs.data or [])}

        lines = [
            f"Student Name: {student_data.get('student_name', 'N/A')}",
            f"Register Number: {student_data.get('register_number', 'N/A')}",
            f"Total Subjects Taken: {len(results_data)}",
            "",
            "Results by Semester:",
        ]

        # Group by semester
        by_sem: Dict[int, list] = {}
        for r in results_data:
            sem = r.get("semester", 0)
            if sem not in by_sem:
                by_sem[sem] = []
            by_sem[sem].append(r)

        overall_marks = 0.0
        overall_max = 0.0

        for sem in sorted(by_sem.keys()):
            sem_results = by_sem[sem]
            sem_marks = 0
            sem_max = 0
            passed = 0
            lines.append(f"\n  Semester {sem}:")
            for r in sem_results:
                sub = subjects.get(r["subject_id"], {})
                marks = r.get("marks_obtained", 0) or 0
                max_m = r.get("max_marks", 100) or 100
                sem_marks += float(marks)
                sem_max += float(max_m)
                if r.get("pass_status"):
                    passed += 1
                lines.append(
                    f"    {sub.get('subject_code', 'N/A')} ({sub.get('subject_name', 'N/A')}): "
                    f"{marks}/{max_m} - Grade: {r.get('grade', 'N/A')} - {'PASS' if r.get('pass_status') else 'FAIL'}"
                )

            pct = round(sem_marks / sem_max * 100, 1) if sem_max > 0 else 0
            lines.append(f"    Semester Percentage: {pct}%, Passed: {passed}/{len(sem_results)}")
            overall_marks += sem_marks
            overall_max += sem_max

        overall_pct = round(overall_marks / overall_max * 100, 1) if overall_max > 0 else 0
        lines.append(f"\nOverall Percentage: {overall_pct}%")

        return "\n".join(lines)
    except Exception as e:
        return f"Unable to load student data: {str(e)}"
