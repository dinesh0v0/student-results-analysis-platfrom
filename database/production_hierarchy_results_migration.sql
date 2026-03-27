ALTER TABLE public.students ADD COLUMN IF NOT EXISTS campus TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS faculty TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS section TEXT;

ALTER TABLE public.results ADD COLUMN IF NOT EXISTS upload_batch_id UUID;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS campus TEXT;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS faculty TEXT;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS section TEXT;

CREATE INDEX IF NOT EXISTS idx_students_hierarchy
    ON public.students (institution_id, campus, faculty, department, branch, section);

CREATE INDEX IF NOT EXISTS idx_results_hierarchy
    ON public.results (institution_id, campus, faculty, department, branch, section, semester);

CREATE INDEX IF NOT EXISTS idx_results_upload_batch_id
    ON public.results (upload_batch_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'results_upload_batch_id_fkey'
          AND table_schema = 'public'
          AND table_name = 'results'
    ) THEN
        ALTER TABLE public.results
            ADD CONSTRAINT results_upload_batch_id_fkey
            FOREIGN KEY (upload_batch_id)
            REFERENCES public.upload_batches(id)
            ON DELETE SET NULL;
    END IF;
END $$;

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
