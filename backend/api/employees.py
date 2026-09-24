from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database.database import get_db
from database import models
from schemas import full_schemas as schemas

router = APIRouter(prefix="/api/employees", tags=["employees"])

@router.get("/")
def get_employees(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Employee).offset(skip).limit(limit).all()

@router.post("/", response_model=schemas.EmployeeSchema, status_code=status.HTTP_201_CREATED)
def create_employee(payload: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    if db.query(models.Employee).filter(models.Employee.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Employee with this email already exists")

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
        manager_id=payload.manager_id,
        location_id=payload.location_id,
        hire_date=payload.hire_date,
        employment_status=payload.employment_status,
        worker_type=payload.worker_type,
        mfa_enabled=payload.mfa_enabled,
        profile_completion=payload.profile_completion,
    )

    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee

@router.get("/{employee_id}")
def get_employee(employee_id: str, db: Session = Depends(get_db)):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee
