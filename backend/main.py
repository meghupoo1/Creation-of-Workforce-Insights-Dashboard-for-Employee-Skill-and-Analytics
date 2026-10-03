import os
import sys

# Ensure backend directory is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent / ".env")

# Validate CORS environment policy immediately on startup
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower().strip()
IS_PRODUCTION = (ENVIRONMENT == "production")

raw_origins = os.getenv("ALLOWED_ORIGINS", "").strip()

if IS_PRODUCTION:
    if not raw_origins or raw_origins == "*":
        error_msg = "[CORS] Production configuration error: ENVIRONMENT=production requires an explicitly configured ALLOWED_ORIGINS (e.g., ALLOWED_ORIGINS=https://your-frontend-domain.com). Wildcard '*' or empty origins are prohibited in production."
        print(error_msg)
        raise RuntimeError(error_msg)
    allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    if "*" in allowed_origins:
        error_msg = "[CORS] Production configuration error: Wildcard '*' origin is prohibited in ALLOWED_ORIGINS when ENVIRONMENT=production."
        print(error_msg)
        raise RuntimeError(error_msg)
else:
    if not raw_origins or raw_origins == "*":
        allowed_origins = [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:8000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:8000",
        ]
    else:
        allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

from database import models
from database.database import engine, check_db_connection
from database.mongodb import check_mongodb_connection
from api import (
    auth, employees, attendance, leaves, shifts,
    timesheets, payroll, ai_analytics, reports,
    integrations, notifications, performance
)

# Auto-create tables on startup
models.Base.metadata.create_all(bind=engine)


def ensure_employee_salary_column():
    columns = {column["name"] for column in inspect(engine).get_columns("employees")}
    with engine.begin() as connection:
        if "base_salary" not in columns:
            connection.exec_driver_sql("ALTER TABLE employees ADD COLUMN base_salary FLOAT DEFAULT 0.0")
        if "experience_years" not in columns:
            connection.exec_driver_sql("ALTER TABLE employees ADD COLUMN experience_years FLOAT DEFAULT 0.0")
        if "password_hash" not in columns:
            connection.exec_driver_sql("ALTER TABLE employees ADD COLUMN password_hash VARCHAR")


ensure_employee_salary_column()
employees.backfill_employee_compensation()

app = FastAPI(
    title="AI-Powered Workforce Management API",
    description="Full application services backend powering employee management, attendance validation, shift scheduling, payroll automation, and AI analytics.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(attendance.router)
app.include_router(leaves.router)
app.include_router(shifts.router)
app.include_router(timesheets.router)
app.include_router(payroll.router)
app.include_router(ai_analytics.router)
app.include_router(reports.router)
app.include_router(integrations.router)
app.include_router(notifications.router)
app.include_router(performance.router)

@app.get("/health")
def health_check():
    db_health = check_db_connection()
    return {
        "status": "healthy" if db_health.get("status") == "healthy" else "degraded",
        "database": db_health,
        "aws_platform": "RDS & OpenSearch Ready"
    }

@app.get("/health/mongodb")
def mongodb_health_check():
    return check_mongodb_connection()

# Serve static React frontend in production if dist directory exists
dist_path = Path(__file__).resolve().parent.parent / "dist"
if dist_path.exists():
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=dist_path / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("health") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return None
        file_path = dist_path / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(dist_path / "index.html")
else:
    @app.get("/")
    def read_root():
        return {"message": "Welcome to AI-Powered Workforce Management API", "docs": "/docs"}

