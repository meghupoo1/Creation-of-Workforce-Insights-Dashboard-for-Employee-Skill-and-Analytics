import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from api import auth
from database import models
from database import mongodb


class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.mongo_sync_patch = patch.object(mongodb, "sync_sql_changes")
        self.mongo_sync_patch.start()
        self.engine = create_engine("sqlite:///:memory:")
        models.Base.metadata.create_all(bind=self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.employee = models.Employee(
            id="EMP-001",
            employee_code="EMP-001",
            first_name="Admin",
            last_name="User",
            email="admin@example.com",
            role="System Administrator",
            access_role="ADMIN",
            employment_status="Active",
        )
        self.db.add(self.employee)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self.mongo_sync_patch.stop()
        if mongodb.client is not None:
            mongodb.client.close()

    def test_login_requires_existing_email_password_and_matching_role(self):
        self.employee.password_hash = auth.hash_password("correct-horse")
        self.db.commit()

        login_response = auth.login(
            auth.LoginRequest(email=" ADMIN@example.com ", password="correct-horse", role="System Admin"),
            self.db,
        )
        self.assertEqual(login_response.employee_id, "EMP-001")

        for request in (
            auth.LoginRequest(email="missing@example.com", password="correct-horse", role="System Admin"),
            auth.LoginRequest(email="admin@example.com", password="wrong-password", role="System Admin"),
            auth.LoginRequest(email="admin@example.com", password="correct-horse", role="Employee"),
        ):
            with self.subTest(request=request):
                with self.assertRaises(HTTPException) as raised:
                    auth.login(request, self.db)
                self.assertEqual(raised.exception.status_code, 401)

    def test_bootstrap_admin_password_is_saved_as_hash(self):
        with patch.dict(os.environ, {
            "ADMIN_EMAIL": "admin@example.com",
            "ADMIN_INITIAL_PASSWORD": "first-password",
        }):
            response = auth.login(
                auth.LoginRequest(email="admin@example.com", password="first-password", role="System Admin"),
                self.db,
            )

        self.assertTrue(response.access_token)
        self.assertTrue(auth.verify_password("first-password", self.employee.password_hash))

    def test_admin_issued_setup_code_is_single_use(self):
        issued = auth.issue_setup_code(
            auth.IssueSetupCodeRequest(email="admin@example.com"),
            self.db,
            {"role": "ADMIN"},
        )
        request = auth.PasswordSetupRequest(
            email="admin@example.com",
            setup_code=issued.setup_code,
            new_password="new-password",
        )

        self.assertEqual(auth.set_password(request, self.db)["message"], "Password set successfully")
        self.assertTrue(auth.verify_password("new-password", self.employee.password_hash))
        with self.assertRaises(HTTPException) as raised:
            auth.set_password(request, self.db)
        self.assertEqual(raised.exception.status_code, 400)

    def test_invalid_email_and_missing_or_insufficient_authentication_are_rejected(self):
        with self.assertRaises(ValidationError):
            auth.LoginRequest(email="not-an-email", password="password", role="System Admin")

        with self.assertRaises(HTTPException) as missing_auth:
            auth.get_current_user(None, self.db)
        self.assertEqual(missing_auth.exception.status_code, 401)

        with self.assertRaises(HTTPException) as demo_token:
            auth.get_current_user(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials="demo-token-ADMIN"),
                self.db,
            )
        self.assertEqual(demo_token.exception.status_code, 401)

        valid_token = auth.create_access_token({"sub": "EMP-001", "role": "ADMIN"})
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=valid_token)
        self.assertEqual(auth.get_current_user(credentials, self.db)["role"], "ADMIN")
        self.employee.access_role = "EMPLOYEE"
        self.db.commit()
        with self.assertRaises(HTTPException) as stale_admin_token:
            auth.get_current_user(credentials, self.db)
        self.assertEqual(stale_admin_token.exception.status_code, 401)

        role_checker = auth.require_role(["ADMIN"])
        with self.assertRaises(HTTPException) as insufficient_role:
            role_checker({"role": "EMPLOYEE"})
        self.assertEqual(insufficient_role.exception.status_code, 403)
        self.assertEqual(role_checker({"role": "ADMIN"}), {"role": "ADMIN"})


if __name__ == "__main__":
    unittest.main()
