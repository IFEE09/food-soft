import pytest
from sqlalchemy.orm import sessionmaker

from app.db.session import Base, engine
from app.db import models
from app.core.inventory import deduct_supplies_for_line_items


@pytest.fixture
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_deduct_supplies_matches_menu_recipe(db_session):
    org = models.Organization(name="Test Org")
    db_session.add(org)
    db_session.flush()

    supply = models.Supply(
        name="Pan",
        quantity=100.0,
        unit="pz",
        organization_id=org.id,
    )
    db_session.add(supply)
    db_session.flush()

    dish = models.MenuItem(
        name="Hamburguesa Test",
        price=50.0,
        organization_id=org.id,
    )
    db_session.add(dish)
    db_session.flush()

    db_session.add(
        models.MenuItemRecipe(
            menu_item_id=dish.id,
            supply_id=supply.id,
            quantity=2.0,
        )
    )
    db_session.commit()

    deduct_supplies_for_line_items(
        db_session,
        org.id,
        [("Hamburguesa Test", 3)],
    )
    db_session.commit()

    db_session.refresh(supply)
    assert supply.quantity == 100.0 - (2.0 * 3)


def test_deduct_skips_unknown_product(db_session):
    org = models.Organization(name="O2")
    db_session.add(org)
    db_session.commit()

    deduct_supplies_for_line_items(
        db_session,
        org.id,
        [("No existe en menú", 1)],
    )
    db_session.commit()
