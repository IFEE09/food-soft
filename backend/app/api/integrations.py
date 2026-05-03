from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Request, Security
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session

from app.core.activity import log_activity
from app.core.api_keys import hash_api_key
from app.core.inventory import deduct_supplies_for_line_items
from app.db.session import get_db
from app.db import models
from app.schemas import order as order_schema
from app.core.notifier import manager
from app.core.tenant import assert_kitchen_in_organization
from app.core.rate_limit import limiter

router = APIRouter()

API_KEY_NAME = "X-API-KEY"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=True)


async def get_organization_by_key(
    api_key: str = Security(api_key_header),
    db: Session = Depends(get_db),
) -> models.Organization:
    """Resuelve por SHA-256; migra texto plano legacy una vez."""
    if not api_key or not api_key.strip():
        raise HTTPException(
            status_code=403,
            detail="Llave de API inválida o expirada.",
        )
    stripped = api_key.strip()
    digest = hash_api_key(stripped)
    org = (
        db.query(models.Organization)
        .filter(models.Organization.api_key_hash == digest)
        .first()
    )
    if org:
        return org

    # Una sola consulta indexada por valor legacy (evita cargar todas las orgs)
    legacy_org = (
        db.query(models.Organization)
        .filter(models.Organization.api_key == stripped)
        .first()
    )
    if legacy_org and legacy_org.api_key:
        plain = legacy_org.api_key
        legacy_org.api_key_hash = hash_api_key(plain)
        legacy_org.api_key = None
        db.add(legacy_org)
        db.commit()
        db.refresh(legacy_org)
        return legacy_org

    raise HTTPException(
        status_code=403,
        detail="Llave de API inválida o expirada.",
    )

@router.post("/orders", response_model=order_schema.Order)
@limiter.limit("120/minute")
async def create_external_order(
    request: Request,
    *,
    db: Session = Depends(get_db),
    org: models.Organization = Depends(get_organization_by_key),
    order_in: order_schema.OrderCreate,
) -> Any:
    """
    Receives an order from an external bot (WhatsApp, etc.) using DeepSeek.
    """
    assert_kitchen_in_organization(db, order_in.kitchen_id, org.id)

    new_order = models.Order(
        client_name=order_in.client_name or "Cliente Robot",
        total=order_in.total,
        status="pending",
        kitchen_id=order_in.kitchen_id,
        organization_id=org.id
    )
    db.add(new_order)
    db.flush()

    lines: list[tuple[str, int]] = []
    for item_in in order_in.items:
        db.add(
            models.OrderItem(
                order_id=new_order.id,
                product_name=item_in.product_name,
                quantity=item_in.quantity,
            )
        )
        lines.append((item_in.product_name, item_in.quantity))

    deduct_supplies_for_line_items(db, org.id, lines)
    db.commit()
    db.refresh(new_order)

    log_activity(
        db, None,
        action="create", entity_type="order", entity_id=new_order.id,
        description=f"Orden externa #{new_order.id} recibida (bot/API) para '{new_order.client_name}' (total: ${new_order.total})",
        organization_id=org.id,
    )

    # NOTIFY WebSocket Clients instantly!
    await manager.notify_organization(
        org.id,
        {"type": "new_order", "order_id": new_order.id, "source": "api_key"},
    )

    return new_order
