from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date, timedelta
import uuid
from database.database import get_db
from database import models
from schemas import full_schemas as schemas
from api.notifications import create_notification

router = APIRouter(prefix="/api/employees", tags=["employees"])


def calculate_base_salary(access_role: str, role_name: str, worker_type: str = "Employee", department_name: str = "", experience_years: float = 0) -> float:
    access = str(access_role or "EMPLOYEE").upper()
    name = str(role_name or "").lower()
    department = str(department_name or "").lower()

    if any(value in name for value in ["chief", "vice president", "director"]):
        salary = 140000.0
    elif "manager" in name or access == "MANAGER":
        salary = 95000.0
    elif any(value in name for value in ["engineer", "developer", "architect"]):
        salary = 78000.0
    elif any(value in name for value in ["analyst", "data scientist"]):
        salary = 70000.0
    elif any(value in name for value in ["designer", "research"]):
        salary = 74000.0
    elif any(value in name for value in ["human resources", "hr ", "recruit"]):
        salary = 68000.0
    elif access == "ADMIN":
        salary = 115000.0
    elif access in {"HR_ADMIN", "HR"}:
        salary = 82000.0
    else:
        salary = 56000.0

    if any(value in department for value in ["engineering", "technology", "finance"]):
        salary *= 1.08
    elif "product" in department:
        salary *= 1.05
    elif any(value in department for value in ["customer", "success", "human resources", "hr"]):
        salary *= 0.98
    elif any(value in department for value in ["operations", "support"]):
        salary *= 0.96

    salary *= 1 + min(max(float(experience_years or 0), 0), 25) * 0.02
    if str(worker_type or "Employee").lower() == "contractor":
        salary *= 0.85
    elif str(worker_type or "").lower() == "intern":
        salary *= 0.5

    return max(30000.0, round(salary / 100) * 100)


def backfill_employee_compensation():
    db = next(get_db())
    try:
        departments = {item.id: item.department_name or "" for item in db.query(models.Department).all()}
        allocations = {item.employee_id: item.experience_years for item in db.query(models.Allocation).all() if item.experience_years is not None}
        for employee in db.query(models.Employee).all():
            years = employee.experience_years or allocations.get(employee.id)
            if not years and employee.hire_date:
                years = max(0, (date.today() - employee.hire_date).days / 365.25)
            employee.experience_years = float(years or 0)
            employee.base_salary = calculate_base_salary(
                employee.access_role,
                employee.role,
                employee.worker_type,
                departments.get(employee.department_id, ""),
                employee.experience_years,
            )
        db.commit()
    finally:
        db.close()


@router.get("/options")
def get_employee_options(db: Session = Depends(get_db)):
    managers = db.query(models.Employee).filter(models.Employee.access_role == "MANAGER").order_by(models.Employee.last_name, models.Employee.first_name).all()
    return {
        "departments": [{"id": item.id, "name": item.department_name, "department_head_id": item.department_head_id} for item in db.query(models.Department).order_by(models.Department.department_name).all()],
        "locations": [{"id": item.id, "name": item.location_name, "city": item.city, "country": item.country} for item in db.query(models.Location).order_by(models.Location.location_name).all()],
        "managers": [{"id": item.id, "name": f"{item.first_name} {item.last_name}", "access_role": item.access_role, "department_id": item.department_id} for item in managers],
    }

@router.get("/")
def get_employees(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Employee).offset(skip).limit(limit).all()

