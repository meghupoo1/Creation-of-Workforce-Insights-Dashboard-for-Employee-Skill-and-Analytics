from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

class EmployeeBase(BaseModel):
    employee_code: Optional[str] = None
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    department_id: Optional[str] = None
    role: str
    access_role: str = "EMPLOYEE"
    base_salary: Optional[float] = None
    experience_years: Optional[float] = 0.0
    manager_id: Optional[str] = None
    location_id: Optional[str] = None
    hire_date: Optional[date] = None
    employment_status: str = "Active"
    worker_type: str = "Employee"
    mfa_enabled: bool = True
    profile_completion: int = 90

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeSchema(EmployeeBase):
    id: str

    class Config:
        from_attributes = True

class AttendanceBase(BaseModel):
    attendance_id: Optional[str] = None
    employee_id: str
    date: date
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    attendance_method: str = "GPS"
    location_id: Optional[str] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    shift_id: Optional[str] = None
    late_minutes: int = 0
    overtime_minutes: int = 0
    status: str = "Present"
    ai_validation: str = "Validated"
    anomaly_type: str = "None"
    anomaly_score: float = 0.0
    notes: Optional[str] = None

class AttendanceSchema(AttendanceBase):
    id: int

    class Config:
        from_attributes = True

class LeaveRequestBase(BaseModel):
    employee_id: str
    leave_type: str
    start_date: date
    end_date: date
    total_days: float
    reason: Optional[str] = None
    status: str = "PENDING"

class LeaveRequestSchema(LeaveRequestBase):
    id: str

    class Config:
        from_attributes = True

class ShiftBase(BaseModel):
    shift_name: str
    shift_type: str
    start_time: str
    end_time: str
    break_minutes: int = 60
    location_id: Optional[str] = None
    required_headcount: int = 1
    rotation_group: Optional[str] = None
    overtime_multiplier: float = 1.5
    status: str = "Published"

class ShiftSchema(ShiftBase):
    id: str

    class Config:
        from_attributes = True

class AIAnomalyRequest(BaseModel):
    employee_id: str
    check_in_time: str
    location_latitude: float
    location_longitude: float
    method: Optional[str] = "GPS"

class AIAnomalyResponse(BaseModel):
    employee_id: str
    is_anomaly: bool
    anomaly_score: float
    anomaly_type: str
    recommendation: str

class AIAttritionResponse(BaseModel):
    department: str
    attrition_risk_score: float
    risk_level: str
    key_drivers: List[str]
    suggested_actions: List[str]

class AIChatRequest(BaseModel):
    query: str
    role: Optional[str] = "HR Administrator"

class AIChatResponse(BaseModel):
    answer: str
    confidence: float
    related_metrics: Optional[dict] = None
