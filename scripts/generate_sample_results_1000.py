import csv
from pathlib import Path

def _grade(marks: int, max_marks: int = 100) -> str:
    if max_marks <= 0:
        return "N/A"
    p = (marks / max_marks) * 100
    if p >= 90:
        return 'O'
    if p >= 80:
        return 'A+'
    if p >= 70:
        return 'A'
    if p >= 60:
        return 'B+'
    if p >= 50:
        return 'B'
    if p >= 40:
        return 'C'
    return 'F'

def generate(output_path: str, total_students: int = 200) -> None:
    campuses = ['Main Campus', 'North Campus', 'South Campus']
    faculties = ['Engineering', 'Science']
    departments = ['CSE', 'ME', 'ECE', 'EEE', 'CE', 'CHEM']
    branches = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL']
    sections = ['A', 'B', 'C']
    subject_codes = [ 'MA101', 'CS101', 'CS102', 'PH101', 'CH101' ]
    subject_names = [ 'Calculus', 'Intro to CS', 'Data Structures', 'Physics', 'Chemistry' ]

    rows = []
    for i in range(total_students):
        campus = campuses[i % len(campuses)]
        faculty = faculties[i % len(faculties)]
        dept = departments[i % len(departments)]
        branch = branches[i % len(branches)]
        section = sections[i % len(sections)]
        register_number = f"{branch}{i+1000:04d}"
        student_name = f"Student {i+1:04d}"
        semester = 1

        for j in range(5):
            code = subject_codes[j]
            sname = subject_names[j]
            marks = 60 + ((i * 11 + j * 7) % 41)  # 60..100
            max_marks = 100
            grade = _grade(marks, max_marks)
            rows.append([
                campus,
                faculty,
                dept,
                branch,
                section,
                register_number,
                student_name,
                semester,
                code,
                sname,
                marks,
                max_marks,
                grade
            ])

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['campus','faculty','department','branch','section','register_number','student_name','semester','subject_codes','subject_names','marks','max_marks','grades'])
        writer.writerows(rows)

if __name__ == '__main__':
    generate('sample_results_1000.csv', total_students=200)
