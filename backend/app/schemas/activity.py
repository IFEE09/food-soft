from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class ActivityLogBase(BaseModel):
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    description: Optional[str] = None

class ActivityLog(ActivityLogBase):
    id: int
    organization_id: Optional[int]
    user_id: Optional[int]
    user_name: Optional[str]
    user_role: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
