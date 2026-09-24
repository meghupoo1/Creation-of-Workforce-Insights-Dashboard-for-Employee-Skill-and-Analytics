from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional

class AttendanceBase(BaseModel):
    employee_id: int
    date: date
    check_in: datetime
    status: str

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceUpdate(BaseModel):
    check_out: datetime
    status: Optional[str] = None

class Attendance(AttendanceBase):
    id: int
    check_out: Optional[datetime] = None

    class Config:
        orm_mode = True
