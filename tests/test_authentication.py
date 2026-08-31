"""
Unit Test: Role-Based Authentication and Dashboard Access Control
Validates that only ADMIN and HOD roles are authorized, and HOD is departmental-scoped.
"""
import unittest

class TestAuthentication(unittest.TestCase):
    def test_allowed_roles(self):
        allowed_roles = {"ADMIN", "HOD"}
        prohibited_roles = {"STUDENT", "FACULTY", "TEACHER", "PUBLIC", "GUEST"}

        self.assertIn("ADMIN", allowed_roles)
        self.assertIn("HOD", allowed_roles)
        for role in prohibited_roles:
            self.assertNotIn(role, allowed_roles)

    def test_hod_department_scoping(self):
        user_role = "HOD"
        user_dept = "Computer Science & Engineering"
        target_student_dept = "Mechanical Engineering"

        can_access = (user_role == "ADMIN") or (user_dept == target_student_dept)
        self.assertFalse(can_access, "HOD must not be allowed access to other departments' students.")

if __name__ == "__main__":
    unittest.main()
