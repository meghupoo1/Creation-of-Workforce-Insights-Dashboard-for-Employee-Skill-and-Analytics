from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Float, Enum, Boolean, Text
from sqlalchemy.orm import relationship
import enum
from .database import Base

class LeaveStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class Department(Base):
    __tablename__ = "departments"
    id = Column(String, primary_key=True, index=True)
    department_name = Column(String, index=True)
    department_head_id = Column(String, nullable=True)
    cost_center = Column(String, nullable=True)
    headcount_target = Column(Integer, default=0)
    monthly_budget = Column(Float, default=0.0)
    location_id = Column(String, nullable=True)

class Location(Base):
    __tablename__ = "locations"
    id = Column(String, primary_key=True, index=True)
    location_name = Column(String, index=True)
    city = Column(String)
    country = Column(String)
    timezone = Column(String)
    geofence_latitude = Column(Float, nullable=True)
    geofence_longitude = Column(Float, nullable=True)
    radius_meters = Column(Integer, default=500)

class Employee(Base):
    __tablename__ = "employees"
    id = Column(String, primary_key=True, index=True) # e.g. E001
    employee_code = Column(String, unique=True, index=True) # e.g. EMP-001
    first_name = Column(String, index=True)
    last_name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String, nullable=True)
    department_id = Column(String, ForeignKey("departments.id"), nullable=True)
    role = Column(String)
    access_role = Column(String, default="EMPLOYEE") # HR_ADMIN, MANAGER, EMPLOYEE
    manager_id = Column(String, nullable=True)
    location_id = Column(String, ForeignKey("locations.id"), nullable=True)
    hire_date = Column(Date, nullable=True)
    employment_status = Column(String, default="Active")
    worker_type = Column(String, default="Employee") # Employee, Contractor
    timezone = Column(String, default="America/New_York")
    mfa_enabled = Column(Boolean, default=True)
    profile_completion = Column(Integer, default=90)

class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    attendance_id = Column(String, index=True, nullable=True)
    employee_id = Column(String, ForeignKey("employees.id"))
    date = Column(Date, index=True)
    check_in = Column(String, nullable=True)
    check_out = Column(String, nullable=True)
    attendance_method = Column(String, default="GPS") # biometric, GPS, face_recognition, QR
    location_id = Column(String, nullable=True)
    gps_latitude = Column(Float, nullable=True)
    gps_longitude = Column(Float, nullable=True)
    shift_id = Column(String, nullable=True)
    late_minutes = Column(Integer, default=0)
    overtime_minutes = Column(Integer, default=0)
    status = Column(String, default="Present") # Present, Late, Absent, On Leave
    ai_validation = Column(String, default="Validated") # Validated, Review, Flagged
    anomaly_type = Column(String, default="None")
    anomaly_score = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)

