from pydantic import BaseModel
from datetime import date
from typing import Optional

class EmployeeBase(BaseModel):
    first_name: str
    last_name: str
    email: str
    department_id: Optional[str] = None
    role: str
    access_role: Optional[str] = "EMPLOYEE"
    employment_status: Optional[str] = "Active"

class EmployeeCreate(EmployeeBase):
    hire_date: Optional[date] = None

class Employee(EmployeeBase):
    id: str
    hire_date: Optional[date] = None

    class Config:
        from_attributes = True

