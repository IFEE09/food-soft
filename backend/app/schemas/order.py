from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

# Order Items
class OrderItemBase(BaseModel):
    product_name: str
    quantity: int = 1

class OrderItemCreate(OrderItemBase):
    pass

class OrderItem(OrderItemBase):
    id: int
    order_id: int

    class Config:
        from_attributes = True

# Orders
class OrderBase(BaseModel):
    client_name: Optional[str] = None
    total: float = 0.0
    status: str = "pending"

class OrderCreate(OrderBase):
    items: List[OrderItemCreate]

class OrderUpdate(OrderBase):
    ready_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None

class Order(OrderBase):
    id: int
    created_at: datetime
    ready_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    items: List[OrderItem] = []

    class Config:
        from_attributes = True
