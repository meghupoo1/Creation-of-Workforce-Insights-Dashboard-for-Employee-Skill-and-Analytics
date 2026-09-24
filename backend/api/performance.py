from fastapi import APIRouter

router = APIRouter(prefix="/api/performance", tags=["performance"])

@router.get("/metrics")
def get_performance_metrics():
    return {
        "average_productivity": 86.4,
        "kpi_completion_rate": "91.2%",
        "active_goals": 24,
        "top_performers_count": 18,
        "skill_matrix_coverage": "95%"
    }
