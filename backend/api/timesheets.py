from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import date as DateType
from database.database import get_db
from database import models

router = APIRouter(prefix="/api/timesheets", tags=["timesheets"])

@router.get("/")
def get_timesheets(db: Session = Depends(get_db)):
    return db.query(models.Timesheet).all()

@router.post("/log")
def log_work_hours(payload: dict = Body(...), db: Session = Depends(get_db)):
    employee_id = payload.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id is required")

    ts_id = f"TS-{db.query(models.Timesheet).count() + 1:03d}"
    work_date_str = payload.get("work_date")
    try:
        work_date = DateType.fromisoformat(work_date_str) if work_date_str else DateType.today()
    except ValueError:
        work_date = DateType.today()

    ts = models.Timesheet(
        id=ts_id,
        employee_id=employee_id,
        project_id=payload.get("project", payload.get("project_id", "General")),
        work_date=work_date,
        regular_hours=float(payload.get("regular_hours", payload.get("hours", 8.0))),
        overtime_hours=float(payload.get("overtime_hours", 0.0)),
        task_description=payload.get("description", payload.get("task_description", "Manual entry")),
        approval_status=payload.get("approval_status", "PENDING")
    )
    db.add(ts)
    db.commit()
    db.refresh(ts)
    return {"status": "logged", "timesheet_id": ts.id, "timesheet": ts}

