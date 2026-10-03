import os
import secrets
import sqlite3
from pathlib import Path

from passlib.context import CryptContext


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DB = ROOT / "backend" / "workforce_db.db"
DEMO_DB = ROOT / "backend" / "workforce_demo.db"
BACKEND_ENV = ROOT / "backend" / ".env.demo"
FRONTEND_ENV = ROOT / ".env.local"

DEMO_ROLES = (
    ("admin", "System Admin", "ADMIN"),
    ("hr", "HR Administrator", "HR_ADMIN"),
    ("manager", "Manager", "MANAGER"),
    ("employee", "Employee", "EMPLOYEE"),
)
password_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    pbkdf2_sha256__default_rounds=600_000,
    deprecated="auto",
)


def choose_account(connection: sqlite3.Connection, role: str) -> tuple[str, str]:
    row = connection.execute(
        """
        SELECT employee_id, email
        FROM (
            SELECT id AS employee_id, email, manager_id
            FROM employees
            WHERE upper(access_role) = ?
              AND lower(coalesce(employment_status, 'Active')) = 'active'
        ) AS candidates
        ORDER BY
            (SELECT COUNT(*) FROM employees AS reports
             WHERE reports.manager_id = candidates.employee_id) DESC,
            (SELECT COUNT(*) FROM attendance
             WHERE attendance.employee_id = candidates.employee_id) DESC,
            employee_id
        LIMIT 1
        """,
        (role,),
    ).fetchone()
    if not row or not row[1]:
        raise RuntimeError(f"No active {role} employee with an email exists in the source database.")
    return row[0], row[1]


def create_demo_database(
    source_path: Path, destination_path: Path
) -> list[tuple[str, str, str, str, str]]:
    if not source_path.is_file():
        raise FileNotFoundError(f"Source database not found: {source_path}")
    if destination_path.exists():
        raise FileExistsError(f"Demo database already exists; refusing to overwrite: {destination_path}")

    destination_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(destination_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    os.close(descriptor)
    try:
        with sqlite3.connect(source_path.resolve().as_uri() + "?mode=ro", uri=True) as source:
            with sqlite3.connect(destination_path) as destination:
                source.backup(destination)
                columns = {
                    row[1] for row in destination.execute("PRAGMA table_info(employees)")
                }
                required_columns = {"id", "email", "access_role", "employment_status", "password_hash"}
                if not required_columns.issubset(columns):
                    raise RuntimeError("Source database is missing required employee authentication columns.")

                accounts = []
                for role_id, label, access_role in DEMO_ROLES:
                    employee_id, email = choose_account(destination, access_role)
                    password = secrets.token_urlsafe(18)
                    accounts.append((role_id, label, employee_id, email, password))

                destination.execute("BEGIN")
                destination.execute("UPDATE employees SET password_hash = NULL")
                for _, _, employee_id, _, password in accounts:
                    destination.execute(
                        "UPDATE employees SET password_hash = ? WHERE id = ?",
                        (password_context.hash(password), employee_id),
                    )
                if destination.execute(
                    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'auth_setup_codes'"
                ).fetchone():
                    destination.execute("DELETE FROM auth_setup_codes")
                destination.commit()

                result = destination.execute("PRAGMA quick_check").fetchone()
                if not result or result[0] != "ok":
                    raise RuntimeError(f"Demo database integrity check failed: {result}")

        return accounts
    except Exception:
        destination_path.unlink(missing_ok=True)
        raise


def write_new_file(path: Path, content: str) -> None:
    with path.open("x", encoding="utf-8", newline="\n") as output:
        output.write(content)


def main() -> None:
    for path in (DEMO_DB, BACKEND_ENV, FRONTEND_ENV):
        if path.exists():
            raise FileExistsError(f"Refusing to overwrite existing demo output: {path}")

    accounts = create_demo_database(SOURCE_DB, DEMO_DB)
    email_by_role = {role_id: email for role_id, _, _, email, _ in accounts}
    frontend_content = "\n".join(
        f"VITE_DEMO_{role.upper()}_EMAIL={email_by_role[role]}"
        for role, _, _ in DEMO_ROLES
    ) + "\n"
    jwt_secret = secrets.token_urlsafe(48)
    database_url = f"sqlite:///{DEMO_DB.resolve().as_posix()}"
    backend_content = (
        f"DATABASE_URL={database_url}\n"
        f"JWT_SECRET_KEY={jwt_secret}\n"
        "ENVIRONMENT=development\n"
        "ALLOWED_ORIGINS=http://localhost:5173\n"
    )
    write_new_file(FRONTEND_ENV, frontend_content)
    write_new_file(BACKEND_ENV, backend_content)

    print("Created an isolated demo database; the source database was not changed.")
    print("Use these credentials in the matching role card (passwords are shown only once):")
    for _, label, _, email, password in accounts:
        print(f"{label}: {email} / {password}")
    print("\nStart the backend from the backend directory:")
    print("  ..\\.venv\\Scripts\\python.exe -m uvicorn main:app --env-file .env.demo --host 127.0.0.1 --port 8000")
    print("Restart the Vite dev server so it loads the generated .env.local role emails.")
    print("Do not deploy or share this local demo database; it contains copied employee records.")


if __name__ == "__main__":
    main()
