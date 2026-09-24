import calendar
import re
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database.database import get_db
from database import models

router = APIRouter(prefix="/api/payroll", tags=["payroll"])


class PayrollGenerationRequest(BaseModel):
    pay_period: str = Field(..., description="Pay period as YYYY-MM or Month YYYY")
    default_base_salary: float = Field(5000.0, ge=0)
    overtime_multiplier: float = Field(1.5, ge=0)
    working_days: Optional[int] = Field(None, ge=1, le=31)


def normalize_pay_period(value: str):
    if not value:
        return value
    value = str(value).strip()
    if re.fullmatch(r"\d{4}-\d{2}", value):
        try:
            return datetime.strptime(f"{value}-01", "%Y-%m-%d").strftime("%B %Y")
        except ValueError:
            pass
    return value


def period_bounds(value: str):
    normalized = normalize_pay_period(value)
    match = re.fullmatch(r"([A-Za-z]+)\s+(\d{4})", normalized or "")
    if not match:
        raise HTTPException(status_code=400, detail="pay_period must be YYYY-MM or Month YYYY")
    try:
        month = datetime.strptime(match.group(1), "%B").month
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="pay_period must be YYYY-MM or Month YYYY") from exc
    year = int(match.group(2))
    return normalized, date(year, month, 1), date(year, month, calendar.monthrange(year, month)[1])


def as_number(value):
    return float(value or 0)


def business_days(start_date, end_date):
    return sum(
        1 for day_offset in range((end_date - start_date).days + 1)
        if (start_date + timedelta(days=day_offset)).weekday() < 5
    )


def _generate_payroll_records(payload: PayrollGenerationRequest, db: Session, only_missing=False):
    normalized, start_date, end_date = period_bounds(payload.pay_period)
    employees = db.query(models.Employee).filter(models.Employee.employment_status.ilike("active")).all()
    if not employees:
        raise HTTPException(status_code=409, detail="No active employees are available for payroll generation")

    working_days = payload.working_days or business_days(start_date, end_date)
    generated_records = []
    total_net = 0.0

    for employee in employees:
        existing = db.query(models.PayrollInput).filter(
            models.PayrollInput.employee_id == employee.id,
            models.PayrollInput.pay_period == normalized,
        ).first()
        if only_missing and existing:
            continue

        base_salary = as_number(existing.base_salary) if existing and existing.base_salary else payload.default_base_salary
        bonus = as_number(existing.bonuses_incentives) if existing else 0.0
        attendance_rows = db.query(models.Attendance).filter(
            models.Attendance.employee_id == employee.id,
            models.Attendance.date >= start_date,
            models.Attendance.date <= end_date,
        ).all()
        present_days = sum(1 for row in attendance_rows if str(row.status or "").lower() in {"present", "late"})
        overtime_hours = sum(row.overtime_minutes or 0 for row in attendance_rows) / 60
        approved_leave = db.query(models.LeaveRequest).filter(
            models.LeaveRequest.employee_id == employee.id,
            models.LeaveRequest.status == "APPROVED",
            models.LeaveRequest.start_date <= end_date,
            models.LeaveRequest.end_date >= start_date,
        ).all()
        paid_leave_days = sum(as_number(row.total_days) for row in approved_leave)
        unpaid_days = max(0.0, working_days - present_days - paid_leave_days)
        daily_rate = base_salary / working_days
        leave_deduction = round(unpaid_days * daily_rate, 2)
        overtime_pay = round((base_salary / (working_days * 8)) * payload.overtime_multiplier * overtime_hours, 2)
        net_pay = round(base_salary - leave_deduction + overtime_pay + bonus, 2)

        if existing:
            record = existing
        else:
            record = models.PayrollInput(
                id=f"PAY-{employee.id}-{start_date.strftime('%Y%m')}",
                employee_id=employee.id,
                pay_period=normalized,
            )
            db.add(record)
        record.base_salary = round(base_salary, 2)
        record.total_present_days = present_days
        record.total_paid_leaves = round(paid_leave_days, 2)
        record.unpaid_leave_deductions = leave_deduction
        record.overtime_pay = overtime_pay
        record.bonuses_incentives = round(bonus, 2)
        record.net_payroll_amount = net_pay
        record.payroll_status = "Processed"
        generated_records.append({
            "employee_id": employee.id,
            "employee_name": f"{employee.first_name} {employee.last_name}",
            "base_salary": record.base_salary,
            "present_days": present_days,
            "paid_leave_days": round(paid_leave_days, 2),
            "unpaid_leave_deduction": record.unpaid_leave_deductions,
            "overtime_hours": round(overtime_hours, 2),
            "overtime_pay": overtime_pay,
            "bonus": record.bonuses_incentives,
            "net_pay": net_pay,
        })
        total_net += net_pay

    db.commit()
    return normalized, generated_records, total_net


