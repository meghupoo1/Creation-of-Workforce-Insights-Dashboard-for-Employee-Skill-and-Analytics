import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from database import models

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/")
def get_notifications(employee_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.NotificationAlert)
    if employee_id and employee_id.lower() != "all":
        query = query.filter(models.NotificationAlert.recipient_role == employee_id)
    return query.order_by(models.NotificationAlert.created_at.desc()).limit(50).all()


@router.post("/{notification_id}/read")
def mark_notification_read(notification_id: str, employee_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.NotificationAlert).filter(models.NotificationAlert.id == notification_id)
    if employee_id and employee_id.lower() != "all":
        query = query.filter(models.NotificationAlert.recipient_role == employee_id)
    notification = query.first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    return {"id": notification.id, "is_read": notification.is_read}


def create_notification(db: Session, recipient_id: str, alert_type: str, title: str, message: str):
    notification = models.NotificationAlert(
        id=f"NTF-{uuid.uuid4().hex}",
        recipient_role=recipient_id,
        alert_type=alert_type,
        title=title,
        message=message,
        created_at=datetime.utcnow(),
        is_read=False,
    )
    db.add(notification)
    return notification
