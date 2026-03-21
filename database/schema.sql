-- =============================================================================
-- Student Result Analysis Platform — Supabase Database Schema
-- =============================================================================
-- Run this entire file in the Supabase SQL Editor to set up all tables,
-- functions, triggers, and Row Level Security policies.
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLE: institutions
-- =============================================================================
CREATE TABLE public.institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    admin_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

-- Admins can only see/manage their own institution
CREATE POLICY "Admins can view own institution"
    ON public.institutions FOR SELECT
    USING (admin_user_id = auth.uid());

CREATE POLICY "Admins can update own institution"
    ON public.institutions FOR UPDATE
    USING (admin_user_id = auth.uid());

-- Service role inserts during registration (no INSERT policy needed for anon)
CREATE POLICY "Service role can insert institutions"
    ON public.institutions FOR INSERT
    WITH CHECK (admin_user_id = auth.uid());

-- =============================================================================
-- TABLE: students
-- =============================================================================
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    register_number TEXT NOT NULL,
    student_name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(institution_id, register_number)
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Admins see students in their institution
CREATE POLICY "Admins can view institution students"
    ON public.students FOR SELECT
    USING (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert institution students"
    ON public.students FOR INSERT
    WITH CHECK (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update institution students"
    ON public.students FOR UPDATE
    USING (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can delete institution students"
    ON public.students FOR DELETE
    USING (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

-- Students can view their own record
CREATE POLICY "Students can view own record"
    ON public.students FOR SELECT
    USING (auth_user_id = auth.uid());

-- Students can update their own email/profile
CREATE POLICY "Students can update own record"
    ON public.students FOR UPDATE
    USING (auth_user_id = auth.uid());

-- =============================================================================
-- TABLE: subjects
-- =============================================================================
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    semester INT NOT NULL CHECK (semester > 0 AND semester <= 12),
    max_marks INT DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(institution_id, subject_code, semester)
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage institution subjects"
    ON public.subjects FOR ALL
    USING (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

CREATE POLICY "Students can view subjects of their institution"
    ON public.subjects FOR SELECT
    USING (
        institution_id IN (
            SELECT institution_id FROM public.students WHERE auth_user_id = auth.uid()
        )
    );

-- =============================================================================
-- TABLE: results
-- =============================================================================
CREATE TABLE public.results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    semester INT NOT NULL CHECK (semester > 0 AND semester <= 12),
    marks_obtained NUMERIC(5,2),
    max_marks NUMERIC(5,2) DEFAULT 100,
    grade TEXT,
    pass_status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, subject_id, semester)
);

ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- Admins can manage results for their institution
CREATE POLICY "Admins can manage institution results"
    ON public.results FOR ALL
    USING (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

-- Students can only view their own results
CREATE POLICY "Students can view own results"
    ON public.results FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM public.students WHERE auth_user_id = auth.uid()
        )
    );

-- =============================================================================
-- TABLE: upload_batches
-- =============================================================================
CREATE TABLE public.upload_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    records_processed INT DEFAULT 0,
    records_failed INT DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_log JSONB DEFAULT '[]'::jsonb,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage own upload batches"
    ON public.upload_batches FOR ALL
    USING (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

-- =============================================================================
-- TABLE: chat_history (for AI assistant)
-- =============================================================================
CREATE TABLE public.chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
    message TEXT NOT NULL,
    response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat history"
    ON public.chat_history FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chat messages"
    ON public.chat_history FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- HELPER FUNCTION: Get institution_id for current admin user
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_institution_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT id FROM public.institutions WHERE admin_user_id = auth.uid() LIMIT 1;
$$;

-- =============================================================================
-- HELPER FUNCTION: Get student record for current authenticated student
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_student_record()
RETURNS SETOF public.students
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT * FROM public.students WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- =============================================================================
-- FUNCTION: Auto-update updated_at timestamp
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_institutions_updated
    BEFORE UPDATE ON public.institutions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_students_updated
    BEFORE UPDATE ON public.students
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- INDEXES for performance
-- =============================================================================
CREATE INDEX idx_students_institution ON public.students(institution_id);
CREATE INDEX idx_students_register_number ON public.students(register_number);
CREATE INDEX idx_results_student ON public.results(student_id);
CREATE INDEX idx_results_institution ON public.results(institution_id);
CREATE INDEX idx_results_semester ON public.results(semester);
CREATE INDEX idx_subjects_institution ON public.subjects(institution_id);
CREATE INDEX idx_chat_history_user ON public.chat_history(user_id);

-- =============================================================================
-- SAMPLE DATA HELPER: Function to calculate grade from marks
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculate_grade(marks NUMERIC, max_marks NUMERIC)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    percentage NUMERIC;
BEGIN
    IF max_marks = 0 THEN RETURN 'N/A'; END IF;
    percentage := (marks / max_marks) * 100;
    RETURN CASE
        WHEN percentage >= 90 THEN 'O'
        WHEN percentage >= 80 THEN 'A+'
        WHEN percentage >= 70 THEN 'A'
        WHEN percentage >= 60 THEN 'B+'
        WHEN percentage >= 50 THEN 'B'
        WHEN percentage >= 40 THEN 'C'
        ELSE 'F'
    END;
END;
$$;
