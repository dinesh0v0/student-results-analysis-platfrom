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
ALTER TABLE public.institutions FORCE ROW LEVEL SECURITY;

-- Admins can only see/manage their own institution
CREATE POLICY "Admins can view own institution"
    ON public.institutions FOR SELECT
    USING (admin_user_id = auth.uid());

CREATE POLICY "Admins can update own institution"
    ON public.institutions FOR UPDATE
    USING (admin_user_id = auth.uid())
    WITH CHECK (admin_user_id = auth.uid());

CREATE POLICY "Admins can insert own institution"
    ON public.institutions FOR INSERT
    WITH CHECK (admin_user_id = auth.uid());

-- =============================================================================
-- TABLE: students
-- =============================================================================
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    campus TEXT,
    faculty TEXT,
    department TEXT,
    branch TEXT,
    section TEXT,
    register_number TEXT NOT NULL,
    student_name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(institution_id, register_number)
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students FORCE ROW LEVEL SECURITY;

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
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- =============================================================================
-- TABLE: subjects
-- =============================================================================
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    semester INT NOT NULL CHECK (semester > 0 AND semester <= 12),
    max_marks NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK (max_marks > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(institution_id, subject_code, semester)
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects FORCE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view institution subjects"
    ON public.subjects FOR SELECT
    USING (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert institution subjects"
    ON public.subjects FOR INSERT
    WITH CHECK (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update institution subjects"
    ON public.subjects FOR UPDATE
    USING (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    )
    WITH CHECK (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can delete institution subjects"
    ON public.subjects FOR DELETE
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
    upload_batch_id UUID,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    campus TEXT,
    faculty TEXT,
    department TEXT,
    branch TEXT,
    section TEXT,
    semester INT NOT NULL CHECK (semester > 0 AND semester <= 12),
    marks_obtained NUMERIC(5,2) CHECK (marks_obtained IS NULL OR marks_obtained >= 0),
    max_marks NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK (max_marks > 0),
    grade TEXT,
    pass_status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (marks_obtained IS NULL OR marks_obtained <= max_marks),
    UNIQUE(student_id, subject_id, semester)
);

ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results FORCE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view institution results"
    ON public.results FOR SELECT
    USING (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert institution results"
    ON public.results FOR INSERT
    WITH CHECK (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update institution results"
    ON public.results FOR UPDATE
    USING (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    )
    WITH CHECK (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can delete institution results"
    ON public.results FOR DELETE
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

CREATE INDEX idx_students_hierarchy
    ON public.students (institution_id, campus, faculty, department, branch, section);

CREATE INDEX idx_results_hierarchy
    ON public.results (institution_id, campus, faculty, department, branch, section, semester);

CREATE INDEX idx_results_upload_batch_id
    ON public.results (upload_batch_id);

ALTER TABLE public.results
    ADD CONSTRAINT results_upload_batch_id_fkey
    FOREIGN KEY (upload_batch_id)
    REFERENCES public.upload_batches(id)
    ON DELETE SET NULL;

ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_batches FORCE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own upload batches"
    ON public.upload_batches FOR SELECT
    USING (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert own upload batches"
    ON public.upload_batches FOR INSERT
    WITH CHECK (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update own upload batches"
    ON public.upload_batches FOR UPDATE
    USING (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    )
    WITH CHECK (
        institution_id IN (
            SELECT id FROM public.institutions WHERE admin_user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can delete own upload batches"
    ON public.upload_batches FOR DELETE
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
ALTER TABLE public.chat_history FORCE ROW LEVEL SECURITY;

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
-- FUNCTION: Process a validated upload batch atomically
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_result_upload_batch(
    p_institution_id UUID,
    p_batch_id UUID,
    p_rows JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    row_data JSONB;
    v_student_id UUID;
    v_subject_id UUID;
    v_processed_count INT := 0;
BEGIN
    IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
        RAISE EXCEPTION 'Upload payload is empty';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.institutions
        WHERE id = p_institution_id
          AND admin_user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'You are not authorized to upload results for this institution';
    END IF;

    FOR row_data IN SELECT value FROM jsonb_array_elements(p_rows)
    LOOP
        INSERT INTO public.students (
            institution_id,
            campus,
            faculty,
            department,
            branch,
            section,
            register_number,
            student_name
        ) VALUES (
            p_institution_id,
            NULLIF(trim(COALESCE(row_data->>'campus', '')), ''),
            NULLIF(trim(COALESCE(row_data->>'faculty', '')), ''),
            NULLIF(trim(COALESCE(row_data->>'department', '')), ''),
            NULLIF(trim(COALESCE(row_data->>'branch', '')), ''),
            NULLIF(trim(COALESCE(row_data->>'section', '')), ''),
            trim(row_data->>'register_number'),
            trim(row_data->>'student_name')
        )
        ON CONFLICT (institution_id, register_number)
        DO UPDATE SET
            campus = EXCLUDED.campus,
            faculty = EXCLUDED.faculty,
            department = EXCLUDED.department,
            branch = EXCLUDED.branch,
            section = EXCLUDED.section,
            student_name = EXCLUDED.student_name,
            updated_at = NOW()
        RETURNING id INTO v_student_id;

        INSERT INTO public.subjects (
            institution_id,
            subject_code,
            subject_name,
            semester,
            max_marks
        ) VALUES (
            p_institution_id,
            trim(row_data->>'subject_code'),
            trim(COALESCE(row_data->>'subject_name', row_data->>'subject_code')),
            (row_data->>'semester')::INT,
            (row_data->>'max_marks')::NUMERIC(5,2)
        )
        ON CONFLICT (institution_id, subject_code, semester)
        DO UPDATE SET
            subject_name = EXCLUDED.subject_name,
            max_marks = EXCLUDED.max_marks
        RETURNING id INTO v_subject_id;

        INSERT INTO public.results (
            institution_id,
            upload_batch_id,
            student_id,
            subject_id,
            campus,
            faculty,
            department,
            branch,
            section,
            semester,
            marks_obtained,
            max_marks,
            grade,
            pass_status
        ) VALUES (
            p_institution_id,
            p_batch_id,
            v_student_id,
            v_subject_id,
            NULLIF(trim(COALESCE(row_data->>'campus', '')), ''),
            NULLIF(trim(COALESCE(row_data->>'faculty', '')), ''),
            NULLIF(trim(COALESCE(row_data->>'department', '')), ''),
            NULLIF(trim(COALESCE(row_data->>'branch', '')), ''),
            NULLIF(trim(COALESCE(row_data->>'section', '')), ''),
            (row_data->>'semester')::INT,
            (row_data->>'marks')::NUMERIC(5,2),
            (row_data->>'max_marks')::NUMERIC(5,2),
            trim(COALESCE(row_data->>'grade', 'N/A')),
            COALESCE((row_data->>'pass_status')::BOOLEAN, FALSE)
        )
        ON CONFLICT (student_id, subject_id, semester)
        DO UPDATE SET
            institution_id = EXCLUDED.institution_id,
            upload_batch_id = EXCLUDED.upload_batch_id,
            campus = EXCLUDED.campus,
            faculty = EXCLUDED.faculty,
            department = EXCLUDED.department,
            branch = EXCLUDED.branch,
            section = EXCLUDED.section,
            marks_obtained = EXCLUDED.marks_obtained,
            max_marks = EXCLUDED.max_marks,
            grade = EXCLUDED.grade,
            pass_status = EXCLUDED.pass_status;

        v_processed_count := v_processed_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'records_processed', v_processed_count,
        'status', 'completed'
    );
END;
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
