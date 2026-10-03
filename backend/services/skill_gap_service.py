from typing import Dict, Any, List
from sqlalchemy.orm import Session
from database import models

ROLE_REQUIRED_SKILLS = {
    "Engineering": [
        {"skill_name": "Python", "target_level": "Expert", "target_score": 90.0},
        {"skill_name": "SQL Analytics", "target_level": "Expert", "target_score": 85.0},
        {"skill_name": "Machine Learning", "target_level": "Intermediate", "target_score": 80.0},
        {"skill_name": "Cloud Architecture", "target_level": "Intermediate", "target_score": 75.0}
    ],
    "Product Design": [
        {"skill_name": "Figma & Prototyping", "target_level": "Expert", "target_score": 90.0},
        {"skill_name": "User Research", "target_level": "Expert", "target_score": 85.0},
        {"skill_name": "Design Systems", "target_level": "Intermediate", "target_score": 80.0}
    ],
    "Staff": [
        {"skill_name": "Project Management", "target_level": "Intermediate", "target_score": 75.0},
        {"skill_name": "Data Analysis", "target_level": "Intermediate", "target_score": 75.0},
        {"skill_name": "Communication", "target_level": "Expert", "target_score": 85.0}
    ]
}

class SkillGapService:
    """Service for calculating employee skill gaps and generating personalized training recommendations."""

    def analyze_skill_gap(self, employee_id: str, db: Session) -> Dict[str, Any]:
        emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
        emp_name = f"{emp.first_name} {emp.last_name}" if emp else f"Employee {employee_id}"
        role = emp.role if emp else "Engineering"

        # Fetch current skills from SkillsMatrix table
        skills = db.query(models.SkillsMatrix).filter(models.SkillsMatrix.employee_id == employee_id).all()
        current_skills_map = {}
        for s in skills:
            current_skills_map[s.skill_name.lower()] = {
                "skill_name": s.skill_name,
                "current_level": s.proficiency_level or "Beginner",
                "score": s.competency_score or 60.0
            }

        # Role requirements
        required_list = ROLE_REQUIRED_SKILLS.get(role, ROLE_REQUIRED_SKILLS["Engineering"])
        
        gaps = []
        missing_skills = []
        total_gap_score = 0.0

        for req in required_list:
            s_name = req["skill_name"]
            target_lvl = req["target_level"]
            target_score = req["target_score"]
            
            curr = current_skills_map.get(s_name.lower())
            if curr:
                curr_lvl = curr["current_level"]
                curr_score = curr["score"]
            else:
                curr_lvl = "Beginner"
                curr_score = 50.0

            gap_val = max(0.0, target_score - curr_score)
            total_gap_score += gap_val

            if gap_val > 10.0 or curr_lvl.lower() in ("beginner", "intermediate"):
                missing_skills.append(s_name)

            gaps.append({
                "skill_name": s_name,
                "current_proficiency": curr_lvl,
                "target_proficiency": target_lvl,
                "current_score": curr_score,
                "target_score": target_score,
                "gap_score": round(gap_val, 1)
            })

        avg_gap_score = round(total_gap_score / len(required_list), 1)

        # Generate recommendations
        recommendations = self.generate_personalized_recommendations(employee_id, missing_skills, db)

        return {
            "employee_id": employee_id,
            "employee_name": emp_name,
            "role": role,
            "overall_skill_gap_score": avg_gap_score,
            "missing_skills": missing_skills,
            "skill_breakdown": gaps,
            "training_recommendations": recommendations
        }

    def generate_personalized_recommendations(self, employee_id: str, missing_skills: List[str], db: Session) -> List[Dict[str, Any]]:
        course_catalog = {
            "SQL Analytics": "SQL Advanced Analytics & Performance Tuning",
            "Machine Learning": "Machine Learning Fundamentals for Enterprise",
            "Python": "Python Data Engineering Masterclass",
            "Cloud Architecture": "AWS Cloud Solutions Architect Certification",
            "Figma & Prototyping": "Advanced Design Systems & UI Prototyping",
            "User Research": "User Experience Research & Persona Mapping"
        }

        recommendations = []
        idx = 1
        for skill in missing_skills:
            course = course_catalog.get(skill, f"{skill} Mastery Course")
            rec_id = f"TR-AUTOGEN-{employee_id}-{idx}"
            
            # Store recommendation into database if not present
            existing = db.query(models.TrainingRecommendation).filter_by(id=rec_id).first()
            if not existing:
                db_rec = models.TrainingRecommendation(
                    id=rec_id,
                    employee_id=employee_id,
                    recommended_course=course,
                    skill_gap_addressed=f"Addresses gap in {skill}",
                    priority="High" if idx == 1 else "Medium",
                    status="Assigned"
                )
                db.add(db_rec)
                db.commit()

            recommendations.append({
                "course_name": course,
                "skill_addressed": skill,
                "priority": "High" if idx == 1 else "Medium",
                "status": "Assigned"
            })
            idx += 1

        return recommendations

skill_gap_service = SkillGapService()