class AttendanceEvent(Base):
    __tablename__ = "attendance_events"
    id = Column(String, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.id"))
    timestamp = Column(DateTime)
    event_type = Column(String) # CHECK_IN, CHECK_OUT, BREAK_START, BREAK_END
    device_id = Column(String, nullable=True)
    verification_mode = Column(String)
    confidence_score = Column(Float, default=1.0)
    flagged = Column(Boolean, default=False)

class Shift(Base):
    __tablename__ = "shifts"
    id = Column(String, primary_key=True, index=True)
    shift_name = Column(String, index=True)
    shift_type = Column(String) # Fixed, Rotational
    start_time = Column(String)
    end_time = Column(String)
    break_minutes = Column(Integer, default=60)
    location_id = Column(String, nullable=True)
    required_headcount = Column(Integer, default=1)
    rotation_group = Column(String, nullable=True)
    overtime_multiplier = Column(Float, default=1.5)
    status = Column(String, default="Published")

class ShiftAssignment(Base):
    __tablename__ = "shift_assignments"
    id = Column(String, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.id"))
    shift_id = Column(String, ForeignKey("shifts.id"))
    assignment_date = Column(Date)
    status = Column(String, default="Assigned") # Assigned, Swapped, Cancelled
    swap_requested_with = Column(String, nullable=True)
    ai_allocated = Column(Boolean, default=True)

class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    id = Column(String, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.id"))
    leave_type = Column(String) # Annual, Sick, Personal, Maternity
    start_date = Column(Date)
    end_date = Column(Date)
    total_days = Column(Float)
    reason = Column(Text, nullable=True)
    status = Column(String, default="PENDING") # PENDING, APPROVED, REJECTED
    approved_by = Column(String, nullable=True)
    auto_approval_eligible = Column(Boolean, default=False)

class LeaveBalance(Base):
    __tablename__ = "leave_balances"
    id = Column(String, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.id"))
    leave_type = Column(String)
    allocated_days = Column(Float)
    used_days = Column(Float)
    pending_days = Column(Float)
    remaining_days = Column(Float)

class Holiday(Base):
    __tablename__ = "holidays"
    id = Column(String, primary_key=True, index=True)
    holiday_name = Column(String)
    holiday_date = Column(Date)
    location_id = Column(String, nullable=True)
    is_mandatory = Column(Boolean, default=True)

class Timesheet(Base):
    __tablename__ = "timesheets"
    id = Column(String, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.id"))
    project_id = Column(String, nullable=True)
    work_date = Column(Date)
    regular_hours = Column(Float, default=8.0)
    overtime_hours = Column(Float, default=0.0)
    billable_hours = Column(Float, default=8.0)
    task_description = Column(Text, nullable=True)
    approval_status = Column(String, default="APPROVED")

class ProjectClient(Base):
    __tablename__ = "projects_clients"
    id = Column(String, primary_key=True, index=True)
    project_name = Column(String)
    client_name = Column(String)
    billing_rate = Column(Float)
    budget_hours = Column(Float)
    status = Column(String, default="Active")

class PayrollInput(Base):
    __tablename__ = "payroll_inputs"
    id = Column(String, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.id"))
    pay_period = Column(String)
    base_salary = Column(Float)
    total_present_days = Column(Float)
    total_paid_leaves = Column(Float)
    unpaid_leave_deductions = Column(Float, default=0.0)
    overtime_pay = Column(Float, default=0.0)
    bonuses_incentives = Column(Float, default=0.0)
    net_payroll_amount = Column(Float)
    payroll_status = Column(String, default="Processed")

class WorkforcePlanning(Base):
    __tablename__ = "workforce_planning"
    id = Column(String, primary_key=True, index=True)
    department_id = Column(String, ForeignKey("departments.id"))
    forecast_period = Column(String)
    current_headcount = Column(Integer)
    projected_demand = Column(Integer)
    staffing_gap = Column(Integer)
    ai_recommendation = Column(Text)
    optimization_score = Column(Float)

class WorkforceMetric(Base):
    __tablename__ = "workforce_metrics"
    id = Column(String, primary_key=True, index=True)
    metric_date = Column(Date)
    department_id = Column(String, nullable=True)
    attendance_rate = Column(Float)
    attrition_rate = Column(Float)
    previous_attrition_rate = Column(Float, default=0.0)
    productivity_score = Column(Float)
    payroll_status = Column(String, default="Processed")

class PerformanceReview(Base):
    __tablename__ = "performance_reviews"
    id = Column(String, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.id"))
    review_period = Column(String)
    kpi_score = Column(Float)
    productivity_rating = Column(Float)
    goals_completed = Column(Integer)
    total_goals = Column(Integer)
    ai_sentiment_summary = Column(Text)

class SkillsMatrix(Base):
    __tablename__ = "skills_matrix"
    id = Column(String, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.id"))
    skill_name = Column(String)
    proficiency_level = Column(String) # Beginner, Intermediate, Expert
    competency_score = Column(Float)

class TrainingRecommendation(Base):
    __tablename__ = "training_recommendations"
    id = Column(String, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.id"))
    recommended_course = Column(String)
    skill_gap_addressed = Column(String)
    priority = Column(String, default="Medium")
    status = Column(String, default="Assigned")

class ContractorVendor(Base):
    __tablename__ = "contractors_vendors"
    id = Column(String, primary_key=True, index=True)
    contractor_name = Column(String)
    vendor_agency = Column(String)
    contract_start = Column(Date)
    contract_end = Column(Date)
    hourly_rate = Column(Float)
    compliance_status = Column(String, default="Verified")

class NotificationAlert(Base):
    __tablename__ = "notifications_alerts"
    id = Column(String, primary_key=True, index=True)
    recipient_role = Column(String)
    alert_type = Column(String)
    title = Column(String)
    message = Column(Text)
    created_at = Column(DateTime)
    is_read = Column(Boolean, default=False)

class SecurityAuditLog(Base):
    __tablename__ = "security_audit_logs"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String)
    action = Column(String)
    resource = Column(String)
    ip_address = Column(String)
    timestamp = Column(DateTime)
    status = Column(String, default="SUCCESS")

class BackupRecoveryCheck(Base):
    __tablename__ = "backup_recovery_checks"
    id = Column(String, primary_key=True, index=True)
    check_type = Column(String)
    last_backup_time = Column(DateTime)
    status = Column(String)
    rpo_minutes = Column(Integer)
    rto_minutes = Column(Integer)

class Integration(Base):
    __tablename__ = "integrations"
    id = Column(String, primary_key=True, index=True)
    system_name = Column(String) # Biometric, SAP, Oracle HRMS, Slack, Teams
    category = Column(String)
    sync_status = Column(String, default="Connected")
    last_synced_at = Column(DateTime)
