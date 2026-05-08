from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ActivityLogBase(BaseModel):
    action: str
    entity_type: str
    entity_id: int | None = None
    description: str | None = None

class ActivityLog(ActivityLogBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int | None
    user_id: int | None
    user_name: str | None
    user_role: str | None
    created_at: datetime
