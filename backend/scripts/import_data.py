import os
import csv
import sys
import re
import calendar
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import engine, SessionLocal, Base
from database import models
from services.s3_storage import S3Storage

def parse_date(val):
    if not val:
        return None
    try:
        return datetime.strptime(val.strip(), "%Y-%m-%d").date()
    except Exception:
        return None

def parse_datetime(val):
    if not val:
        return None
    try:
        return datetime.strptime(val.strip(), "%Y-%m-%d %H:%M:%S")
    except Exception:
        try:
            return datetime.strptime(val.strip(), "%Y-%m-%dT%H:%M:%S")
        except Exception:
            return None

def parse_float(val, default=0.0):
    if not val:
        return default
    try:
        return float(val.strip())
    except Exception:
        return default

def parse_int(val, default=0):
    if not val:
        return default
    try:
        return int(val.strip())
    except Exception:
        return default

def parse_bool(val, default=False):
    if not val:
        return default
    return str(val).strip().lower() in ("true", "1", "yes")


def get_value(row, *keys):
    for key in keys:
        if key in row and row.get(key) not in (None, ""):
            return row.get(key)
    return None


def normalize_pay_period(value):
    if not value:
        return value
    value = str(value).strip()
    if len(value) == 7 and value[4] == '-':
        try:
            year, month = value.split('-')
            return datetime.strptime(f"{year}-{month}-01", "%Y-%m-%d").strftime("%B %Y")
        except Exception:
            pass
    return value


