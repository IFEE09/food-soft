from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Security, Request
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db import models
from app.schemas import order as order_schema
from app.core.notifier import manager

router = APIRouter()

API_KEY_NAME = "X-API-KEY"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=True)

async def get_organization_by_key(
    api_key: str = Security(api_key_header),
    db: Session = Depends(get_db)
) -> models.Organization:
    org = db.query(models.Organization).filter(models.Organization.api_key == api_key).first()
    if not org:
        raise HTTPException(
            status_code=403,
            detail="Llave de API inválida o expirada."
        )
    return org

@router.post("/orders", response_model=order_schema.Order)
async def create_external_order(
    *,
    db: Session = Depends(get_db),
    org: models.Organization = Depends(get_organization_by_key),
    order_in: order_schema.OrderCreate,
    request: Request
) -> Any:
    """
    Receives an order from an external bot (WhatsApp, etc.) using DeepSeek.
    """
    new_order = models.Order(
        client_name=order_in.client_name or "Cliente Robot",
        total=order_in.total,
        status="pending",
        organization_id=org.id
    )
    db.add(new_order)
    db.flush()

    for item_in in order_in.items:
        # We could also automatically match names with menu_items to calculate recipe stock here
        # For now, just add the order item
        item = models.OrderItem(
            order_id=new_order.id,
            product_name=item_in.product_name,
            quantity=item_in.quantity
        )
        db.add(item)
    
    db.commit()
    db.refresh(new_order)

    # NOTIFY WebSocket Clients instantly!
    await manager.notify_organization(org.id, {"type": "new_order", "order_id": new_order.id})
    
    return new_order
