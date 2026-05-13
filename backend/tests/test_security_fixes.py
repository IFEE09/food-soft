"""
Tests de regresión para los fixes de seguridad/multi-tenancy.

Cubre:
- get_current_user NO persiste el override de X-Organization-ID.
- /auth/register agrega la M:M user_organization_link.
- Order.kitchen_id existe en el modelo (regresión del AttributeError).
- Organization tiene delivery_phone y menu_image_url.

NOTA: usamos SQLite en memoria vía la fixture estándar de conftest.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from sqlalchemy.orm import sessionmaker

from app.db import models
from app.db.session import Base, engine


@pytest.fixture
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    yield s
    s.close()


# ─── Fix #1: Order.kitchen_id existe en el modelo ────────────────────────────


def test_order_model_tiene_kitchen_id(db_session):
    """Regresión: app/api/orders.py referencia Order.kitchen_id sin crash."""
    assert hasattr(models.Order, "kitchen_id"), \
        "Order debe tener columna kitchen_id (usada por /orders POST/PUT/GET)."

    # Crear un Order con kitchen_id no debe explotar.
    org = models.Organization(name="Org Test")
    db_session.add(org)
    db_session.flush()
    kitchen = models.Kitchen(name="Sucursal X", organization_id=org.id)
    db_session.add(kitchen)
    db_session.flush()

    o = models.Order(
        client_name="Cliente", total=100.0, status="pending",
        organization_id=org.id, kitchen_id=kitchen.id,
    )
    db_session.add(o)
    db_session.commit()
    db_session.refresh(o)
    assert o.kitchen_id == kitchen.id


# ─── Fix #2: /auth/register agrega M:M ──────────────────────────────────────


def test_register_agrega_user_a_la_M_a_M(db_session, monkeypatch):
    """Regresión: usuario recién registrado debe aparecer en user.organizations."""
    # Forzar PUBLIC_REGISTRATION_ENABLED para este test.
    from app.core.config import settings
    monkeypatch.setattr(settings, "PUBLIC_REGISTRATION_ENABLED", True)

    from fastapi import Request

    from app.api import auth as auth_mod
    from app.schemas.user import UserCreate

    # Mock del request (necesario por @limiter.limit).
    fake_request = MagicMock(spec=Request)
    fake_request.client.host = "127.0.0.1"
    fake_request.headers = {}

    payload = UserCreate(
        email="nuevo@test.com",
        full_name="Nuevo Owner",
        password="ContraseñaSegura123",
    )
    auth_mod.register_user(fake_request, db=db_session, user_in=payload)

    user = db_session.query(models.User).filter_by(email="nuevo@test.com").first()
    assert user is not None
    assert user.organization_id is not None
    # CRÍTICO: la M:M user_organization_link debe estar poblada.
    assert len(user.organizations) == 1, \
        "Registrar debe agregar al user a la tabla M:M (sino el selector queda vacío)."
    assert user.organizations[0].id == user.organization_id


# ─── Fix #3: get_current_user NO persiste el override ──────────────────────


def test_get_current_user_no_persiste_X_Organization_ID(db_session, monkeypatch):
    """Regresión crítica: header X-Organization-ID NO debe escribir users.organization_id."""
    from app.api import auth as auth_mod
    from app.core import security

    # Setup: user en 2 orgs, primaria = A, header pide B.
    org_a = models.Organization(name="A")
    org_b = models.Organization(name="B")
    db_session.add_all([org_a, org_b])
    db_session.flush()

    user = models.User(
        email="u@test.com", full_name="U",
        hashed_password=security.get_password_hash("p"),
        role="owner", is_active=True,
        organization_id=org_a.id,
    )
    user.organizations.append(org_a)
    user.organizations.append(org_b)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    original_primary_org = user.organization_id

    # Construir un Request mockeado con el header.
    class FakeHeaders:
        def __init__(self, d): self._d = d
        def get(self, k, default=None): return self._d.get(k, default)

    fake_request = MagicMock()
    fake_request.headers = FakeHeaders({"X-Organization-ID": str(org_b.id)})

    token = security.create_access_token(user.id)
    resolved = auth_mod.get_current_user(db=db_session, token=token, request=fake_request)

    # El user activo debe reflejar B como active_organization_id.
    assert resolved.active_organization_id == org_b.id

    # Simular que el endpoint hace un commit cualquiera (ej: log_activity, update perfil)
    db_session.commit()

    # Re-leer de DB: organization_id NO debe haber cambiado.
    db_session.expire(user)
    user_fresh = db_session.query(models.User).filter_by(id=user.id).first()
    assert user_fresh.organization_id == original_primary_org, \
        "X-Organization-ID NO debe persistirse en users.organization_id."


def test_get_current_user_rechaza_org_sin_acceso(db_session, monkeypatch):
    """X-Organization-ID a una org sin acceso → HTTPException 403."""
    from fastapi import HTTPException

    from app.api import auth as auth_mod
    from app.core import security

    org_a = models.Organization(name="A")
    org_otra = models.Organization(name="Otra")
    db_session.add_all([org_a, org_otra])
    db_session.flush()

    user = models.User(
        email="x@test.com", full_name="X",
        hashed_password=security.get_password_hash("p"),
        role="owner", is_active=True,
        organization_id=org_a.id,
    )
    user.organizations.append(org_a)
    db_session.add(user)
    db_session.commit()

    class FakeHeaders:
        def __init__(self, d): self._d = d
        def get(self, k, default=None): return self._d.get(k, default)

    fake_request = MagicMock()
    fake_request.headers = FakeHeaders({"X-Organization-ID": str(org_otra.id)})

    token = security.create_access_token(user.id)
    with pytest.raises(HTTPException) as exc_info:
        auth_mod.get_current_user(db=db_session, token=token, request=fake_request)
    assert exc_info.value.status_code == 403


# ─── Fix #5/#9: Organization tiene delivery_phone y menu_image_url ─────────


def test_organization_tiene_delivery_phone_y_menu_image_url(db_session):
    """Multi-tenancy: cada org puede tener su teléfono de repartidor y su imagen."""
    assert hasattr(models.Organization, "delivery_phone"), \
        "Organization debe tener delivery_phone (eliminar hardcoded en orders.py)."
    assert hasattr(models.Organization, "menu_image_url"), \
        "Organization debe tener menu_image_url (eliminar hardcoded en _constants.py)."

    org = models.Organization(
        name="Pizzería Z",
        delivery_phone="529991234567",
        menu_image_url="https://example.com/menu-z.png",
    )
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    assert org.delivery_phone == "529991234567"
    assert org.menu_image_url == "https://example.com/menu-z.png"


# ─── Fix #5: show_menu del bot usa menu_image_url por org ──────────────────


def test_show_menu_usa_menu_image_url_por_org(db_session):
    """Si la org tiene menu_image_url, el bot envía esa URL; si no, fallback."""
    from app.core.bot._actions import show_menu

    # Con URL custom
    out = show_menu("whatsapp", "+5215550000001", menu_image_url="https://x.test/img.png")
    image_actions = [a for a in out if a["action"] == "SEND_IMAGE"]
    assert len(image_actions) == 1
    payload = image_actions[0]["payload"]
    # WhatsAppAdapter pone la URL en payload["image"]["link"]
    assert payload["image"]["link"] == "https://x.test/img.png"

    # Sin URL → fallback al MENU_IMG global
    from app.core.bot._constants import MENU_IMG
    out2 = show_menu("whatsapp", "+5215550000002")
    image_actions2 = [a for a in out2 if a["action"] == "SEND_IMAGE"]
    assert len(image_actions2) == 1
    assert image_actions2[0]["payload"]["image"]["link"] == MENU_IMG

    # menu_image_url='' explícitamente → sin imagen
    out3 = show_menu("whatsapp", "+5215550000003", menu_image_url="")
    image_actions3 = [a for a in out3 if a["action"] == "SEND_IMAGE"]
    assert len(image_actions3) == 0