@router.post("/", response_model=schemas.EmployeeSchema, status_code=status.HTTP_201_CREATED)
def create_employee(payload: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    if db.query(models.Employee).filter(models.Employee.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Employee with this email already exists")

    department = db.query(models.Department).filter(models.Department.id == payload.department_id).first()
    experience_years = max(float(payload.experience_years or 0), 0)
    location_id = payload.location_id or (department.location_id if department else None)
    fallback_manager = db.query(models.Employee).filter(models.Employee.access_role == "MANAGER").order_by(models.Employee.last_name, models.Employee.first_name).first()
    manager_id = payload.manager_id or (department.department_head_id if department else None) or (fallback_manager.id if fallback_manager else None)
    base_salary = calculate_base_salary(
        payload.access_role,
        payload.role,
        payload.worker_type,
        department.department_name if department else "",
        experience_years,
    )

    employee = models.Employee(
        id=payload.employee_code or f"E{db.query(models.Employee).count() + 1:03d}",
        employee_code=payload.employee_code or f"EMP-{db.query(models.Employee).count() + 1:03d}",
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        phone=payload.phone,
        department_id=payload.department_id,
        role=payload.role,
        access_role=payload.access_role,
        base_salary=base_salary,
        experience_years=experience_years,
        manager_id=manager_id,
        location_id=location_id,
        hire_date=payload.hire_date,
        employment_status=payload.employment_status,
        worker_type=payload.worker_type,
        mfa_enabled=payload.mfa_enabled,
        profile_completion=payload.profile_completion,
    )

    db.add(employee)
    db.commit()
    db.refresh(employee)

    has_followup_updates = False
    if str(employee.access_role or "").upper() == "MANAGER":
        create_notification(
            db,
            employee.id,
            "MANAGER_ADDED",
            "Manager workspace ready",
            f"Your manager account is active. Your team and pending approvals will appear here.",
        )
        has_followup_updates = True
    else:
        create_notification(
            db,
            employee.id,
            "EMPLOYEE_ADDED",
            "Welcome to Northstar",
            "Your employee account is ready. Your profile, schedule, and workplace updates will appear here.",
        )
        has_followup_updates = True
    if manager_id:
        create_notification(
            db,
            manager_id,
            "TEAM_MEMBER_ADDED",
            "New team member added",
            f"{employee.first_name} {employee.last_name} joined your team.",
        )
        has_followup_updates = True

    shifts_query = db.query(models.Shift).filter(models.Shift.status == "Published")
    shift = shifts_query.filter(models.Shift.location_id == location_id).first() if location_id else None
    shift = shift or shifts_query.first()
    if shift:
        if not employee.location_id:
            employee.location_id = shift.location_id
        assignment = models.ShiftAssignment(
            id=f"SA-{uuid.uuid4().hex[:12]}",
            employee_id=employee.id,
            shift_id=shift.id,
            assignment_date=date.today(),
            status="Assigned",
            ai_allocated=True,
        )
        db.add(assignment)
        has_followup_updates = True
    if has_followup_updates:
        db.commit()
        db.refresh(employee)
    return employee


@router.get("/{employee_id}/workspace")
def get_employee_workspace(employee_id: str, db: Session = Depends(get_db)):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    department = db.query(models.Department).filter(models.Department.id == employee.department_id).first() if employee.department_id else None
    location = db.query(models.Location).filter(models.Location.id == employee.location_id).first() if employee.location_id else None
    manager = db.query(models.Employee).filter(models.Employee.id == employee.manager_id).first() if employee.manager_id else None
    assignment = db.query(models.ShiftAssignment).filter(
        models.ShiftAssignment.employee_id == employee.id,
        models.ShiftAssignment.status == "Assigned",
    ).order_by(models.ShiftAssignment.assignment_date.desc()).first()
    shift = db.query(models.Shift).filter(models.Shift.id == assignment.shift_id).first() if assignment else None
    shift_location = db.query(models.Location).filter(models.Location.id == shift.location_id).first() if shift and shift.location_id else None

    return {
        "employee": schemas.EmployeeSchema.from_orm(employee).dict(),
        "department_name": department.department_name if department else "Unassigned",
        "location": {"name": location.location_name, "city": location.city, "country": location.country} if location else None,
        "manager": {"id": manager.id, "name": f"{manager.first_name} {manager.last_name}"} if manager else None,
        "shift": {
            "name": shift.shift_name,
            "start_time": shift.start_time,
            "end_time": shift.end_time,
            "assignment_date": assignment.assignment_date,
            "location": ", ".join(value for value in [shift_location.location_name, shift_location.city] if value) if shift_location else "Location not set",
            "assigned_by": "Automatic scheduling",
        } if shift and assignment else None,
    }


@router.get("/{employee_id}/team")
def get_manager_team(employee_id: str, db: Session = Depends(get_db)):
    manager = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    if str(manager.access_role or "").upper() != "MANAGER":
        raise HTTPException(status_code=403, detail="This employee is not a manager")

    team = db.query(models.Employee).filter(models.Employee.manager_id == manager.id).order_by(models.Employee.last_name, models.Employee.first_name).all()
    team_ids = [employee.id for employee in team]
    today = date.today()
    locations = {location.id: location for location in db.query(models.Location).all()}
    departments = {department.id: department.department_name for department in db.query(models.Department).all()}
    attendance_by_employee = {}
    leaves_by_employee = {}
    shifts_by_employee = {}
    weekly_hours = {}
    allocation_hours = {}
    productivity_by_employee = {}

    if team_ids:
        for record in db.query(models.Attendance).filter(models.Attendance.employee_id.in_(team_ids), models.Attendance.date == today).order_by(models.Attendance.id).all():
            attendance_by_employee[record.employee_id] = record
        leaves = db.query(models.LeaveRequest).filter(models.LeaveRequest.employee_id.in_(team_ids)).order_by(models.LeaveRequest.start_date).all()
        for leave in leaves:
            leaves_by_employee.setdefault(leave.employee_id, []).append(leave)
        assignments = db.query(models.ShiftAssignment).filter(
            models.ShiftAssignment.employee_id.in_(team_ids),
            models.ShiftAssignment.status != "Cancelled",
        ).order_by(models.ShiftAssignment.assignment_date.desc()).all()
        shifts = {shift.id: shift for shift in db.query(models.Shift).all()}
        for assignment in assignments:
            assigned_shift = shifts.get(assignment.shift_id)
            if not assigned_shift:
                continue
            assigned_location = locations.get(assigned_shift.location_id)
            assignment_data = {
                "id": assigned_shift.id,
                "name": assigned_shift.shift_name,
                "start_time": assigned_shift.start_time,
                "end_time": assigned_shift.end_time,
                "date": assignment.assignment_date,
                "status": assignment.status,
                "location": ", ".join(value for value in [assigned_location.location_name, assigned_location.city] if value) if assigned_location else "Location not set",
            }
            current = shifts_by_employee.get(assignment.employee_id)
            if assignment.assignment_date >= today:
                if not current or current["date"] < today or assignment.assignment_date < current["date"]:
                    shifts_by_employee[assignment.employee_id] = assignment_data
            elif not current:
                shifts_by_employee[assignment.employee_id] = {**assignment_data, "status": "Past"}

        projects = {project.id: project.project_name for project in db.query(models.ProjectClient).all()}
        for entry in db.query(models.Timesheet).filter(
            models.Timesheet.employee_id.in_(team_ids),
            models.Timesheet.work_date >= today - timedelta(days=6),
        ).all():
            hours = float(entry.regular_hours or 0) + float(entry.overtime_hours or 0)
            weekly_hours[entry.employee_id] = weekly_hours.get(entry.employee_id, 0.0) + hours
            project_name = projects.get(entry.project_id, "Unassigned project")
            allocation_hours[project_name] = allocation_hours.get(project_name, 0.0) + hours
        for review in db.query(models.PerformanceReview).filter(models.PerformanceReview.employee_id.in_(team_ids)).all():
            if review.productivity_rating is not None:
                productivity_by_employee.setdefault(review.employee_id, []).append(float(review.productivity_rating))

    members = []
    for employee in team:
        attendance = attendance_by_employee.get(employee.id)
        leave_records = leaves_by_employee.get(employee.id, [])
        active_leave = next((item for item in leave_records if item.status == "APPROVED" and item.start_date <= today <= item.end_date), None)
        status = attendance.status if attendance else "On Leave" if active_leave else "Not recorded"
        location = locations.get(employee.location_id)
        ratings = productivity_by_employee.get(employee.id, [])
        members.append({
            "id": employee.id,
            "employee_code": employee.employee_code,
            "name": f"{employee.first_name} {employee.last_name}",
            "email": employee.email,
            "role": employee.role,
            "department": departments.get(employee.department_id, "Unassigned"),
            "status": status,
            "check_in": attendance.check_in if attendance else None,
            "location": ", ".join(value for value in [location.location_name, location.city] if value) if location else "Location not set",
            "shift": shifts_by_employee.get(employee.id),
            "pending_leave_count": sum(1 for item in leave_records if item.status == "PENDING"),
            "weekly_hours": round(weekly_hours.get(employee.id, 0.0), 1),
            "utilization_percent": min(100, round(weekly_hours.get(employee.id, 0.0) / 40 * 100)) if employee.id in weekly_hours else None,
            "productivity_rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
        })

    pending_leaves = [
        {
            "id": leave.id,
            "employee_id": leave.employee_id,
            "employee_name": f"{employee.first_name} {employee.last_name}",
            "leave_type": leave.leave_type,
            "start_date": leave.start_date,
            "end_date": leave.end_date,
            "status": leave.status,
        }
        for employee in team
        for leave in leaves_by_employee.get(employee.id, [])
        if leave.status == "PENDING"
    ]
    attendance_counts = {key: sum(1 for member in members if str(member["status"]).lower() == key) for key in ("present", "late", "absent", "on leave")}
    payroll_records = db.query(models.PayrollInput).filter(models.PayrollInput.employee_id.in_(team_ids)).all() if team_ids else []
    locations_count = len({employee.location_id for employee in team if employee.location_id})
    productivity_values = [member["productivity_rating"] for member in members if member["productivity_rating"] is not None]
    total_allocation_hours = sum(allocation_hours.values())
    allocations = [
        {"name": name, "hours": round(hours, 1), "percent": round(hours / total_allocation_hours * 100) if total_allocation_hours else 0}
        for name, hours in sorted(allocation_hours.items(), key=lambda item: item[1], reverse=True)
    ]

    return {
        "manager": {"id": manager.id, "name": f"{manager.first_name} {manager.last_name}", "role": manager.role, "department": departments.get(manager.department_id, "")},
        "members": members,
        "pending_leaves": pending_leaves,
        "allocations": allocations,
        "summary": {
            "headcount": len(team),
            "location_count": locations_count,
            "present_count": attendance_counts["present"],
            "late_count": attendance_counts["late"],
            "absent_count": attendance_counts["absent"],
            "on_leave_count": attendance_counts["on leave"],
            "attendance_rate": round((attendance_counts["present"] + attendance_counts["late"]) / len(team) * 100) if team else 0,
            "pending_leave_count": len(pending_leaves),
            "payroll_records": len(payroll_records),
            "processed_payroll_records": sum(1 for item in payroll_records if str(item.payroll_status).lower() == "processed"),
            "payroll_value": round(sum(float(item.net_payroll_amount or 0) for item in payroll_records), 2),
            "average_productivity": round(sum(productivity_values) / len(productivity_values), 1) if productivity_values else None,
        },
    }

@router.get("/{employee_id}")
def get_employee(employee_id: str, db: Session = Depends(get_db)):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


@router.put("/{employee_id}")
def update_employee(employee_id: str, payload: dict, db: Session = Depends(get_db)):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    allowed_fields = ["first_name", "last_name", "email", "phone", "role", "department_id", "location_id", "employment_status", "worker_type"]
    for field in allowed_fields:
        if field in payload and payload[field] is not None:
            setattr(employee, field, payload[field])

    db.commit()
    db.refresh(employee)
    return employee


@router.put("/{employee_id}/assign-manager")
def assign_manager(employee_id: str, manager_id: str, db: Session = Depends(get_db)):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    manager = db.query(models.Employee).filter(models.Employee.id == manager_id).first()
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")

    employee.manager_id = manager.id
    db.commit()
    db.refresh(employee)

    create_notification(
        db,
        manager.id,
        "TEAM_MEMBER_ADDED",
        "Team member assigned",
        f"{employee.first_name} {employee.last_name} was assigned as your direct report.",
    )
    return {
        "status": "success",
        "message": f"Assigned {manager.first_name} {manager.last_name} as manager for {employee.first_name} {employee.last_name}",
    }

