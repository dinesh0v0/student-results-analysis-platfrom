export interface Institution {
  id: string;
  name: string;
  email: string;
}

export interface HierarchyFilters {
  campus?: string | null;
  faculty?: string | null;
  department?: string | null;
  branch?: string | null;
  section?: string | null;
}

export interface DashboardFilterOptions extends HierarchyFilters {
  campus_options: string[];
  faculty_options: string[];
  department_options: string[];
  branch_options: string[];
  section_options: string[];
}

export interface Student extends HierarchyFilters {
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

export interface Result extends HierarchyFilters {
  id: string;
  student_id: string;
  upload_batch_id?: string | null;
  subject_code: string;
  subject_name: string;
  semester: number;
  marks_obtained?: number;
  max_marks: number;
  grade?: string;
  pass_status: boolean;
  register_number?: string;
  student_name?: string;
  file_name?: string;
  created_at?: string;
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
  active_scope_label: string;
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

export interface SectionOverview extends HierarchyFilters {
  total_results: number;
  passed: number;
  pass_percentage: number;
  average_marks: number;
}

export interface DashboardResponse {
  stats: AdminDashboardStats;
  grade_distribution: GradeDistribution[];
  subject_performance: SubjectPerformance[];
  top_performers: Student[];
  filters: DashboardFilterOptions;
  section_overview: SectionOverview[];
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
