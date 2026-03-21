# =============================================================================
# Data Processor — CSV/XLSX Parsing & Validation Using Pandas
# =============================================================================
import pandas as pd
import io
from typing import Tuple, List, Dict, Any
from fastapi import UploadFile


# Expected column name mappings (case-insensitive, stripped)
COLUMN_ALIASES = {
    "register_number": ["register_number", "reg_no", "reg no", "roll_number", "roll no", "rollno", "registration_number", "enrollment_no"],
    "student_name": ["student_name", "name", "student name", "full_name", "full name"],
    "semester": ["semester", "sem", "semester_no", "sem_no"],
    "subject_code": ["subject_code", "sub_code", "subject code", "sub code", "course_code"],
    "subject_name": ["subject_name", "sub_name", "subject name", "sub name", "course_name", "course name"],
    "marks": ["marks", "marks_obtained", "marks obtained", "score", "total_marks", "obtained_marks"],
    "max_marks": ["max_marks", "max marks", "total", "out_of", "out of", "maximum_marks"],
    "grade": ["grade", "letter_grade", "letter grade"],
}


def _normalize_column_name(col: str) -> str:
    """Strip whitespace and lowercase a column name."""
    return col.strip().lower().replace(" ", "_")


def _map_columns(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """
    Map uploaded DataFrame columns to standard names.
    Returns the renamed DataFrame and a list of warnings.
    """
    warnings = []
    # Normalize all column names
    df.columns = [_normalize_column_name(c) for c in df.columns]

    mapped = {}
    for standard_name, aliases in COLUMN_ALIASES.items():
        found = False
        for alias in aliases:
            normalized_alias = _normalize_column_name(alias)
            if normalized_alias in df.columns:
                mapped[normalized_alias] = standard_name
                found = True
                break
        if not found and standard_name in ["register_number", "student_name", "semester", "subject_code", "marks"]:
            warnings.append(f"Required column '{standard_name}' not found. Expected one of: {aliases}")

    df = df.rename(columns=mapped)
    return df, warnings


def _validate_rows(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """
    Validate individual rows for correctness.
    Returns cleaned DataFrame and list of error messages.
    """
    errors = []
    valid_mask = pd.Series([True] * len(df), index=df.index)

    # Drop completely empty rows
    df = df.dropna(how="all").reset_index(drop=True)

    # Check required fields
    required = ["register_number", "student_name", "semester", "subject_code"]
    for col in required:
        if col in df.columns:
            missing = df[col].isna() | (df[col].astype(str).str.strip() == "")
            for idx in df[missing].index:
                errors.append(f"Row {idx + 2}: Missing '{col}'")
                valid_mask[idx] = False

    # Validate semester is numeric
    if "semester" in df.columns:
        for idx, val in df["semester"].items():
            try:
                sem = int(float(str(val).strip()))
                if sem < 1 or sem > 12:
                    errors.append(f"Row {idx + 2}: Semester '{val}' must be between 1 and 12")
                    valid_mask[idx] = False
                else:
                    df.at[idx, "semester"] = sem
            except (ValueError, TypeError):
                if pd.notna(val) and str(val).strip():
                    errors.append(f"Row {idx + 2}: Invalid semester value '{val}'")
                    valid_mask[idx] = False

    # Validate marks
    if "marks" in df.columns:
        for idx, val in df["marks"].items():
            if pd.notna(val) and str(val).strip():
                try:
                    marks = float(str(val).strip())
                    if marks < 0:
                        errors.append(f"Row {idx + 2}: Marks cannot be negative ({marks})")
                        valid_mask[idx] = False
                    else:
                        df.at[idx, "marks"] = marks
                except (ValueError, TypeError):
                    errors.append(f"Row {idx + 2}: Invalid marks value '{val}'")
                    valid_mask[idx] = False

    # Validate max_marks
    if "max_marks" in df.columns:
        for idx, val in df["max_marks"].items():
            if pd.notna(val) and str(val).strip():
                try:
                    max_m = float(str(val).strip())
                    if max_m <= 0:
                        errors.append(f"Row {idx + 2}: Max marks must be positive ({max_m})")
                        valid_mask[idx] = False
                    else:
                        df.at[idx, "max_marks"] = max_m
                except (ValueError, TypeError):
                    errors.append(f"Row {idx + 2}: Invalid max_marks value '{val}'")
                    valid_mask[idx] = False

    # Strip string columns
    str_cols = ["register_number", "student_name", "subject_code", "subject_name", "grade"]
    for col in str_cols:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()

    valid_df = df[valid_mask].reset_index(drop=True)
    return valid_df, errors


def calculate_grade(marks: float, max_marks: float) -> str:
    """Calculate letter grade from marks."""
    if max_marks == 0:
        return "N/A"
    pct = (marks / max_marks) * 100
    if pct >= 90:
        return "O"
    elif pct >= 80:
        return "A+"
    elif pct >= 70:
        return "A"
    elif pct >= 60:
        return "B+"
    elif pct >= 50:
        return "B"
    elif pct >= 40:
        return "C"
    else:
        return "F"


async def parse_upload_file(file: UploadFile) -> Tuple[pd.DataFrame, List[str]]:
    """
    Parse an uploaded CSV or XLSX file into a validated DataFrame.
    Returns (dataframe, errors).
    """
    content = await file.read()
    filename = file.filename or "unknown"
    errors: List[str] = []

    try:
        if filename.lower().endswith(".xlsx") or filename.lower().endswith(".xls"):
            df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
        elif filename.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            return pd.DataFrame(), [f"Unsupported file type: {filename}. Please upload .csv or .xlsx"]
    except Exception as e:
        return pd.DataFrame(), [f"Failed to read file '{filename}': {str(e)}"]

    if df.empty:
        return pd.DataFrame(), ["The uploaded file is empty."]

    # Map columns
    df, col_warnings = _map_columns(df)
    errors.extend(col_warnings)

    if col_warnings:
        return pd.DataFrame(), errors

    # Validate rows
    df, row_errors = _validate_rows(df)
    errors.extend(row_errors)

    # Fill defaults
    if "max_marks" not in df.columns:
        df["max_marks"] = 100.0
    else:
        df["max_marks"] = df["max_marks"].fillna(100.0)

    if "subject_name" not in df.columns:
        df["subject_name"] = df["subject_code"]

    # Calculate grades if not provided
    if "grade" not in df.columns or df["grade"].isna().all():
        if "marks" in df.columns:
            df["grade"] = df.apply(
                lambda row: calculate_grade(
                    float(row["marks"]) if pd.notna(row["marks"]) else 0,
                    float(row["max_marks"]) if pd.notna(row["max_marks"]) else 100
                ),
                axis=1
            )

    # Calculate pass_status
    if "marks" in df.columns:
        df["pass_status"] = df.apply(
            lambda row: (float(row["marks"]) / float(row["max_marks"])) * 100 >= 40
            if pd.notna(row["marks"]) and float(row["max_marks"]) > 0
            else False,
            axis=1
        )

    return df, errors
