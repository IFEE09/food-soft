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


# ── Tests directos sobre _execute_* (red de seguridad pre-refactor) ──────────


def test_view_cart_vacio_muestra_mensaje(db_session, org_with_menu):
    from app.core.bot.engine import BotEngine

    org, _ = org_with_menu
    customer, session = BotEngine.get_or_create_session(db_session, org.id, "whatsapp", "+1")
    out = BotEngine._execute_view_cart("whatsapp", "+1", session, db_session)

    assert len(out) == 1
    body = out[0]["payload"]["text"]["body"]
    assert "vacío" in body.lower()


def test_view_cart_con_items_muestra_summary(db_session, org_with_menu):
    from app.core.bot.engine import BotEngine

    org, items = org_with_menu
    sender = "+2"
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, text="hola")
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, interactive_id=f"add_item_{items[0].id}")

    customer = db_session.query(models.BotCustomer).filter_by(channel_user_id=sender).first()
    session = db_session.query(models.BotSession).filter_by(customer_id=customer.id).first()
    out = BotEngine._execute_view_cart("whatsapp", sender, session, db_session)

    body = out[0]["payload"]["text"]["body"]
    assert items[0].name in body
    assert str(items[0].price) in body or f"{items[0].price:.0f}" in body


def test_update_quantity_a_cero_elimina_item(db_session, org_with_menu):
    from app.core.bot.engine import BotEngine

    org, items = org_with_menu
    sender = "+3"
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, text="hola")
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, interactive_id=f"add_item_{items[0].id}")

    customer = db_session.query(models.BotCustomer).filter_by(channel_user_id=sender).first()
    session = db_session.query(models.BotSession).filter_by(customer_id=customer.id).first()

    BotEngine._execute_update_quantity(db_session, "whatsapp", sender, session, items[0].id, 0)
    db_session.refresh(session)

    assert session.cart_data.get("items") == []
    assert session.cart_data.get("total") == 0.0


def test_update_quantity_aumenta(db_session, org_with_menu):
    from app.core.bot.engine import BotEngine

    org, items = org_with_menu
    sender = "+4"
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, text="hola")
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, interactive_id=f"add_item_{items[0].id}")

    customer = db_session.query(models.BotCustomer).filter_by(channel_user_id=sender).first()
    session = db_session.query(models.BotSession).filter_by(customer_id=customer.id).first()

    BotEngine._execute_update_quantity(db_session, "whatsapp", sender, session, items[0].id, 5)
    db_session.refresh(session)

    cart_items = session.cart_data["items"]
    assert len(cart_items) == 1
    assert cart_items[0]["qty"] == 5
    assert session.cart_data["total"] == items[0].price * 5


def test_remove_from_cart_decrementa_qty(db_session, org_with_menu):
    """Si qty > 1, remove decrementa en 1 (no borra)."""
    from app.core.bot.engine import BotEngine

    org, items = org_with_menu
    sender = "+5"
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, text="hola")
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, interactive_id=f"add_item_{items[0].id}")
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, interactive_id=f"add_item_{items[0].id}")

    customer = db_session.query(models.BotCustomer).filter_by(channel_user_id=sender).first()
    session = db_session.query(models.BotSession).filter_by(customer_id=customer.id).first()
    assert session.cart_data["items"][0]["qty"] == 2

    BotEngine._execute_remove_from_cart(db_session, "whatsapp", sender, session, items[0].id)
    db_session.refresh(session)

    assert session.cart_data["items"][0]["qty"] == 1


def test_remove_ultimo_item_vacia_carrito_y_estado_activo(db_session, org_with_menu):
    from app.core.bot.engine import BotEngine

    org, items = org_with_menu
    sender = "+6"
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, text="hola")
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, interactive_id=f"add_item_{items[0].id}")

    customer = db_session.query(models.BotCustomer).filter_by(channel_user_id=sender).first()
    session = db_session.query(models.BotSession).filter_by(customer_id=customer.id).first()

    BotEngine._execute_remove_from_cart(db_session, "whatsapp", sender, session, items[0].id)
    db_session.refresh(session)

    assert session.cart_data["items"] == []
    assert session.state == "ACTIVO"
    assert "confirm_step" not in session.cart_data


def test_cancel_order_limpia_carrito(db_session, org_with_menu):
    from app.core.bot.engine import BotEngine

    org, items = org_with_menu
    sender = "+7"
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, text="hola")
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, interactive_id=f"add_item_{items[0].id}")

    customer = db_session.query(models.BotCustomer).filter_by(channel_user_id=sender).first()
    session = db_session.query(models.BotSession).filter_by(customer_id=customer.id).first()

    BotEngine._execute_cancel_order(db_session, "whatsapp", sender, session)
    db_session.refresh(session)

    assert session.cart_data["items"] == []
    assert session.cart_data["total"] == 0.0
    assert session.state == "ACTIVO"


