import sys
from pathlib import Path
from datetime import date, datetime
from enum import Enum

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from database.database import SessionLocal
from database.models import (
    Employee, Department, Location, Attendance, LeaveRequest,
    Shift, Timesheet, PayrollInput, PerformanceReview, SecurityAuditLog
)
from database.mongodb import database


def mongo_convert(val):
    if isinstance(val, datetime):
        return val
    if isinstance(val, date):
        return datetime.combine(val, datetime.min.time())
    if isinstance(val, Enum):
        return val.value
    if isinstance(val, dict):
        return {k: mongo_convert(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [mongo_convert(v) for v in val]
    return val


if database is None:
    print("MongoDB database instance not available.")
    exit(1)

db = SessionLocal()

models_map = {
    "employees": Employee,
    "departments": Department,
    "locations": Location,
    "attendance": Attendance,
    "leave_requests": LeaveRequest,
    "shifts": Shift,
    "timesheets": Timesheet,
    "payroll_inputs": PayrollInput,
    "performance_reviews": PerformanceReview,
    "security_audit_logs": SecurityAuditLog,
}

print("Syncing workforce database to MongoDB Compass at mongodb://localhost:27017/workforce ...")

for collection_name, model_cls in models_map.items():
    records = db.query(model_cls).all()
    collection = database[collection_name]
    count = 0
    for record in records:
        raw_doc = {col.name: getattr(record, col.name) for col in model_cls.__table__.columns}
        raw_doc.pop("password_hash", None)
        doc = mongo_convert(raw_doc)
        pk_cols = [col.name for col in model_cls.__table__.primary_key.columns]
        if pk_cols:
            doc["_id"] = str(raw_doc[pk_cols[0]])
        collection.replace_one({"_id": doc["_id"]}, doc, upsert=True)
        count += 1
    print(f"  [OK] Collection '{collection_name}': {count} documents synced.")

print("\nSync complete! Open MongoDB Compass and connect to mongodb://localhost:27017 to view the 'workforce' database.")
