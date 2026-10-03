import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from services.s3_storage import S3Storage

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

@router.get("/")
def get_integrations():
    storage = S3Storage()
    s3_status = "Connected" if storage.enabled else "Configured"

    from database.database import SQLALCHEMY_DATABASE_URL
    db_name_label = "AWS RDS (PostgreSQL)" if ("postgres" in SQLALCHEMY_DATABASE_URL or os.getenv("RDS_HOSTNAME") or os.getenv("POSTGRES_HOST")) else "AWS RDS / PostgreSQL (Local Fallback)"

    integrations_list = [
        {"name": db_name_label, "type": "Core Relational Data Store", "status": "Connected", "last_sync": "Live"},
        {"name": "AWS S3 Dataset Sync", "type": "Cloud Storage", "status": s3_status, "last_sync": "On-demand"},
        {"name": "OpenAI / Bedrock API", "type": "LLM & AI Engine", "status": "Connected" if (os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY")) else "Demo/Mock", "last_sync": "Active"},
        {"name": "Biometric & GPS Devices", "type": "Attendance Hardware", "status": "Demo/Mock", "last_sync": "Simulated"},
        {"name": "Microsoft Teams", "type": "Notification Channel", "status": "Demo/Mock", "last_sync": "Simulated"},
        {"name": "Slack", "type": "Notification Channel", "status": "Demo/Mock", "last_sync": "Simulated"},
        {"name": "Active Directory (LDAP)", "type": "Identity & Access (RBAC)", "status": "Not configured", "last_sync": "Never"},
        {"name": "SAP ERP", "type": "Enterprise Resource Planning", "status": "Not configured", "last_sync": "Never"},
        {"name": "Oracle HRMS", "type": "Core HR Records", "status": "Demo/Mock", "last_sync": "Imported dataset"}
    ]
    return integrations_list

@router.post("/trigger-sync")
def trigger_system_sync(system_name: str):
    return {"system": system_name, "status": "Sync triggered successfully", "integration_status": "Demo/Mock execution"}

@router.post("/s3/sync-datasets")
def sync_datasets_to_s3():
    storage = S3Storage()
    if not storage.enabled:
        raise HTTPException(status_code=503, detail="S3_BUCKET_NAME is not configured")

    data_directory = Path(__file__).resolve().parents[2] / "public" / "data"
    try:
        uploaded = storage.upload_directory(data_directory)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"S3 upload failed: {exc}") from exc

    return {"status": "completed", "bucket": storage.bucket_name, "files_uploaded": uploaded}