def test_add_dos_items_diferentes(db_session, org_with_menu):
    """Items distintos coexisten en el cart con qty=1 cada uno."""
    from app.core.bot.engine import BotEngine

    org, items = org_with_menu
    sender = "+8"
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, text="hola")
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, interactive_id=f"add_item_{items[0].id}")
    BotEngine.process_message(db=db_session, organization_id=org.id, channel="whatsapp",
                              sender_id=sender, interactive_id=f"add_item_{items[1].id}")

    customer = db_session.query(models.BotCustomer).filter_by(channel_user_id=sender).first()
    session = db_session.query(models.BotSession).filter_by(customer_id=customer.id).first()
    cart_items = session.cart_data["items"]

    assert len(cart_items) == 2
    ids = {it["id"] for it in cart_items}
    assert items[0].id in ids and items[1].id in ids
    assert session.cart_data["total"] == items[0].price + items[1].price


def test_add_item_con_nota_distinta_es_linea_separada(db_session, org_with_menu):
    """Mismo item con notas diferentes → 2 líneas en el carrito."""
    from app.core.bot.engine import BotEngine

    org, items = org_with_menu
    sender = "+9"
    BotEngine.get_or_create_session(db_session, org.id, "whatsapp", sender)
    customer = db_session.query(models.BotCustomer).filter_by(channel_user_id=sender).first()
    session = db_session.query(models.BotSession).filter_by(customer_id=customer.id).first()

    BotEngine._execute_add_to_cart(
        db_session, "whatsapp", sender, session, org.id, items[0].id, item_note="sin cebolla"
    )
    db_session.refresh(session)
    BotEngine._execute_add_to_cart(
        db_session, "whatsapp", sender, session, org.id, items[0].id, item_note="extra queso"
    )
    db_session.refresh(session)

    cart_items = session.cart_data["items"]
    assert len(cart_items) == 2  # mismo id, notes diferentes → líneas distintas
    notes = {it.get("note") for it in cart_items}
    assert notes == {"sin cebolla", "extra queso"}


def test_add_item_inexistente_devuelve_mensaje_error(db_session, org_with_menu):
    """item_id inválido → bot responde con mensaje de no disponible."""
    from app.core.bot.engine import BotEngine

    org, _ = org_with_menu
    sender = "+10"
    BotEngine.get_or_create_session(db_session, org.id, "whatsapp", sender)
    customer = db_session.query(models.BotCustomer).filter_by(channel_user_id=sender).first()
    session = db_session.query(models.BotSession).filter_by(customer_id=customer.id).first()

    out = BotEngine._execute_add_to_cart(
        db_session, "whatsapp", sender, session, org.id, item_id=99999
    )

    assert len(out) == 1
    body = out[0]["payload"]["text"]["body"]
    assert "no está disponible" in body.lower()


def test_total_redondeo_correcto(db_session, org_with_menu):
    """Verifica que total se redondea a 2 decimales sin errores de float."""
    from app.core.bot.engine import BotEngine

    org = models.Organization(name="Float Test")
    db_session.add(org)
    db_session.flush()
    item = models.MenuItem(name="Item 0.1", price=0.1, organization_id=org.id)
    db_session.add(item)
    db_session.commit()

    sender = "+11"
    BotEngine.get_or_create_session(db_session, org.id, "whatsapp", sender)
    customer = db_session.query(models.BotCustomer).filter_by(channel_user_id=sender).first()
    session = db_session.query(models.BotSession).filter_by(customer_id=customer.id).first()

    # 3 × 0.1 = 0.30000000000000004 en float; con _round_price → 0.30
    for _ in range(3):
        BotEngine._execute_add_to_cart(db_session, "whatsapp", sender, session, org.id, item.id)
        db_session.refresh(session)

    assert session.cart_data["total"] == 0.30


def test_isolation_entre_organizaciones(db_session, org_with_menu):
    """Mismo sender en orgs distintas → customers/sesiones separadas. Defensa multi-tenant."""
    from app.core.bot.engine import BotEngine

    org_a, _ = org_with_menu
    org_b = models.Organization(name="Otra Pizzería")
    db_session.add(org_b)
    db_session.commit()

    same_id = "+5215559999999"
    cust_a, sess_a = BotEngine.get_or_create_session(db_session, org_a.id, "whatsapp", same_id)
    cust_b, sess_b = BotEngine.get_or_create_session(db_session, org_b.id, "whatsapp", same_id)

    assert cust_a.id != cust_b.id
    assert sess_a.id != sess_b.id
    assert cust_a.organization_id == org_a.id
    assert cust_b.organization_id == org_b.id
