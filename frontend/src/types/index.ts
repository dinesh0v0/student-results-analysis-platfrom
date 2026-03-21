export interface Institution {
  id: string;
  name: string;
  email: string;
}

export interface Student {
  id: string;
  register_number: string;
  student_name: string;
  email?: string;
  institution_id: string;
}

export interface Subject {
  id: string;
  subject_code: string;
  subject_name: string;
  semester: number;
  max_marks: number;
}

export interface Result {
  id: string;
  student_id: string;
  subject_code: string;
  subject_name: string;
  semester: number;
  marks_obtained?: number;
  max_marks: number;
  grade?: string;
  pass_status: boolean;
}

export interface SemesterSummary {
  semester: number;
  total_subjects: number;
  passed: number;
  failed: number;
  percentage: number;
  gpa?: number;
}

export interface AcademicHistory {
  student: Student;
  semesters: SemesterSummary[];
  results: Result[];
}

export interface AdminDashboardStats {
  total_students: number;
  total_subjects: number;
  total_results: number;
  overall_pass_percentage: number;
  semesters_available: number[];
}

export interface GradeDistribution {
  grade: string;
  count: number;
  percentage: number;
}

export interface SubjectPerformance {
  subject_code: string;
  subject_name: string;
  semester: number;
  total_students: number;
  passed: number;
  failed: number;
  pass_percentage: number;
  average_marks: number;
}

export interface DashboardResponse {
  stats: AdminDashboardStats;
  grade_distribution: GradeDistribution[];
  subject_performance: SubjectPerformance[];
  top_performers: Student[];
}

export interface UploadResponse {
  batch_id: string;
  records_processed: number;
  records_failed: number;
  errors: string[];
  status: string;
}

export interface UploadHistory {
  id: string;
  file_name: string;
  records_processed: number;
  records_failed: number;
  status: string;
  uploaded_at: string;
}