def ensure_payroll_generated(pay_period: str, db: Session):
    normalized = normalize_pay_period(pay_period)
    active_count = db.query(models.Employee).filter(models.Employee.employment_status.ilike("active")).count()
    record_count = db.query(models.PayrollInput).filter(models.PayrollInput.pay_period == normalized).count()
    if active_count and record_count < active_count:
        _generate_payroll_records(PayrollGenerationRequest(pay_period=pay_period), db, only_missing=True)


@router.get("/summary")
def get_payroll_summary(pay_period: str = "August 2026", db: Session = Depends(get_db)):
    ensure_payroll_generated(pay_period, db)
    normalized = normalize_pay_period(pay_period)
    records = db.query(models.PayrollInput).filter(models.PayrollInput.pay_period.in_([normalized, pay_period])).all()
    if not records:
        records = db.query(models.PayrollInput).filter(models.PayrollInput.pay_period.like(f"%{normalized.split()[1]}%")) .all()
    total_net = sum(r.net_payroll_amount or 0.0 for r in records)
    processed_count = sum(1 for r in records if str(r.payroll_status).lower() == "processed")
    return {
        "pay_period": normalized,
        "total_records": len(records),
        "processed_records": processed_count,
        "total_payroll_cost": total_net,
        "payroll_status": "Ready" if len(records) > 0 and processed_count == len(records) else "In Progress"
    }


@router.get("/records")
def get_payroll_records(pay_period: str = "August 2026", db: Session = Depends(get_db)):
    ensure_payroll_generated(pay_period, db)
    normalized = normalize_pay_period(pay_period)
    return db.query(models.PayrollInput).filter(models.PayrollInput.pay_period == normalized).all()


@router.post("/generate")
def generate_payroll(payload: PayrollGenerationRequest, db: Session = Depends(get_db)):
    normalized, generated_records, total_net = _generate_payroll_records(payload, db)
    return {
        "pay_period": normalized,
        "generated_records": len(generated_records),
        "total_payroll_cost": round(total_net, 2),
        "payroll_status": "Processed",
        "records": generated_records,
    }


@router.post("/calculate-overtime")
def calculate_overtime(employee_id: str, db: Session = Depends(get_db)):
    # Calculate attendance overtime minutes for employee
    attendances = db.query(models.Attendance).filter(models.Attendance.employee_id == employee_id).all()
    total_ot_minutes = sum(a.overtime_minutes or 0 for a in attendances)
    ot_hours = total_ot_minutes / 60.0
    ot_pay = ot_hours * 45.0 # standard rate
    return {
        "employee_id": employee_id,
        "total_overtime_minutes": total_ot_minutes,
        "overtime_hours": round(ot_hours, 2),
        "calculated_overtime_pay": round(ot_pay, 2)
    }

@router.post("/manual")
def create_manual_payroll(payload: dict, db: Session = Depends(get_db)):
    employee_id = payload.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id is required")

    pay_period = payload.get("pay_period", "August 2026")
    normalized = normalize_pay_period(pay_period)
    base_salary = float(payload.get("base_salary", 5000.0))
    bonus = float(payload.get("bonuses_incentives", payload.get("bonus", 0.0)))
    overtime_pay = float(payload.get("overtime_pay", 0.0))
    net_pay = base_salary + bonus + overtime_pay

    record_id = f"PAY-{employee_id}-{datetime.now().strftime('%Y%m')}"
    existing = db.query(models.PayrollInput).filter(
        models.PayrollInput.employee_id == employee_id,
        models.PayrollInput.pay_period == normalized
    ).first()

    if existing:
        existing.base_salary = base_salary
        existing.bonuses_incentives = bonus
        existing.overtime_pay = overtime_pay
        existing.net_payroll_amount = net_pay
        existing.payroll_status = payload.get("payroll_status", "Processed")
        record = existing
    else:
        record = models.PayrollInput(
            id=record_id,
            employee_id=employee_id,
            pay_period=normalized,
            base_salary=base_salary,
            total_present_days=22.0,
            total_paid_leaves=0.0,
            unpaid_leave_deductions=0.0,
            overtime_pay=overtime_pay,
            bonuses_incentives=bonus,
            net_payroll_amount=net_pay,
            payroll_status=payload.get("payroll_status", "Processed")
        )
        db.add(record)

    db.commit()
    db.refresh(record)
    return record

