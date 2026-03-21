# =============================================================================
# PDF Generator — Student Academic Report
# =============================================================================
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from io import BytesIO
from typing import Dict, List, Any
from datetime import datetime


# Theme colors
PRIMARY = HexColor("#6366F1")
DARK = HexColor("#1E293B")
GRAY = HexColor("#64748B")
LIGHT_BG = HexColor("#F8FAFC")
WHITE = HexColor("#FFFFFF")
GREEN = HexColor("#10B981")
RED = HexColor("#EF4444")


def generate_student_report(
    student: Dict[str, Any],
    results: List[Dict[str, Any]],
    semesters: List[Dict[str, Any]],
    institution_name: str,
) -> BytesIO:
    """
    Generate a professional PDF report for a student's academic history.
    Returns a BytesIO buffer containing the PDF.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # Custom styles
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontSize=22,
        textColor=PRIMARY,
        spaceAfter=6,
        alignment=TA_CENTER,
    )
    subtitle_style = ParagraphStyle(
        "CustomSubtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=GRAY,
        alignment=TA_CENTER,
        spaceAfter=20,
    )
    heading_style = ParagraphStyle(
        "CustomHeading",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=DARK,
        spaceBefore=20,
        spaceAfter=10,
    )
    normal_style = ParagraphStyle(
        "CustomNormal",
        parent=styles["Normal"],
        fontSize=10,
        textColor=DARK,
    )

    # ---- Header ----
    elements.append(Paragraph("Academic Report", title_style))
    elements.append(Paragraph(institution_name, subtitle_style))
    elements.append(Spacer(1, 10))

    # ---- Student Info ----
    elements.append(Paragraph("Student Information", heading_style))
    info_data = [
        ["Name:", student.get("student_name", "N/A")],
        ["Register No:", student.get("register_number", "N/A")],
        ["Generated:", datetime.now().strftime("%B %d, %Y")],
    ]
    info_table = Table(info_data, colWidths=[3 * cm, 12 * cm])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), GRAY),
        ("TEXTCOLOR", (1, 0), (1, -1), DARK),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 15))

    # ---- Semester Summary ----
    if semesters:
        elements.append(Paragraph("Semester Overview", heading_style))
        sem_header = ["Semester", "Subjects", "Passed", "Failed", "Percentage"]
        sem_rows = [sem_header]
        for s in semesters:
            sem_rows.append([
                f"Semester {s.get('semester', 'N/A')}",
                str(s.get("total_subjects", 0)),
                str(s.get("passed", 0)),
                str(s.get("failed", 0)),
                f"{s.get('percentage', 0):.1f}%",
            ])

        sem_table = Table(sem_rows, colWidths=[3.5 * cm, 3 * cm, 2.5 * cm, 2.5 * cm, 3.5 * cm])
        sem_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(sem_table)
        elements.append(Spacer(1, 15))

    # ---- Detailed Results ----
    elements.append(Paragraph("Detailed Results", heading_style))

    # Group results by semester
    by_semester: Dict[int, list] = {}
    for r in results:
        sem = r.get("semester", 0)
        if sem not in by_semester:
            by_semester[sem] = []
        by_semester[sem].append(r)

    for sem_num in sorted(by_semester.keys()):
        elements.append(Paragraph(f"Semester {sem_num}", ParagraphStyle(
            "SemLabel", parent=styles["Normal"], fontSize=11,
            textColor=PRIMARY, spaceBefore=12, spaceAfter=6,
            fontName="Helvetica-Bold"
        )))

        res_header = ["Subject Code", "Subject Name", "Marks", "Grade", "Status"]
        res_rows = [res_header]
        for r in by_semester[sem_num]:
            marks_str = f"{r.get('marks_obtained', 'N/A')}/{r.get('max_marks', 100)}"
            status = "PASS" if r.get("pass_status") else "FAIL"
            res_rows.append([
                r.get("subject_code", "N/A"),
                r.get("subject_name", "N/A")[:30],
                marks_str,
                r.get("grade", "N/A"),
                status,
            ])

        res_table = Table(res_rows, colWidths=[3 * cm, 5.5 * cm, 2.5 * cm, 2 * cm, 2 * cm])
        res_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (2, 0), (-1, -1), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(res_table)

    # ---- Footer ----
    elements.append(Spacer(1, 30))
    elements.append(Paragraph(
        "This is a computer-generated document. No signature is required.",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8,
                       textColor=GRAY, alignment=TA_CENTER)
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer
