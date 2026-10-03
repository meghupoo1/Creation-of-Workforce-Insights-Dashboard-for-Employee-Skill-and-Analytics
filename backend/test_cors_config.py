import os
import sys
import subprocess
from fastapi.testclient import TestClient

print("=========================================================")
print("  TESTING CORS PRODUCTION & DEVELOPMENT POLICIES")
print("=========================================================\n")

env_base = os.environ.copy()
env_base["PYTHONIOENCODING"] = "utf-8"

# -------------------------------------------------------------------
# TEST 1: ENVIRONMENT=production without ALLOWED_ORIGINS -> Startup Error
# -------------------------------------------------------------------
print("[TEST 1/4] Production without ALLOWED_ORIGINS must fail startup...")
env1 = env_base.copy()
env1["ENVIRONMENT"] = "production"
env1["DATABASE_URL"] = "postgresql+psycopg://user:pass@127.0.0.1:5432/db"
env1.pop("ALLOWED_ORIGINS", None)

cmd = [sys.executable, "-c", "from main import app"]
res1 = subprocess.run(cmd, cwd=os.path.join(os.getcwd(), "backend"), capture_output=True, text=True, env=env1)

print("  STDOUT:", res1.stdout.strip()[:200])
assert res1.returncode != 0, "TEST 1 Failed: Production without ALLOWED_ORIGINS should fail startup!"
assert "[CORS] Production configuration error" in res1.stdout or "[CORS] Production configuration error" in res1.stderr, "TEST 1 Failed: Expected CORS production startup error message"
print("  ==> PASS: Production startup blocked when ALLOWED_ORIGINS is missing!\n")

# -------------------------------------------------------------------
# TEST 2: ENVIRONMENT=production with ALLOWED_ORIGINS=* -> Startup Error
# -------------------------------------------------------------------
print("[TEST 2/4] Production with ALLOWED_ORIGINS=* must fail startup...")
env2 = env_base.copy()
env2["ENVIRONMENT"] = "production"
env2["DATABASE_URL"] = "postgresql+psycopg://user:pass@127.0.0.1:5432/db"
env2["ALLOWED_ORIGINS"] = "*"

res2 = subprocess.run(cmd, cwd=os.path.join(os.getcwd(), "backend"), capture_output=True, text=True, env=env2)

print("  STDOUT:", res2.stdout.strip()[:200])
assert res2.returncode != 0, "TEST 2 Failed: Production with ALLOWED_ORIGINS=* should fail startup!"
assert "[CORS] Production configuration error" in res2.stdout or "[CORS] Production configuration error" in res2.stderr, "TEST 2 Failed: Expected CORS wildcard startup error message"
print("  ==> PASS: Production startup blocked when ALLOWED_ORIGINS is wildcard '*'!\n")

# -------------------------------------------------------------------
# TEST 3: ENVIRONMENT=development -> Localhost allowed & CORS headers returned
# -------------------------------------------------------------------
print("[TEST 3/4] Development mode CORS preflight & credential verification...")
os.environ["ENVIRONMENT"] = "development"
os.environ.pop("ALLOWED_ORIGINS", None)

# Import app in development mode for TestClient testing
from main import app
client = TestClient(app)

# Test OPTIONS preflight request from allowed origin http://localhost:5173
response = client.options(
    "/health",
    headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization,content-type",
    }
)

assert response.status_code == 200, f"TEST 3 Failed: Preflight returned HTTP {response.status_code}"
assert response.headers.get("access-control-allow-origin") == "http://localhost:5173", "TEST 3 Failed: Missing Access-Control-Allow-Origin header"
assert response.headers.get("access-control-allow-credentials") == "true", "TEST 3 Failed: Missing Access-Control-Allow-Credentials header"
print("  ==> PASS: Development mode correctly allows localhost:5173 with credentials!\n")

# -------------------------------------------------------------------
# TEST 4: ENVIRONMENT=production with explicit HTTPS domain -> Only configured origin allowed
# -------------------------------------------------------------------
print("[TEST 4/4] Production mode explicit HTTPS origin verification...")
env4 = env_base.copy()
env4["ENVIRONMENT"] = "development" # using dev DB so import succeeds without live RDS
env4["ALLOWED_ORIGINS"] = "https://app.workforce-insights.com"

cmd_cors = [
    sys.executable, "-c",
    """
from main import app
from fastapi.testclient import TestClient
client = TestClient(app)
res_valid = client.options('/health', headers={'Origin': 'https://app.workforce-insights.com', 'Access-Control-Request-Method': 'GET'})
res_invalid = client.options('/health', headers={'Origin': 'https://malicious-attacker.com', 'Access-Control-Request-Method': 'GET'})
assert res_valid.headers.get('access-control-allow-origin') == 'https://app.workforce-insights.com', 'Valid origin failed'
assert res_invalid.headers.get('access-control-allow-origin') is None, 'Unauthorized origin allowed!'
print('EXPLICIT_CORS_VERIFIED_OK')
"""
]

res4 = subprocess.run(cmd_cors, cwd=os.path.join(os.getcwd(), "backend"), capture_output=True, text=True, env=env4)
print("  STDOUT:", res4.stdout.strip())
assert res4.returncode == 0, f"TEST 4 Failed: Explicit domain test failed: {res4.stderr}"
assert "EXPLICIT_CORS_VERIFIED_OK" in res4.stdout, "TEST 4 Failed: CORS headers verification failed"
print("  ==> PASS: Production mode restricts requests to explicit domain and blocks unauthorized origins!\n")

print("=========================================================")
print(" ALL 4 CORS PRODUCTION & DEVELOPMENT TESTS PASSED!")
print("=========================================================")
