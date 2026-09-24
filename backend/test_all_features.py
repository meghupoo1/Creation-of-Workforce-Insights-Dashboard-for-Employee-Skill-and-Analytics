import json
import os
import sys
import urllib.error
import urllib.request

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")


def request_json(path, method="GET", body=None):
    url = f"{BASE_URL}{path}"
    payload = None
    headers = {}
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            text = resp.read().decode("utf-8")
            data = json.loads(text) if text else {}
            print(f"[OK] [{method}] {path} -> HTTP {resp.status}")
            return data
    except urllib.error.HTTPError as exc:
        error_text = exc.read().decode("utf-8", errors="replace")
        print(f"[FAIL] [{method}] {path} -> HTTP {exc.code}: {error_text}")
        raise
    except Exception as exc:
        print(f"[FAIL] [{method}] {path} -> {exc}")
        raise


def assert_field(data, field_name, message):
    if data is None or field_name not in data:
        raise AssertionError(f"{message}: missing field '{field_name}'")


def main():
    print("--- RUNNING SMOKE TEST ---")
    checks = [
        ("health", lambda: request_json("/health"), lambda data: data.get("status") == "healthy"),
        ("login", lambda: request_json("/api/auth/login", method="POST", body={"email": "alex.rivera@northstar.example", "password": "admin123", "role": "HR"}), lambda data: "access_token" in data and data.get("email") == "alex.rivera@northstar.example"),
        ("create_employee", lambda: request_json("/api/employees/", method="POST", body={"first_name": "Test", "last_name": "Employee", "email": f"test.emp.{os.getpid()}@example.com", "department_id": "D001", "role": "QA Analyst", "access_role": "EMPLOYEE", "employment_status": "Active"}), lambda data: isinstance(data, dict) and "test.emp." in data.get("email", "")),
        ("employees", lambda: request_json("/api/employees/"), lambda data: isinstance(data, list) and len(data) >= 1),
        ("attendance", lambda: request_json("/api/attendance/"), lambda data: isinstance(data, list) and len(data) >= 1),
        ("payroll", lambda: request_json("/api/payroll/summary"), lambda data: isinstance(data, dict) and "total_records" in data and data.get("total_records", 0) > 0 and data.get("processed_records") == data.get("total_records")),
        ("automatic_salary_records", lambda: request_json("/api/payroll/records?pay_period=2026-08"), lambda data: isinstance(data, list) and len(data) >= 1 and all(row.get("base_salary", 0) > 0 and row.get("net_payroll_amount", 0) >= 0 for row in data)),
        ("salary_generation", lambda: request_json("/api/payroll/generate", method="POST", body={"pay_period": "2026-08"}), lambda data: isinstance(data, dict) and data.get("generated_records", 0) > 0 and all("net_pay" in row for row in data.get("records", []))),
        ("reports", lambda: request_json("/api/reports/daily-attendance"), lambda data: isinstance(data, dict) and data.get("report_name") == "Daily Attendance Summary"),
        ("ai_chatbot", lambda: request_json("/api/ai/chatbot", method="POST", body={"query": "Show me attendance and leave risk", "role": "HR Administrator"}), lambda data: isinstance(data, dict) and "answer" in data and "confidence" in data),
    ]

    failed = False
    for name, call, validator in checks:
        try:
            response = call()
            if not validator(response):
                raise AssertionError(f"{name} did not return expected content")
            print(f"[PASS] {name}\n")
        except Exception:
            failed = True
            print(f"[FAIL] {name}\n")

    if failed:
        print("Smoke test failed.")
        return 1

    print("Smoke test passed: core app routes are responding with valid data.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
