from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class BotCustomerBase(BaseModel):
    channel: str
    channel_user_id: str
    name: str | None = None
    phone: str | None = None

class BotCustomer(BotCustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime

class BotSessionBase(BaseModel):
    state: str
    cart_data: Any # JSON

class BotSession(BotSessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    organization_id: int | None
    created_at: datetime
    last_interaction_at: datetime

class BotSessionWithCustomer(BotSession):
    customer: BotCustomer
