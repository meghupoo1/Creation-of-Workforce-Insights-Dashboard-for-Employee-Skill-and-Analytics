from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import date as DateType
from database.database import get_db
from database import models

router = APIRouter(prefix="/api/shifts", tags=["shifts"])

@router.get("/")
def get_all_shifts(db: Session = Depends(get_db)):
    return db.query(models.Shift).all()

@router.post("/")
def create_shift(payload: dict = Body(...), db: Session = Depends(get_db)):
    shift_id = payload.get("id") or f"SH-{db.query(models.Shift).count() + 1:03d}"
    shift = models.Shift(
        id=shift_id,
        shift_name=payload.get("shift_name", "General Shift"),
        shift_type=payload.get("shift_type", "Fixed"),
        start_time=payload.get("start_time", "09:00"),
        end_time=payload.get("end_time", "17:00"),
        break_minutes=int(payload.get("break_minutes", 60)),
        required_headcount=int(payload.get("required_headcount", 1)),
        status=payload.get("status", "Published")
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift

@router.get("/assignments")
def get_shift_assignments(db: Session = Depends(get_db)):
    return db.query(models.ShiftAssignment).all()

@router.post("/assign")
def assign_shift(payload: dict = Body(...), db: Session = Depends(get_db)):
    employee_id = payload.get("employee_id")
    shift_id = payload.get("shift_id")
    if not employee_id or not shift_id:
        raise HTTPException(status_code=400, detail="employee_id and shift_id are required")

    assignment_id = f"SA-{db.query(models.ShiftAssignment).count() + 1:03d}"
    assign_date_str = payload.get("assignment_date")
    try:
        assign_date = DateType.fromisoformat(assign_date_str) if assign_date_str else DateType.today()
    except ValueError:
        assign_date = DateType.today()

    assignment = models.ShiftAssignment(
        id=assignment_id,
        employee_id=employee_id,
        shift_id=shift_id,
        assignment_date=assign_date,
        status="Assigned",
        ai_allocated=False
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment

@router.get("/{shift_id}")
def get_shift(shift_id: str, db: Session = Depends(get_db)):
    return db.query(models.Shift).filter(models.Shift.id == shift_id).first()

