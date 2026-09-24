from pathlib import Path

from fastapi import APIRouter, HTTPException

from services.s3_storage import S3Storage

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

INTEGRATIONS_LIST = [
    {"name": "Biometric Devices", "type": "Attendance Hardware", "status": "Connected", "last_sync": "Real-time"},
    {"name": "Microsoft Teams", "type": "Notification Channel", "status": "Connected", "last_sync": "5 min ago"},
    {"name": "Slack", "type": "Notification Channel", "status": "Connected", "last_sync": "2 min ago"},
    {"name": "Active Directory", "type": "Identity & Access (RBAC)", "status": "Synced", "last_sync": "1 hour ago"},
    {"name": "SAP ERP", "type": "Enterprise Resource Planning", "status": "Connected", "last_sync": "12 hours ago"},
    {"name": "Oracle HRMS", "type": "Core HR Records", "status": "Connected", "last_sync": "24 hours ago"},
    {"name": "Google Workspace", "type": "Directory & Calendar", "status": "Connected", "last_sync": "10 min ago"}
]

@router.get("/")
def get_integrations():
    return INTEGRATIONS_LIST

@router.post("/trigger-sync")
def trigger_system_sync(system_name: str):
    return {"system": system_name, "status": "Sync triggered successfully", "timestamp": "Now"}


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
