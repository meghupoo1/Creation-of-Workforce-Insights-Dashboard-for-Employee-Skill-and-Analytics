from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.database import get_db
from database import models

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: str
    password: str
    role: str = "EMPLOYEE"

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str
    name: str

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    employee = db.query(models.Employee).filter(models.Employee.email == req.email).first()
    if not employee:
        # Default mock user if not in database
        name = "Alex Rivera" if req.role.upper() == "HR" else "Maya Roberts" if req.role.upper() == "MANAGER" else "Alex Rivera"
        return LoginResponse(
            access_token=f"demo-token-{req.role}",
            role=req.role.upper(),
            email=req.email,
            name=name
        )
    return LoginResponse(
        access_token=f"token-{employee.id}",
        role=employee.access_role or req.role.upper(),
        email=employee.email,
        name=f"{employee.first_name} {employee.last_name}"
    )
