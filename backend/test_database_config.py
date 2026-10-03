import os
import sys
import subprocess

print("=========================================================")
print("  TESTING DATABASE ENVIRONMENT CONFIGURATION RULES")
print("=========================================================\n")

# Ensure UTF-8 output formatting
env_base = os.environ.copy()
env_base["PYTHONIOENCODING"] = "utf-8"

# -------------------------------------------------------------------
# TEST CASE 1: ENVIRONMENT=development (no DATABASE_URL) -> default SQLite
# -------------------------------------------------------------------
print("[TEST 1/4] Testing ENVIRONMENT=development without DATABASE_URL...")
env1 = env_base.copy()
env1["ENVIRONMENT"] = "development"
env1.pop("DATABASE_URL", None)
env1.pop("POSTGRES_HOST", None)
env1.pop("RDS_HOSTNAME", None)

cmd = [sys.executable, "-c", "from database.database import SQLALCHEMY_DATABASE_URL, check_db_connection; print('DB_URL:', SQLALCHEMY_DATABASE_URL); print('HEALTH:', check_db_connection())"]
res1 = subprocess.run(cmd, cwd=os.path.join(os.getcwd(), "backend"), capture_output=True, text=True, env=env1)

print("  STDOUT:", res1.stdout.strip())
assert res1.returncode == 0, f"Case 1 failed with exit code {res1.returncode}"
assert "sqlite" in res1.stdout.lower(), "Case 1 failed: Expected SQLite database URL"
assert "[DATABASE] Using SQLite database" in res1.stdout, "Case 1 failed: Missing clear SQLite log message"
print("  ==> PASS: Development mode correctly falls back to SQLite!\n")

# -------------------------------------------------------------------
# TEST CASE 2: ENVIRONMENT=development with explicit SQLite DATABASE_URL
# -------------------------------------------------------------------
print("[TEST 2/4] Testing development mode with an explicit SQLite DATABASE_URL...")
env_explicit_sqlite = env_base.copy()
env_explicit_sqlite["ENVIRONMENT"] = "development"
explicit_sqlite_path = os.path.join(os.getcwd(), "backend", "demo-test.sqlite").replace("\\", "/")
explicit_sqlite_url = f"sqlite:///{explicit_sqlite_path}"
env_explicit_sqlite["DATABASE_URL"] = explicit_sqlite_url
res_explicit_sqlite = subprocess.run(
    cmd, cwd=os.path.join(os.getcwd(), "backend"), capture_output=True, text=True,
    env=env_explicit_sqlite
)
assert res_explicit_sqlite.returncode == 0, "Explicit SQLite configuration failed to load"
assert explicit_sqlite_url in res_explicit_sqlite.stdout, "Explicit SQLite DATABASE_URL was ignored"
print("  ==> PASS: Development mode honors an explicit SQLite DATABASE_URL!\n")

# -------------------------------------------------------------------
# TEST CASE 3: ENVIRONMENT=production without DATABASE_URL -> Startup Failure
# -------------------------------------------------------------------
print("[TEST 3/4] Testing ENVIRONMENT=production without DATABASE_URL...")
env2 = env_base.copy()
env2["ENVIRONMENT"] = "production"
env2.pop("DATABASE_URL", None)
env2.pop("POSTGRES_HOST", None)
env2.pop("RDS_HOSTNAME", None)

res2 = subprocess.run(cmd, cwd=os.path.join(os.getcwd(), "backend"), capture_output=True, text=True, env=env2)

print("  STDOUT:", res2.stdout.strip())
print("  STDERR:", res2.stderr.strip()[:300])
assert res2.returncode != 0, "Case 2 failed: Production without DATABASE_URL should have failed to start!"
assert "RuntimeError" in res2.stderr or "Production configuration error" in res2.stdout or "Production configuration error" in res2.stderr, "Case 2 failed: Missing RuntimeError for production without DATABASE_URL"
assert "sqlite" not in res2.stdout.lower() or "sqlite is disabled" in res2.stdout.lower(), "Case 2 failed: SQLite must NOT be used in production"
print("  ==> PASS: Production mode correctly failed startup when DATABASE_URL is missing!\n")

# -------------------------------------------------------------------
# TEST CASE 4: ENVIRONMENT=production with invalid/failing PostgreSQL URL -> NO SQLite Fallback & Error Masked
# -------------------------------------------------------------------
print("[TEST 4/4] Testing ENVIRONMENT=production with unreachable PostgreSQL DATABASE_URL...")
env3 = env_base.copy()
env3["ENVIRONMENT"] = "production"
env3["DATABASE_URL"] = "postgresql+psycopg://postgres:secret_password_123@127.0.0.1:5432/workforce_db"

res3 = subprocess.run(cmd, cwd=os.path.join(os.getcwd(), "backend"), capture_output=True, text=True, env=env3)

print("  STDOUT:", res3.stdout.strip())
print("  STDERR:", res3.stderr.strip()[:300])
assert res3.returncode != 0, "Case 3 failed: Unreachable PostgreSQL in production should raise RuntimeError!"
assert "secret_password_123" not in res3.stdout, "Case 3 failed: Password was exposed in stdout!"
assert "secret_password_123" not in res3.stderr, "Case 3 failed: Password was exposed in stderr!"
assert "*****" in res3.stdout or "*****" in res3.stderr, "Case 3 failed: Password was not masked!"
assert "sqlite" not in res3.stdout.lower(), "Case 3 failed: Production must NEVER fall back to SQLite!"
print("  ==> PASS: Production mode refused SQLite fallback, raised startup error, and masked password!\n")

print("=========================================================")
print(" ALL 4 DATABASE ENVIRONMENT TEST CASES PASSED SUCCESSFULLY!")
print("=========================================================")
