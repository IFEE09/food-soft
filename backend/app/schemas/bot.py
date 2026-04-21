from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel

class BotCustomerBase(BaseModel):
    channel: str
    channel_user_id: str
    name: Optional[str] = None
    phone: Optional[str] = None

class BotCustomer(BotCustomerBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class BotSessionBase(BaseModel):
    state: str
    cart_data: Any # JSON

class BotSession(BotSessionBase):
    id: int
    customer_id: int
    organization_id: Optional[int]
    created_at: datetime
    last_interaction_at: datetime
    
    class Config:
        from_attributes = True

class BotSessionWithCustomer(BotSession):
    customer: BotCustomer
