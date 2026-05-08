from datetime import datetime

from pydantic import BaseModel, ConfigDict


class OrganizationCreate(BaseModel):
    name: str

class OrganizationPublic(BaseModel):
    """Salida API: sin api_key / api_key_hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    whatsapp_phone_number_id: str | None = None
    created_at: datetime | None = None
