from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date as DateType
from database.database import get_db
from database import models

router = APIRouter(prefix="/api/attendance", tags=["attendance"])

@router.get("/")
def get_all_attendance(db: Session = Depends(get_db)):
    return db.query(models.Attendance).all()

@router.post("/")
def mark_attendance(payload: dict = Body(...), db: Session = Depends(get_db)):
    employee_id = payload.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id is required")

    entry_date_str = payload.get("date")
    if isinstance(entry_date_str, str) and entry_date_str:
        try:
            entry_date = DateType.fromisoformat(entry_date_str)
        except ValueError:
            entry_date = DateType.today()
    else:
        entry_date = DateType.today()

    att = models.Attendance(
        employee_id=employee_id,
        date=entry_date,
        check_in=payload.get("check_in", "09:00"),
        check_out=payload.get("check_out", "17:00"),
        attendance_method=payload.get("attendance_method", payload.get("method", "Manual")),
        status=payload.get("status", "Present"),
        late_minutes=int(payload.get("late_minutes", 0)),
        overtime_minutes=int(payload.get("overtime_minutes", 0)),
        ai_validation="Validated",
        notes=payload.get("notes", "Manual entry")
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att

