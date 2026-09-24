from fastapi import APIRouter

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

ALERTS = [
    {"id": 1, "type": "Shift Reminder", "message": "18 employees have shifts starting within 2 hours.", "level": "info"},
    {"id": 2, "type": "Leave Approval", "message": "7 leave requests are waiting for manager approval.", "level": "warning"},
    {"id": 3, "type": "Attendance Anomaly", "message": "4 late arrivals and 2 location perimeter mismatches detected.", "level": "alert"},
    {"id": 4, "type": "Work Anniversary", "message": "Celebrate 3 team milestones this week.", "level": "celebration"}
]

@router.get("/")
def get_notifications():
    return ALERTS
