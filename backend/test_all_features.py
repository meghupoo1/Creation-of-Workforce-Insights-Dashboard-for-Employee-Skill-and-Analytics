import json
import os
import sys
import urllib.error
import urllib.request

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")

def request_json(path, method="GET", body=None, headers=None):
    url = f"{BASE_URL}{path}"
    payload = None
    req_headers = headers or {}
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=payload, headers=req_headers, method=method)
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

def reject_invalid_login():
    url = f"{BASE_URL}/api/auth/login"
    payload = json.dumps({
        "email": "invalid@example.com",
        "password": "incorrect",
        "role": "HR_ADMIN",
    }).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            if response.status == 401:
                print("[OK] [POST] /api/auth/login -> HTTP 401 (invalid credentials rejected)")
                return {"rejected": True}
            raise AssertionError(f"Invalid credentials were accepted (HTTP {response.status})")
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            print("[OK] [POST] /api/auth/login -> HTTP 401 (invalid credentials rejected)")
            return {"rejected": True}
        error_text = exc.read().decode("utf-8", errors="replace")
        raise AssertionError(f"Unexpected HTTP {exc.code}: {error_text}") from exc

def main():
    print("=========================================================")
    print("--- RUNNING COMPREHENSIVE AI & WORKFORCE TEST SUITE ---")
    print("=========================================================")
    
    checks = [
        # 1. Health & Database
        ("1. Health Check", lambda: request_json("/health"), lambda data: data.get("status") == "healthy"),
        
        # 2. Authentication & JWT
        ("2. JWT Auth rejects invalid credentials", reject_invalid_login, lambda data: data.get("rejected") is True),
        
        # 3. Employee Management API
        ("3. Employee Directory API", lambda: request_json("/api/employees/"), lambda data: isinstance(data, list) and len(data) >= 1),
        
        # 4. Attendance API
        ("4. Attendance API", lambda: request_json("/api/attendance/"), lambda data: isinstance(data, list) and len(data) >= 1),
        
        # 4b. Biometric Face Verification API
        ("4b. Biometric Face Verification API", lambda: request_json("/api/attendance/verify-biometric", method="POST", body={"employee_id": "E001", "attendance_method": "Face recognition", "image_data": "data:image/jpeg;base64,dummyframedataforbiometricverification"}), lambda data: data.get("verified") is True and "confidence_score" in data),
        
        # 5. Leave Management API
        ("5. Leave Requests API", lambda: request_json("/api/leaves/"), lambda data: isinstance(data, list)),
        
        # 6. Payroll Summary API
        ("6. Payroll Summary API", lambda: request_json("/api/payroll/summary"), lambda data: isinstance(data, dict) and "total_payroll_cost" in data),
        
        # 7. Agentic AI Chatbot (LLM + Agent Tools + DB)
        ("7. Agentic AI Chatbot", lambda: request_json("/api/ai/chatbot", method="POST", body={"query": "Why is attrition high in Engineering and what is today's attendance?", "role": "HR Administrator"}), lambda data: isinstance(data, dict) and "answer" in data and "confidence" in data),
        
        # 8. Real RAG Document Retrieval Pipeline
        ("8. RAG Document Pipeline", lambda: request_json("/api/ai/rag-query", method="POST", body={"query": "What is the policy for annual leave carry forward?"}), lambda data: isinstance(data, dict) and data.get("grounded") is True and len(data.get("retrieved_chunks", [])) > 0),
        
        # 9. Real Random Forest ML Attrition Model
        ("9. ML Attrition Risk Model", lambda: request_json("/api/ai/attrition-risk?department=Engineering"), lambda data: isinstance(data, dict) and data.get("is_real_ml_model") is True and "attrition_probability" in data and "risk_level" in data),
        
        # 10. ML Attrition Model Evaluation Metrics
        ("10. Attrition Model Evaluation", lambda: request_json("/api/attrition/evaluation"), lambda data: isinstance(data, dict) and "accuracy" in data and "f1_score" in data and "confusion_matrix" in data),
        
        # 11. Real Workforce Demand Forecasting Model
        ("11. Workforce Demand Forecast Model", lambda: request_json("/api/forecast?months=6"), lambda data: isinstance(data, dict) and data.get("is_real_forecasting_model") is True and "predicted_headcount_needed" in data),
        
        # 12. Real Isolation Forest Attendance Anomaly Model
        ("12. ML Attendance Anomaly Detector", lambda: request_json("/api/ai/attendance-anomalies", method="POST", body={"employee_id": "E001", "check_in_time": "10:15", "location_latitude": 40.8500, "location_longitude": -73.8000}), lambda data: isinstance(data, dict) and data.get("is_anomaly") is True and "anomaly_score" in data),
        
        # 13. Real Absenteeism Risk Model
        ("13. ML Absenteeism Risk Model", lambda: request_json("/api/ai/absenteeism-prediction?employee_id=E001"), lambda data: isinstance(data, dict) and data.get("is_real_ml_model") is True and "predicted_absence_risk" in data),
        
        # 14. Skill Gap Analysis API
        ("14. Skill Gap Analysis", lambda: request_json("/api/skills/gap-analysis?employee_id=E001"), lambda data: isinstance(data, dict) and "overall_skill_gap_score" in data and "missing_skills" in data),
        
        # 15. Personalized Training Recommendations API
        ("15. Personalized Training API", lambda: request_json("/api/training/recommendations?employee_id=E001"), lambda data: isinstance(data, dict) and "recommendations" in data and len(data["recommendations"]) > 0),
        
        # 16. Dynamic Performance Analytics API
        ("16. Performance Analytics API", lambda: request_json("/api/analytics/performance"), lambda data: isinstance(data, dict) and data.get("is_dynamically_calculated") is True and "productivity_score" in data),
        
        # 17. DEI / Workforce Diversity Analytics API
        ("17. DEI Diversity Analytics API", lambda: request_json("/api/analytics/dei"), lambda data: isinstance(data, dict) and data.get("is_real_demographic_data") is True and "education_representation" in data),
        
        # 18. Dynamic AI Recommendation Engine
        ("18. AI Recommendation Engine", lambda: request_json("/api/ai/recommendations"), lambda data: isinstance(data, list) and len(data) >= 3),
        
        # 19. Integrations Status API
        ("19. System Integrations API", lambda: request_json("/api/integrations/"), lambda data: isinstance(data, list) and any(item.get("status") == "Demo/Mock" for item in data)),
        
        # 20. Reports Summary API
        ("20. Dynamic Reports API", lambda: request_json("/api/reports/daily-attendance"), lambda data: isinstance(data, dict) and data.get("report_name") == "Daily Attendance Summary")
    ]

    passed = 0
    failed = False
    for name, call, validator in checks:
        try:
            response = call()
            if not validator(response):
                raise AssertionError(f"{name} validation failed. Response: {response}")
            print(f"[PASS] {name}\n")
            passed += 1
        except Exception as exc:
            failed = True
            print(f"[FAIL] {name}: {exc}\n")

    print("=========================================================")
    print(f"TEST RESULTS: {passed} / {len(checks)} CHECKS PASSED")
    print("=========================================================")

    if failed:
        print("Some tests failed.")
        return 1

    print("ALL TESTS PASSED SUCCESSFULLY!")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
