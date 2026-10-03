from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database.database import get_db
from database import models
from schemas import full_schemas as schemas

from services.llm_service import llm_service
from services.rag_service import rag_service
from services.agent_service import agent_service
from services.attrition_model import attrition_model_service
from services.forecasting_model import forecasting_model_service
from services.anomaly_detection import anomaly_detection_service
from services.skill_gap_service import skill_gap_service
from services.recommendation_service import (
    performance_analytics_service,
    diversity_analytics_service,
    ai_recommendation_engine
)

router = APIRouter(tags=["ai_analytics"])

# --- 1. AI Chatbot & Agentic Tool Workflow ---
@router.post("/api/ai/chatbot", response_model=schemas.AIChatResponse)
def hr_chatbot(req: schemas.AIChatRequest, db: Session = Depends(get_db)):
    """Agentic AI Workforce Chatbot using Tool Calling & RAG Pipeline."""
    agent_output = agent_service.process_query(req.query, db)
    return schemas.AIChatResponse(
        answer=agent_output["answer"],
        confidence=0.96,
        related_metrics={
            "executed_tools": agent_output["executed_tools"],
            "grounded_with_rag": agent_output["rag_context"]["grounded"]
        }
    )

# --- 2. RAG Document Retrieval Endpoint ---
@router.post("/api/ai/rag-query")
def rag_document_query(req: schemas.AIChatRequest):
    """Direct Retrieval-Augmented Generation query over HR policy documents."""
    return rag_service.answer_query(req.query)

# --- 3. ML Attrition Risk Prediction Endpoint ---
@router.get("/api/ai/attrition-risk")
@router.get("/api/attrition/risk")
def predict_attrition(department: str = "Engineering", db: Session = Depends(get_db)):
    """Real Random Forest ML Model for Attrition Prediction."""
    return attrition_model_service.predict_attrition(department=department)

@router.get("/api/attrition/evaluation")
def get_attrition_model_evaluation():
    """Model evaluation metrics (Accuracy, Precision, Recall, F1, ROC-AUC, Confusion Matrix)."""
    return attrition_model_service.evaluation_metrics

# --- 4. Workforce Forecasting Endpoint ---
@router.post("/api/ai/forecast")
@router.get("/api/forecast")
@router.post("/api/forecast")
def forecast_workforce_demand(months: int = 6, db: Session = Depends(get_db)):
    """Real Time-Series Regression Model for Workforce Demand Forecasting."""
    return forecasting_model_service.forecast_demand(months=months, db=db)

# --- 5. ML Attendance Anomaly Detection & Absenteeism ---
@router.post("/api/ai/attendance-anomalies", response_model=schemas.AIAnomalyResponse)
def detect_anomaly(req: schemas.AIAnomalyRequest, db: Session = Depends(get_db)):
    """Real Isolation Forest ML model for attendance anomaly detection."""
    result = anomaly_detection_service.detect_anomaly(
        employee_id=req.employee_id,
        check_in_time=req.check_in_time,
        lat=req.location_latitude,
        lng=req.location_longitude
    )
    return schemas.AIAnomalyResponse(
        employee_id=result["employee_id"],
        is_anomaly=result["is_anomaly"],
        anomaly_score=result["anomaly_score"],
        anomaly_type=result["anomaly_type"],
        recommendation=result["recommendation"]
    )

@router.get("/api/ai/absenteeism-prediction")
def predict_absenteeism(employee_id: str = "E001", db: Session = Depends(get_db)):
    """Real ML Model for Absenteeism Prediction."""
    return anomaly_detection_service.predict_absenteeism(employee_id=employee_id, db=db)

# --- 6. Skill Gap & Personalized Training ---
@router.get("/api/skills/gap-analysis")
def analyze_skill_gap(employee_id: str = "E001", db: Session = Depends(get_db)):
    """Analyzes employee skill gaps against role requirements."""
    return skill_gap_service.analyze_skill_gap(employee_id=employee_id, db=db)

@router.get("/api/training/recommendations")
def get_training_recommendations(employee_id: str = "E001", db: Session = Depends(get_db)):
    """Generates and retrieves personalized training recommendations."""
    analysis = skill_gap_service.analyze_skill_gap(employee_id=employee_id, db=db)
    return {
        "employee_id": employee_id,
        "recommendations": analysis["training_recommendations"]
    }

# --- 7. Dynamic Performance Analytics ---
@router.get("/api/analytics/performance")
def get_performance_analytics(db: Session = Depends(get_db)):
    """Dynamic calculation of productivity and KPI completion metrics."""
    return performance_analytics_service.get_performance_analytics(db)

# --- 8. DEI & Workforce Diversity Analytics ---
@router.get("/api/analytics/diversity")
@router.get("/api/analytics/dei")
def get_dei_analytics(db: Session = Depends(get_db)):
    """Real demographic representation metrics across workforce dataset."""
    return diversity_analytics_service.get_dei_analytics(db)

# --- 9. AI Recommendation Engine ---
@router.get("/api/ai/recommendations")
def get_ai_recommendations(db: Session = Depends(get_db)):
    """Dynamic AI recommendations for retention, hiring, staffing, training, and workload."""
    return ai_recommendation_engine.generate_recommendations(db)
