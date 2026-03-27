# =============================================================================
# Pydantic Schemas — Request/Response Models
# =============================================================================
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime


# ---- Auth ----
class AdminRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    institution_name: str = Field(..., min_length=2, max_length=255)


class StudentVerifyRequest(BaseModel):
    institution_id: str
    register_number: str = Field(..., min_length=1, max_length=50)


class StudentRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    institution_id: str
    register_number: str = Field(..., min_length=1, max_length=50)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    user_id: str
    email: str
    role: str
    institution_id: Optional[str] = None
    student_id: Optional[str] = None


class SessionResponse(BaseModel):
    user_id: str
    email: str
    role: str
    institution_id: Optional[str] = None
    student_id: Optional[str] = None


# ---- Institution ----
class InstitutionResponse(BaseModel):
    id: str
    name: str
    email: str


# ---- Student ----
class StudentResponse(BaseModel):
    id: str
    register_number: str
    student_name: str
    email: Optional[str] = None
    institution_id: str


# ---- Subject ----
class SubjectResponse(BaseModel):
    id: str
    subject_code: str
    subject_name: str
    semester: int
    max_marks: float


# ---- Result ----
class ResultResponse(BaseModel):
    id: str
    student_id: str
    subject_code: str
    subject_name: str
    semester: int
    marks_obtained: Optional[float] = None
    max_marks: float
    grade: Optional[str] = None
    pass_status: bool


class SemesterSummary(BaseModel):
    semester: int
    total_subjects: int
    passed: int
    failed: int
    percentage: float
    gpa: Optional[float] = None


class AcademicHistory(BaseModel):
    student: StudentResponse
    semesters: List[SemesterSummary]
    results: List[ResultResponse]


# ---- Dashboard ----
class AdminDashboardStats(BaseModel):
    total_students: int
    total_subjects: int
    total_results: int
    overall_pass_percentage: float
    semesters_available: List[int]


class GradeDistribution(BaseModel):
    grade: str
    count: int
    percentage: float


class SubjectPerformance(BaseModel):
    subject_code: str
    subject_name: str
    semester: int
    total_students: int
    passed: int
    failed: int
    pass_percentage: float
    average_marks: float


class DashboardResponse(BaseModel):
    stats: AdminDashboardStats
    grade_distribution: List[GradeDistribution]
    subject_performance: List[SubjectPerformance]
    top_performers: List[StudentResponse]


# ---- Upload ----
class UploadResponse(BaseModel):
    batch_id: str
    records_processed: int
    records_failed: int
    errors: List[str]
    status: str


# ---- AI Chat ----
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    response: str
    query_used: Optional[str] = None
