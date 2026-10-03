from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import date as DateType
from database.database import get_db
from database import models
from api.notifications import create_notification

router = APIRouter(prefix="/api/leaves", tags=["leaves"])

@router.get("/")
def get_all_leave_requests(db: Session = Depends(get_db)):
    return db.query(models.LeaveRequest).all()

@router.post("/")
def create_leave_request(payload: dict = Body(...), db: Session = Depends(get_db)):
    employee_id = payload.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id is required")
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()

    leave_id = f"LV-{db.query(models.LeaveRequest).count() + 1:03d}"

    start_date_str = payload.get("start_date")
    end_date_str = payload.get("end_date")

    try:
        start_date = DateType.fromisoformat(start_date_str) if start_date_str else DateType.today()
    except ValueError:
        start_date = DateType.today()

    try:
        end_date = DateType.fromisoformat(end_date_str) if end_date_str else DateType.today()
    except ValueError:
        end_date = DateType.today()

    days_diff = (end_date - start_date).days + 1
    total_days = float(payload.get("total_days") or (days_diff if days_diff > 0 else 1.0))

    leave = models.LeaveRequest(
        id=leave_id,
        employee_id=employee_id,
        leave_type=payload.get("leave_type", "Annual"),
        start_date=start_date,
        end_date=end_date,
        total_days=total_days,
        reason=payload.get("reason", "Manual leave request"),
        status=payload.get("status", "PENDING")
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    if employee and employee.manager_id:
        create_notification(
            db,
            employee.manager_id,
            "LEAVE_REQUEST",
            "Leave request needs review",
            f"{employee.first_name} {employee.last_name} submitted a {leave.leave_type} leave request.",
        )
        db.commit()
    return leave

@router.post("/approve/{leave_id}")
def approve_leave(leave_id: str, db: Session = Depends(get_db)):
    leave = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == leave_id).first()
    if leave:
        leave.status = "APPROVED"
        create_notification(
            db,
            leave.employee_id,
            "LEAVE_APPROVED",
            "Leave request approved",
            f"Your {leave.leave_type} leave request was approved.",
        )
        db.commit()
        return {"status": "APPROVED", "leave_id": leave_id}
    return {"status": "NOT_FOUND"}

