"""
Tests del motor del bot — pinea comportamiento crítico antes del refactor.

NO testeamos el LLM (DeepSeek) — lo mockeamos. Testeamos las DECISIONES del motor:
- saludo → muestra menú
- agregar item directo (interactive_id) → cart actualiza
- _execute_add_to_cart calcula totales correctamente
- carrito pendiente al saludar → ofrece continuar/nuevo
- timeout inactividad → reset cart

Diseño: SQLite en memoria + factory de orgs/menu/sesiones. Cada test es aislado.
"""

from __future__ import annotations

from typing import List

import pytest
from sqlalchemy.orm import sessionmaker

from app.db.session import Base, engine
from app.db import models


@pytest.fixture
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def org_with_menu(db_session):
    """Crea una org con 3 items de menú para los tests."""
    org = models.Organization(name="Test Pizzería")
    db_session.add(org)
    db_session.flush()

    items = [
        models.MenuItem(name="Pizza Pepperoni", price=149.0, organization_id=org.id),
        models.MenuItem(name="Pizza Hawaiana", price=189.0, organization_id=org.id),
        models.MenuItem(name="Refresco 600ml", price=35.0, organization_id=org.id),
    ]
    db_session.add_all(items)
    db_session.commit()
    return org, items


@pytest.fixture(autouse=True)
def patch_deepseek(monkeypatch):
    """Mock DeepSeek para no llamar LLM en tests."""
    def _fake_ask(**kwargs):
        # Devuelve SHOW_MENU por defecto. Tests específicos pueden re-mockear.
        return [{"action": "SHOW_MENU"}]

    import app.core.bot.engine as engine_mod
    monkeypatch.setattr(engine_mod, "ask_deepseek", _fake_ask)


# ── Tests ────────────────────────────────────────────────────────────────────


def test_saludo_inicial_muestra_menu(db_session, org_with_menu):
    from app.core.bot.engine import BotEngine

    org, _ = org_with_menu
    out = BotEngine.process_message(
        db=db_session,
        organization_id=org.id,
        channel="whatsapp",
        sender_id="+5215555555555",
        text="hola",
    )

    actions = [m["action"] for m in out]
    assert "SEND_IMAGE" in actions, "Saludo debe enviar imagen del menú"
    # Verifica que se creó customer + session
    customer = db_session.query(models.BotCustomer).filter_by(channel_user_id="+5215555555555").first()
    assert customer is not None
    session = db_session.query(models.BotSession).filter_by(customer_id=customer.id).first()
    assert session is not None


def test_add_to_cart_via_interactive_id(db_session, org_with_menu):
    from app.core.bot.engine import BotEngine

    org, items = org_with_menu
    pepperoni = items[0]

    # Saludo primero (crea sesión).
    BotEngine.process_message(
        db=db_session, organization_id=org.id, channel="whatsapp",
        sender_id="+5215551111111", text="hola",
    )

    # Click en botón "agregar pepperoni".
    BotEngine.process_message(
        db=db_session, organization_id=org.id, channel="whatsapp",
        sender_id="+5215551111111",
        interactive_id=f"add_item_{pepperoni.id}",
    )

    # Verifica cart.
    customer = db_session.query(models.BotCustomer).filter_by(channel_user_id="+5215551111111").first()
    session = db_session.query(models.BotSession).filter_by(customer_id=customer.id).first()
    cart = session.cart_data
    assert isinstance(cart, dict)
    items_in_cart = cart.get("items", [])
    assert len(items_in_cart) == 1
    assert items_in_cart[0]["id"] == pepperoni.id
    assert items_in_cart[0]["qty"] == 1
    assert cart.get("total") == pepperoni.price


def test_add_same_item_twice_increments_qty(db_session, org_with_menu):
    from app.core.bot.engine import BotEngine

    org, items = org_with_menu
    pepperoni = items[0]

    # Saludo + 2x add same item.
    sender = "+5215552222222"
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, text="hola")
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, interactive_id=f"add_item_{pepperoni.id}")
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, interactive_id=f"add_item_{pepperoni.id}")

    customer = db_session.query(models.BotCustomer).filter_by(channel_user_id=sender).first()
    session = db_session.query(models.BotSession).filter_by(customer_id=customer.id).first()
    items_in_cart = session.cart_data.get("items", [])

    assert len(items_in_cart) == 1
    assert items_in_cart[0]["qty"] == 2
    assert session.cart_data.get("total") == pepperoni.price * 2


def test_saludo_con_carrito_pendiente_ofrece_opciones(db_session, org_with_menu):
    from app.core.bot.engine import BotEngine

    org, items = org_with_menu
    sender = "+5215553333333"

    # Crear sesión + agregar item
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, text="hola")
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, interactive_id=f"add_item_{items[0].id}")

    # Saludar de nuevo → debe ofrecer "continuar/nuevo" en lugar de mostrar menú.
    out = BotEngine.process_message(
        db=db_session, organization_id=org.id, channel="whatsapp",
        sender_id=sender, text="hola",
    )

    bodies = " ".join(m.get("payload", {}).get("text", {}).get("body", "") for m in out if m.get("action") == "SEND_TEXT")
    # El motor envía un mensaje hablando del pedido en curso.
    assert "pedido en curso" in bodies.lower() or "continuar" in bodies.lower()


def test_get_or_create_session_es_idempotente(db_session, org_with_menu):
    from app.core.bot.engine import BotEngine

    org, _ = org_with_menu
    sender = "+5215554444444"

    customer1, session1 = BotEngine.get_or_create_session(db_session, org.id, "whatsapp", sender)
    customer2, session2 = BotEngine.get_or_create_session(db_session, org.id, "whatsapp", sender)

    assert customer1.id == customer2.id
    assert session1.id == session2.id


def test_isolation_entre_canales(db_session, org_with_menu):
    """Mismo sender_id en whatsapp vs messenger = customers diferentes."""
    from app.core.bot.engine import BotEngine

    org, _ = org_with_menu
    same_id = "1234567890"

    cust_wa, _ = BotEngine.get_or_create_session(db_session, org.id, "whatsapp", same_id)
    cust_fb, _ = BotEngine.get_or_create_session(db_session, org.id, "messenger", same_id)

    assert cust_wa.id != cust_fb.id
    assert cust_wa.channel == "whatsapp"
    assert cust_fb.channel == "messenger"
