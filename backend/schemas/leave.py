from pydantic import BaseModel
from datetime import date
from typing import Optional
from database.models import LeaveStatus

class LeaveBase(BaseModel):
    employee_id: int
    start_date: date
    end_date: date
    leave_type: str

class LeaveCreate(LeaveBase):
    pass

class LeaveUpdate(BaseModel):
    status: LeaveStatus

class Leave(LeaveBase):
    id: int
    status: LeaveStatus

    class Config:
        orm_mode = True
