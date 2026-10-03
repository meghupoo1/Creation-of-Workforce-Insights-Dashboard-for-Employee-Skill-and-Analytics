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
        return datetime.strptime(str(val).strip(), "%Y-%m-%d").date()
    except Exception:
        try:
            return datetime.strptime(str(val).strip(), "%d-%m-%Y").date()
        except Exception:
            return None

def parse_datetime(val):
    if not val:
        return None
    try:
        return datetime.strptime(str(val).strip(), "%Y-%m-%d %H:%M:%S")
    except Exception:
        try:
            return datetime.strptime(str(val).strip(), "%Y-%m-%dT%H:%M:%S")
        except Exception:
            return None

def parse_float(val, default=0.0):
    if not val:
        return default
    try:
        return float(str(val).strip())
    except Exception:
        return default

def parse_int(val, default=0):
    if not val:
        return default
    try:
        return int(float(str(val).strip()))
    except Exception:
        return default

def parse_bool(val, default=False):
    if not val:
        return default
    return str(val).strip().lower() in ("true", "1", "yes", "y")

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
                            city=row.get("address", "").split(",")[0] if row.get("address") else "",
                            country="USA",
                            timezone=row.get("timezone", "America/New_York"),
                            geofence_latitude=parse_float(row.get("latitude")),
                            geofence_longitude=parse_float(row.get("longitude")),
                            radius_meters=parse_int(row.get("geofence_radius_m"), 500)
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

        # 6. Shift Assignments
        shift_assign_path = os.path.join(data_dir, "shift_assignments.csv")
        if os.path.exists(shift_assign_path):
            with open(shift_assign_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    a_id = row.get("assignment_id")
                    if a_id and not db.query(models.ShiftAssignment).filter_by(id=a_id).first():
                        db.add(models.ShiftAssignment(
                            id=a_id,
                            employee_id=row.get("employee_id"),
                            shift_id=row.get("shift_id"),
                            assignment_date=parse_date(row.get("work_date")),
                            status=row.get("coverage_status", "Assigned"),
                            swap_requested_with=row.get("swap_requested_by"),
                            ai_allocated=parse_bool(row.get("skills_match"))
                        ))
            db.commit()
            print("Imported Shift Assignments.")

        # 7. Leave Requests
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

        # 8. Leave Balances
        balance_path = os.path.join(data_dir, "leave_balances.csv")
        if os.path.exists(balance_path):
            with open(balance_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    b_id = row.get("balance_id")
                    if b_id and not db.query(models.LeaveBalance).filter_by(id=b_id).first():
                        db.add(models.LeaveBalance(
                            id=b_id,
                            employee_id=row.get("employee_id"),
                            leave_type="Annual",
                            allocated_days=parse_float(row.get("annual_entitlement")),
                            used_days=parse_float(row.get("annual_used")),
                            pending_days=parse_float(row.get("annual_pending")),
                            remaining_days=parse_float(row.get("annual_entitlement")) - parse_float(row.get("annual_used"))
                        ))
            db.commit()
            print("Imported Leave Balances.")

        # 9. Payroll Inputs
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

        # 10. Performance Reviews
        perf_path = os.path.join(data_dir, "performance_reviews.csv")
        if os.path.exists(perf_path):
            with open(perf_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    r_id = row.get("review_id")
                    if r_id and not db.query(models.PerformanceReview).filter_by(id=r_id).first():
                        db.add(models.PerformanceReview(
                            id=r_id,
                            employee_id=row.get("employee_id"),
                            review_period=row.get("review_period"),
                            kpi_score=parse_float(row.get("kpi_score")),
                            productivity_rating=parse_float(row.get("productivity_score")),
                            goals_completed=parse_int(parse_float(row.get("goal_completion_pct")) * 10 / 100),
                            total_goals=10,
                            ai_sentiment_summary=row.get("manager_comment")
                        ))
            db.commit()
            print("Imported Performance Reviews.")

        # 11. Skills Matrix
        skills_path = os.path.join(data_dir, "skills_matrix.csv")
        if os.path.exists(skills_path):
            with open(skills_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    s_id = row.get("skill_record_id")
                    if s_id and not db.query(models.SkillsMatrix).filter_by(id=s_id).first():
                        db.add(models.SkillsMatrix(
                            id=s_id,
                            employee_id=row.get("employee_id"),
                            skill_name=row.get("skill_name"),
                            proficiency_level=row.get("current_level"),
                            competency_score=100.0 - parse_float(row.get("skill_gap_score")) * 20
                        ))
            db.commit()
            print("Imported Skills Matrix.")

        # 12. Training Recommendations
        train_path = os.path.join(data_dir, "training_recommendations.csv")
        if os.path.exists(train_path):
            with open(train_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    tr_id = row.get("recommendation_id")
                    if tr_id and not db.query(models.TrainingRecommendation).filter_by(id=tr_id).first():
                        db.add(models.TrainingRecommendation(
                            id=tr_id,
                            employee_id=row.get("employee_id"),
                            recommended_course=row.get("course_name"),
                            skill_gap_addressed=row.get("reason"),
                            priority=row.get("priority", "Medium"),
                            status=row.get("completion_status", "Assigned")
                        ))
            db.commit()
            print("Imported Training Recommendations.")

        # 13. Workforce Planning
        wf_plan_path = os.path.join(data_dir, "workforce_planning.csv")
        if os.path.exists(wf_plan_path):
            with open(wf_plan_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    fp_id = row.get("forecast_id")
                    if fp_id and not db.query(models.WorkforcePlanning).filter_by(id=fp_id).first():
                        db.add(models.WorkforcePlanning(
                            id=fp_id,
                            department_id=row.get("department_id"),
                            forecast_period=row.get("forecast_month"),
                            current_headcount=parse_int(parse_float(row.get("current_capacity_hours")) / 160),
                            projected_demand=parse_int(parse_float(row.get("projected_demand_hours")) / 160),
                            staffing_gap=parse_int(parse_float(row.get("coverage_gap_hours")) / 160),
                            ai_recommendation=row.get("staffing_recommendation"),
                            optimization_score=parse_float(row.get("workforce_utilization_pct"))
                        ))
            db.commit()
            print("Imported Workforce Planning.")

        # 14. Workforce Metrics
        wf_met_path = os.path.join(data_dir, "workforce_metrics.csv")
        if os.path.exists(wf_met_path):
            with open(wf_met_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                idx = 1
                for row in reader:
                    m_id = f"WM-{idx}"
                    if not db.query(models.WorkforceMetric).filter_by(id=m_id).first():
                        db.add(models.WorkforceMetric(
                            id=m_id,
                            metric_date=parse_date("2026-09-01"),
                            department_id=row.get("department"),
                            attendance_rate=95.0,
                            attrition_rate=parse_float(row.get("attrition_rate")),
                            previous_attrition_rate=parse_float(row.get("previous_attrition_rate")),
                            productivity_score=88.5,
                            payroll_status=row.get("payroll_status", "Processed")
                        ))
                    idx += 1
            db.commit()
            print("Imported Workforce Metrics.")

        # 15. Contractors & Vendors
        cv_path = os.path.join(data_dir, "contractors_vendors.csv")
        if os.path.exists(cv_path):
            with open(cv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    w_id = row.get("worker_id")
                    if w_id and not db.query(models.ContractorVendor).filter_by(id=w_id).first():
                        db.add(models.ContractorVendor(
                            id=w_id,
                            contractor_name=row.get("worker_name"),
                            vendor_agency=row.get("vendor_name"),
                            contract_start=parse_date(row.get("contract_start")),
                            contract_end=parse_date(row.get("contract_end")),
                            hourly_rate=parse_float(row.get("rate")),
                            compliance_status=row.get("compliance_status", "Verified")
                        ))
            db.commit()
            print("Imported Contractors & Vendors.")

        # 16. Integrations
        int_path = os.path.join(data_dir, "integrations.csv")
        if os.path.exists(int_path):
            with open(int_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    i_id = row.get("integration_id")
                    if i_id and not db.query(models.Integration).filter_by(id=i_id).first():
                        db.add(models.Integration(
                            id=i_id,
                            system_name=row.get("provider"),
                            category=row.get("category"),
                            sync_status=row.get("connection_status", "Connected"),
                            last_synced_at=parse_datetime(row.get("last_sync_at"))
                        ))
            db.commit()
            print("Imported Integrations.")

        # 17. Security Audit Logs
        sec_path = os.path.join(data_dir, "security_audit_logs.csv")
        if os.path.exists(sec_path):
            with open(sec_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    s_id = row.get("audit_id")
                    if s_id and not db.query(models.SecurityAuditLog).filter_by(id=s_id).first():
                        db.add(models.SecurityAuditLog(
                            id=s_id,
                            user_id=row.get("actor_id"),
                            action=row.get("action"),
                            resource=row.get("resource_type"),
                            ip_address=row.get("ip_address"),
                            timestamp=parse_datetime(row.get("event_timestamp")),
                            status=row.get("result", "SUCCESS")
                        ))
            db.commit()
            print("Imported Security Audit Logs.")

        # 18. Backup & Recovery Checks
        br_path = os.path.join(data_dir, "backup_recovery_checks.csv")
        if os.path.exists(br_path):
            with open(br_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    b_id = row.get("check_id")
                    if b_id and not db.query(models.BackupRecoveryCheck).filter_by(id=b_id).first():
                        db.add(models.BackupRecoveryCheck(
                            id=b_id,
                            check_type=row.get("backup_type"),
                            last_backup_time=parse_datetime(row.get("check_date")),
                            status=row.get("backup_status"),
                            rpo_minutes=parse_int(row.get("recovery_point_objective")),
                            rto_minutes=parse_int(row.get("recovery_time_objective"))
                        ))
            db.commit()
            print("Imported Backup Recovery Checks.")

        # 19. Timesheets
        ts_path = os.path.join(data_dir, "timesheets.csv")
        if os.path.exists(ts_path):
            with open(ts_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    t_id = row.get("timesheet_id")
                    if t_id and not db.query(models.Timesheet).filter_by(id=t_id).first():
                        db.add(models.Timesheet(
                            id=t_id,
                            employee_id=row.get("employee_id"),
                            project_id=row.get("project_id"),
                            work_date=parse_date(row.get("work_date")),
                            regular_hours=parse_float(row.get("hours"), 8.0),
                            overtime_hours=parse_float(row.get("overtime_hours"), 0.0),
                            billable_hours=parse_float(row.get(" billable_hours") or row.get("billable_hours"), 8.0),
                            task_description=row.get("description"),
                            approval_status=row.get("approval_status", "APPROVED")
                        ))
            db.commit()
            print("Imported Timesheets.")

        # 20. Projects & Clients
        pc_path = os.path.join(data_dir, "projects_clients.csv")
        if os.path.exists(pc_path):
            with open(pc_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    p_id = row.get("project_id")
                    if p_id and not db.query(models.ProjectClient).filter_by(id=p_id).first():
                        db.add(models.ProjectClient(
                            id=p_id,
                            project_name=row.get("project_name"),
                            client_name=row.get("client_name"),
                            billing_rate=parse_float(row.get("billing_rate")),
                            budget_hours=1000.0,
                            status=row.get("project_status", "Active")
                        ))
            db.commit()
            print("Imported Projects & Clients.")

        # 21. Allocation (5000 records dataset)
        alloc_path = os.path.join(data_dir, "allocation.csv")
        if os.path.exists(alloc_path):
            if db.query(models.Allocation).count() == 0:
                with open(alloc_path, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    allocations = []
                    for row in reader:
                        allocations.append(models.Allocation(
                            employee_id=row.get("employee_id"),
                            age=parse_int(row.get("age")),
                            experience_years=parse_float(row.get("experience_years")),
                            education_level=row.get("education_level"),
                            department=row.get("department"),
                            skill_level=row.get("skill_level"),
                            technical_skill_score=parse_float(row.get("technical_skill_score")),
                            communication_score=parse_float(row.get("communication_score")),
                            leadership_score=parse_float(row.get("leadership_score")),
                            problem_solving_score=parse_float(row.get("problem_solving_score")),
                            task_id=row.get("task_id"),
                            task_complexity=row.get("task_complexity"),
                            required_skill_level=row.get("required_skill_level"),
                            deadline_days=parse_int(row.get("deadline_days")),
                            workload_hours=parse_float(row.get("workload_hours")),
                            task_priority=row.get("task_priority"),
                            team_size=parse_int(row.get("team_size")),
                            previous_task_success_rate=parse_float(row.get("previous_task_success_rate")),
                            attendance_rate=parse_float(row.get("attendance_rate")),
                            performance_rating=parse_float(row.get("performance_rating")),
                            idle_time_hours=parse_float(row.get("idle_time_hours")),
                            conflict_rate=parse_float(row.get("conflict_rate")),
                            allocation_status=row.get("allocation_status")
                        ))
                    db.bulk_save_objects(allocations)
                db.commit()
                print("Imported 5000 Allocation records.")

        # 22. Detailed Attendance Log (attendance.csv)
        att_csv_path = os.path.join(data_dir, "attendance.csv")
        if os.path.exists(att_csv_path):
            employees_cache = {e.first_name.lower(): e.id for e in db.query(models.Employee).all() if e.first_name}
            with open(att_csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                attendance_batch = []
                for row in reader:
                    date_val = None
                    raw_date = row.get("Att. Date") or row.get("attendance_date")
                    if raw_date:
                        try:
                            date_val = datetime.strptime(str(raw_date).strip(), "%d-%b-%y").date()
                        except Exception:
                            date_val = parse_date(raw_date)
                    
                    e_name = (row.get("E_Name") or "").strip()
                    emp_id = employees_cache.get(e_name.lower(), "E002")

                    raw_status = (row.get("Status") or "Present").strip()
                    if "weeklyoff" in raw_status.lower():
                        status = "WeeklyOff"
                    elif "absent" in raw_status.lower():
                        status = "Absent"
                    elif "half" in raw_status.lower() or "½" in raw_status:
                        status = "Half Day"
                    else:
                        status = "Present"

                    late_str = row.get("LateBy", "0:00")
                    late_mins = 0
                    if late_str and ":" in late_str:
                        try:
                            parts = late_str.split(":")
                            late_mins = int(parts[0]) * 60 + int(parts[1])
                        except Exception:
                            late_mins = 0

                    ot_str = row.get("OT", "0:00")
                    ot_mins = 0
                    if ot_str and ":" in ot_str:
                        try:
                            parts = ot_str.split(":")
                            ot_mins = int(parts[0]) * 60 + int(parts[1])
                        except Exception:
                            ot_mins = 0

                    attendance_batch.append(models.Attendance(
                        employee_id=emp_id,
                        date=date_val,
                        check_in=row.get("InTime") or None,
                        check_out=row.get("OutTime") or None,
                        attendance_method="Biometric Card",
                        shift_id=row.get("Shift") or "GS",
                        late_minutes=late_mins,
                        overtime_minutes=ot_mins,
                        status=status,
                        ai_validation="Validated",
                        notes=row.get("Punch Records") or None
                    ))
                if attendance_batch:
                    db.bulk_save_objects(attendance_batch)
                    db.commit()
                    print(f"Imported {len(attendance_batch)} detailed attendance log records.")

        # 23. Holidays (holidays.csv)
        hol_path = os.path.join(data_dir, "holidays.csv")
        if os.path.exists(hol_path):
            with open(hol_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    h_id = row.get("holiday_id")
                    if h_id and not db.query(models.Holiday).filter_by(id=h_id).first():
                        db.add(models.Holiday(
                            id=h_id,
                            holiday_date=parse_date(row.get("holiday_date")),
                            holiday_name=row.get("holiday_name"),
                            location_id=row.get("location_id"),
                            is_mandatory=parse_bool(row.get("paid"), True)
                        ))
            db.commit()
            print("Imported Holidays.")

        # 24. Notifications & Alerts (notifications_alerts.csv)
        notif_path = os.path.join(data_dir, "notifications_alerts.csv")
        if os.path.exists(notif_path):
            with open(notif_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    n_id = row.get("notification_id")
                    if n_id and not db.query(models.NotificationAlert).filter_by(id=n_id).first():
                        db.add(models.NotificationAlert(
                            id=n_id,
                            recipient_role=row.get("recipient_employee_id"),
                            alert_type=row.get("notification_type"),
                            title=row.get("title"),
                            message=row.get("message"),
                            created_at=parse_datetime(row.get("event_date")),
                            is_read=row.get("delivery_status", "").lower() == "read"
                        ))
            db.commit()
            print("Imported Notifications & Alerts.")

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
