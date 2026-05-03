from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class OrganizationPublic(BaseModel):
    """Salida API: sin api_key / api_key_hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    whatsapp_phone_number_id: Optional[str] = None
    created_at: Optional[datetime] = None