def import_all(data_dir: str):
    print(f"Initializing database tables on engine: {engine.url}")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        storage = S3Storage()
        if storage.enabled:
            uploaded = storage.upload_directory(data_dir)
            print(f"Uploaded {len(uploaded)} CSV datasets to s3://{storage.bucket_name}/{storage.prefix}/.")

        # 1. Departments
        dep_path = os.path.join(data_dir, "departments.csv")
        if os.path.exists(dep_path):
            with open(dep_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if not db.query(models.Department).filter_by(id=row["department_id"]).first():
                        db.add(models.Department(
                            id=row["department_id"],
                            department_name=row.get("department_name", ""),
                            department_head_id=row.get("department_head_id"),
                            cost_center=row.get("cost_center"),
                            headcount_target=parse_int(row.get("headcount_target")),
                            monthly_budget=parse_float(row.get("monthly_budget")),
                            location_id=row.get("location_id")
                        ))
            db.commit()
            print("Imported Departments.")

        # 2. Locations
        loc_path = os.path.join(data_dir, "locations.csv")
        if os.path.exists(loc_path):
            with open(loc_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if not db.query(models.Location).filter_by(id=row["location_id"]).first():
                        db.add(models.Location(
                            id=row["location_id"],
                            location_name=row.get("location_name", ""),
                            city=row.get("city", ""),
                            country=row.get("country", ""),
                            timezone=row.get("timezone", "America/New_York"),
                            geofence_latitude=parse_float(row.get("geofence_latitude")),
                            geofence_longitude=parse_float(row.get("geofence_longitude")),
                            radius_meters=parse_int(row.get("radius_meters"), 500)
                        ))
            db.commit()
            print("Imported Locations.")

        # 3. Employees
        emp_path = os.path.join(data_dir, "employees.csv")
        if os.path.exists(emp_path):
            with open(emp_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if not db.query(models.Employee).filter_by(id=row["employee_id"]).first():
                        db.add(models.Employee(
                            id=row["employee_id"],
                            employee_code=row.get("employee_code", f"EMP-{row['employee_id']}"),
                            first_name=row.get("first_name", ""),
                            last_name=row.get("last_name", ""),
                            email=row.get("email", ""),
                            phone=row.get("phone"),
                            department_id=row.get("department_id"),
                            role=row.get("role", "Staff"),
                            access_role=row.get("access_role", "EMPLOYEE"),
                            manager_id=row.get("manager_id"),
                            location_id=row.get("location_id"),
                            hire_date=parse_date(row.get("hire_date")),
                            employment_status=row.get("employment_status", "Active"),
                            worker_type=row.get("worker_type", "Employee"),
                            timezone=row.get("timezone", "America/New_York"),
                            mfa_enabled=parse_bool(row.get("mfa_enabled"), True),
                            profile_completion=parse_int(row.get("profile_completion"), 90)
                        ))
            db.commit()
            print("Imported Employees.")

        # 4. Attendance Events
        att_evt_path = os.path.join(data_dir, "attendance_events.csv")
        if os.path.exists(att_evt_path):
            with open(att_evt_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if not db.query(models.Attendance).filter_by(attendance_id=row["attendance_id"]).first():
                        db.add(models.Attendance(
                            attendance_id=row["attendance_id"],
                            employee_id=row["employee_id"],
                            date=parse_date(row.get("attendance_date")),
                            check_in=row.get("check_in"),
                            check_out=row.get("check_out"),
                            attendance_method=row.get("attendance_method", "GPS"),
                            location_id=row.get("location_id"),
                            gps_latitude=parse_float(row.get("gps_latitude")),
                            gps_longitude=parse_float(row.get("gps_longitude")),
                            shift_id=row.get("shift_id"),
                            late_minutes=parse_int(row.get("late_minutes")),
                            overtime_minutes=parse_int(row.get("overtime_minutes")),
                            status=row.get("status", "Present"),
                            ai_validation=row.get("ai_validation", "Validated"),
                            anomaly_type=row.get("anomaly_type", "None"),
                            anomaly_score=parse_float(row.get("anomaly_score")),
                            notes=row.get("notes")
                        ))
            db.commit()
            print("Imported Attendance Events.")

        # 5. Shifts
        shift_path = os.path.join(data_dir, "shifts.csv")
        if os.path.exists(shift_path):
            with open(shift_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if not db.query(models.Shift).filter_by(id=row["shift_id"]).first():
                        db.add(models.Shift(
                            id=row["shift_id"],
                            shift_name=row.get("shift_name", ""),
                            shift_type=row.get("shift_type", "Fixed"),
                            start_time=row.get("start_time", "09:00"),
                            end_time=row.get("end_time", "17:30"),
                            break_minutes=parse_int(row.get("break_minutes"), 60),
                            location_id=row.get("location_id"),
                            required_headcount=parse_int(row.get("required_headcount"), 1),
                            rotation_group=row.get("rotation_group"),
                            overtime_multiplier=parse_float(row.get("overtime_multiplier"), 1.5),
                            status=row.get("status", "Published")
                        ))
            db.commit()
            print("Imported Shifts.")

        # 6. Leave Requests
        leave_path = os.path.join(data_dir, "leave_requests.csv")
        if os.path.exists(leave_path):
            with open(leave_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    l_id = row.get("leave_id") or row.get("leave_request_id")
                    if l_id and not db.query(models.LeaveRequest).filter_by(id=l_id).first():
                        db.add(models.LeaveRequest(
                            id=l_id,
                            employee_id=row.get("employee_id"),
                            leave_type=row.get("leave_type", "Annual"),
                            start_date=parse_date(row.get("start_date")),
                            end_date=parse_date(row.get("end_date")),
                            total_days=parse_float(row.get("total_days"), 1.0),
                            reason=row.get("reason"),
                            status=(get_value(row, "approval_status", "status") or "PENDING").upper(),
                            approved_by=row.get("approved_by"),
                            auto_approval_eligible=parse_bool(get_value(row, "paid_leave", "auto_approval_eligible"))
                        ))
            db.commit()
            print("Imported Leave Requests.")

        # 7. Payroll Inputs
        pay_path = os.path.join(data_dir, "payroll_inputs.csv")
        if os.path.exists(pay_path):
            with open(pay_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    p_id = get_value(row, "payroll_input_id", "payroll_id", "id")
                    if p_id and not db.query(models.PayrollInput).filter_by(id=p_id).first():
                        gross_pay = parse_float(get_value(row, "gross_pay", "base_salary"))
                        net_pay = parse_float(get_value(row, "net_pay", "net_payroll_amount"))
                        paid_leave_deductions = parse_float(get_value(row, "leave_deduction", "total_paid_leaves"))
                        attendance_days = parse_float(get_value(row, "attendance_days", "total_present_days"))

                        db.add(models.PayrollInput(
                            id=p_id,
                            employee_id=row.get("employee_id"),
                            pay_period=normalize_pay_period(get_value(row, "pay_period")),
                            base_salary=gross_pay,
                            total_present_days=attendance_days,
                            total_paid_leaves=paid_leave_deductions,
                            unpaid_leave_deductions=parse_float(get_value(row, "other_deductions", "unpaid_leave_deductions")),
                            overtime_pay=parse_float(get_value(row, "overtime_pay")),
                            bonuses_incentives=parse_float(get_value(row, "incentive_bonus", "bonuses_incentives")),
                            net_payroll_amount=net_pay,
                            payroll_status=get_value(row, "payroll_status") or "Processed"
                        ))
            db.commit()
            print("Imported Payroll Inputs.")

        print("All CSV datasets imported successfully into database!")
    except Exception as e:
        db.rollback()
        print(f"Error during import: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    public_data_dir = os.path.abspath(os.path.join(current_dir, "..", "..", "public", "data"))
    import_all(public_data_dir)
