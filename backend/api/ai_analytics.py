from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database.database import get_db
from database import models
from schemas import full_schemas as schemas

router = APIRouter(prefix="/api/ai", tags=["ai_analytics"])

@router.post("/attendance-anomalies", response_model=schemas.AIAnomalyResponse)
def detect_anomaly(req: schemas.AIAnomalyRequest, db: Session = Depends(get_db)):
    # Calculate anomaly logic based on location and check-in time
    is_anomaly = False
    score = 0.05
    anomaly_type = "None"
    recommendation = "Normal attendance event. No action required."

    # Check for late time (after 09:15)
    hour = int(req.check_in_time.split(":")[0]) if ":" in req.check_in_time else 9
    minute = int(req.check_in_time.split(":")[1]) if ":" in req.check_in_time else 0

    if hour > 9 or (hour == 9 and minute > 15):
        is_anomaly = True
        score = 0.65
        anomaly_type = "Late arrival drift"
        recommendation = "Send automated late arrival notification to employee and manager."

    # Check for location drift
    if abs(req.location_latitude - 40.7128) > 0.05 or abs(req.location_longitude - (-74.0060)) > 0.05:
        is_anomaly = True
        score = 0.92
        anomaly_type = "Geofence perimeter mismatch"
        recommendation = "Flag check-in location for HR manager review."

    return schemas.AIAnomalyResponse(
        employee_id=req.employee_id,
        is_anomaly=is_anomaly,
        anomaly_score=score,
        anomaly_type=anomaly_type,
        recommendation=recommendation
    )

@router.get("/attrition-risk")
def predict_attrition(department: str = "Engineering", db: Session = Depends(get_db)):
    return {
        "department": department,
        "attrition_risk_score": 12.4,
        "risk_level": "Moderate",
        "key_drivers": [
            "High overtime hours in last 3 weeks",
            "Below-average leave utilization",
            "Skill gap in senior roles"
        ],
        "suggested_actions": [
            "Reallocate 15% project workload to contractor pool",
            "Schedule 1-on-1 retention sync with design leads",
            "Approve pending annual leave requests"
        ]
    }

@router.post("/forecast")
def forecast_workforce_demand(months: int = 6):
    return {
        "forecast_period": f"Next {months} Months",
        "predicted_headcount_needed": 142,
        "current_headcount": 128,
        "gap": 14,
        "department_gaps": {
            "Engineering": 6,
            "Product Design": 4,
            "Customer Success": 3,
            "Operations": 1
        },
        "optimization_confidence": 0.94
    }

@router.post("/chatbot", response_model=schemas.AIChatResponse)
def hr_chatbot(req: schemas.AIChatRequest):
    q = req.query.lower()
    
    if "absent" in q or "attendance" in q:
        answer = "Today's attendance rate is 91.7%. There are 9 team members present, 2 working remotely, and 1 on medical leave. 1 late arrival was detected."
    elif "leave" in q or "vacation" in q:
        answer = "You have 14.5 days of leave remaining (12 annual, 2.5 sick). You can submit a leave request directly from your Employee Self-Service portal."
    elif "payroll" in q or "salary" in q:
        answer = "August 2026 payroll input is 100% processed. Net payout calculated for 128 employees with zero unresolved deductions."
    elif "attrition" in q or "risk" in q:
        answer = "Overall workforce attrition risk is low (12.4%). Engineering department shows a slight workload alert due to consecutive overtime."
    else:
        answer = f"I am your AI Workforce Assistant. I can help with queries regarding attendance, leave balances, shift schedules, payroll status, and attrition forecasting. How can I assist you with '{req.query}'?"

    return schemas.AIChatResponse(
        answer=answer,
        confidence=0.98,
        related_metrics={"attendance_rate": "91.7%", "leave_balance": "14.5 days", "payroll_status": "Processed"}
    )
