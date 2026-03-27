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
    campus: Optional[str] = None
    faculty: Optional[str] = None
    department: Optional[str] = None
    branch: Optional[str] = None
    section: Optional[str] = None


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
    upload_batch_id: Optional[str] = None
    subject_code: str
    subject_name: str
    semester: int
    marks_obtained: Optional[float] = None
    max_marks: float
    grade: Optional[str] = None
    pass_status: bool
    campus: Optional[str] = None
    faculty: Optional[str] = None
    department: Optional[str] = None
    branch: Optional[str] = None
    section: Optional[str] = None
    register_number: Optional[str] = None
    student_name: Optional[str] = None
    file_name: Optional[str] = None
    created_at: Optional[datetime] = None


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
    active_scope_label: str = "Institution-wide"


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
    filters: "DashboardFilterOptions"
    section_overview: List["SectionOverview"]


# ---- Upload ----
class UploadResponse(BaseModel):
    batch_id: str
    records_processed: int
    records_failed: int
    errors: List[str]
    status: str


class HierarchyFilters(BaseModel):
    campus: Optional[str] = None
    faculty: Optional[str] = None
    department: Optional[str] = None
    branch: Optional[str] = None
    section: Optional[str] = None


class DashboardFilterOptions(HierarchyFilters):
    campus_options: List[str] = []
    faculty_options: List[str] = []
    department_options: List[str] = []
    branch_options: List[str] = []
    section_options: List[str] = []


class SectionOverview(BaseModel):
    campus: Optional[str] = None
    faculty: Optional[str] = None
    department: Optional[str] = None
    branch: Optional[str] = None
    section: Optional[str] = None
    total_results: int
    passed: int
    pass_percentage: float
    average_marks: float


class UpdateResultRequest(BaseModel):
    marks_obtained: float = Field(..., ge=0)
    max_marks: Optional[float] = Field(None, gt=0)
    grade: Optional[str] = Field(None, max_length=10)


class DeleteBatchResponse(BaseModel):
    deleted_results: int
    deleted_batch_id: str


# ---- AI Chat ----
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    response: str
    query_used: Optional[str] = None


DashboardResponse.model_rebuild()
