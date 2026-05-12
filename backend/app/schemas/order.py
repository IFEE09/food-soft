from datetime import datetime

from pydantic import BaseModel, ConfigDict


# Order Items
class OrderItemBase(BaseModel):
    product_name: str
    quantity: int = 1

class OrderItemCreate(OrderItemBase):
    note: str | None = None
    station_id: int | None = None  # KDS: se hereda del MenuItem si no se especifica

class OrderItemStatusUpdate(BaseModel):
    """Payload para actualizar el estado individual de un ítem desde el KDS."""
    item_status: str  # pending | in_progress | done

class OrderItem(OrderItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    note: str | None = None
    station_id: int | None = None   # KDS: estación responsable de este ítem
    item_status: str = "pending"    # KDS: pending | in_progress | done

# Orders
class OrderBase(BaseModel):
    client_name: str | None = None
    total: float = 0.0
    status: str = "pending"
    kitchen_id: int | None = None

class OrderCreate(OrderBase):
    items: list[OrderItemCreate]

class OrderUpdate(OrderBase):
    ready_at: datetime | None = None
    delivered_at: datetime | None = None
    status: str | None = None
    kitchen_id: int | None = None

class Order(OrderBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    ready_at: datetime | None = None
    delivered_at: datetime | None = None
    delivery_address: str | None = None
    notes: str | None = None
    channel: str | None = None
    items: list[OrderItem] = []
