"""
SITS SmartAttend AI - Student Registration and Face Enrollment CLI
Siddhartha Institute of Technology and Sciences
"""
import os
import sys
import json
import uuid
import datetime

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
STUDENTS_FILE = os.path.join(DATA_DIR, "students.json")

def register_student(full_name, roll_number, department, section, academic_year="2025-2026"):
    os.makedirs(DATA_DIR, exist_ok=True)
    students = []
    if os.path.exists(STUDENTS_FILE):
        with open(STUDENTS_FILE, "r") as f:
            try:
                students = json.load(f)
            except Exception:
                students = []

    # Check duplicate
    for s in students:
        if s.get("roll_number", "").upper() == roll_number.strip().upper():
            print(f"[ERROR] Student with Roll Number {roll_number} already registered: {s.get('full_name')}")
            return False

    student_id = f"SITS-{department[:3].upper()}-{roll_number.strip().upper()}"
    new_student = {
        "id": f"std_{int(datetime.datetime.now().timestamp())}_{str(uuid.uuid4())[:4]}",
        "student_id": student_id,
        "full_name": full_name.strip(),
        "roll_number": roll_number.strip().upper(),
        "department": department.strip(),
        "section": section.strip().upper(),
        "academic_year": academic_year,
        "batch": "2023-2027",
        "mobile": "",
        "email": "",
        "face_registered": False,
        "face_images_count": 0,
        "face_images": [],
        "encodings": [],
        "status": "ACTIVE",
        "created_at": datetime.datetime.now().isoformat(),
        "updated_at": datetime.datetime.now().isoformat(),
    }

    students.append(new_student)
    with open(STUDENTS_FILE, "w") as f:
        json.dump(students, f, indent=2)

    print(f"[SUCCESS] Registered {full_name} ({roll_number}) in {department} - Section {section}.")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: python register_student.py <FullName> <RollNumber> <Department> <Section> [AcademicYear]")
        sys.exit(1)
    name = sys.argv[1]
    roll = sys.argv[2]
    dept = sys.argv[3]
    sec = sys.argv[4]
    year = sys.argv[5] if len(sys.argv) > 5 else "2025-2026"
    register_student(name, roll, dept, sec, year)
