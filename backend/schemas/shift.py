from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ShiftBase(BaseModel):
    employee_id: int
    start_time: datetime
    end_time: datetime
    shift_type: str # MORNING, EVENING, NIGHT, ROTATIONAL

class ShiftCreate(ShiftBase):
    pass

class ShiftUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    shift_type: Optional[str] = None

class Shift(ShiftBase):
    id: int

    class Config:
        orm_mode = True
