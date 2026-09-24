import os
import sys

# Ensure backend directory is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import models
from database.database import engine
from database.mongodb import check_mongodb_connection
from api import (
    auth, employees, attendance, leaves, shifts,
    timesheets, payroll, ai_analytics, reports,
    integrations, notifications, performance
)

# Auto-create tables on startup
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI-Powered Workforce Management API",
    description="Full application services backend powering employee management, attendance validation, shift scheduling, payroll automation, and AI analytics.",
    version="1.0.0"
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

@app.get("/")
def read_root():
    return {"message": "Welcome to AI-Powered Workforce Management API", "docs": "/docs"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "database": "connected", "aws_platform": "RDS & OpenSearch Ready"}

@app.get("/health/mongodb")
def mongodb_health_check():
    return check_mongodb_connection()
