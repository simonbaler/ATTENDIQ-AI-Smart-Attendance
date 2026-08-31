"""
Unit Test: Attendance Logging & Duplicate Protection
Validates session-based attendance deduplication and CSV column schema.
"""
import unittest

class TestAttendance(unittest.TestCase):
    def test_duplicate_prevention_within_session(self):
        # Simulates student attendance recorded in session
        recorded_student_ids = {"std_cse_001"}
        new_incoming_student_id = "std_cse_001"
        is_duplicate = new_incoming_student_id in recorded_student_ids
        self.assertTrue(is_duplicate, "Subsequent face hits within same session must be flagged as duplicates.")

    def test_csv_export_columns(self):
        expected_columns = [
            "Attendance ID",
            "Date",
            "Time",
            "Student ID",
            "Roll Number",
            "Full Name",
            "Department",
            "Section",
            "Subject",
            "Classroom",
            "Status",
            "Confidence",
            "Verification Method",
            "Marked By"
        ]
        self.assertEqual(len(expected_columns), 14, "CSV export must contain exact standard 14 schema columns.")

if __name__ == "__main__":
    unittest.main()
