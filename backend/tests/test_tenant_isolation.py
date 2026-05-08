"""
Tests de aislamiento multi-tenant.

Verifica que org A nunca ve datos de org B y que el helper `scoped_query` rechaza
queries malformadas (sin organization_id, model sin organization_id).
"""

from __future__ import annotations

import pytest
from sqlalchemy.orm import sessionmaker

from app.core.tenant_guard import has_org_column, scoped_query
from app.db import models
from app.db.session import Base, engine


@pytest.fixture
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def two_orgs_with_data(db_session):
    org_a = models.Organization(name="Org A")
    org_b = models.Organization(name="Org B")
    db_session.add_all([org_a, org_b])
    db_session.flush()

    db_session.add_all([
        models.MenuItem(name="Pizza A", price=100.0, organization_id=org_a.id),
        models.MenuItem(name="Pizza B", price=200.0, organization_id=org_b.id),
        models.Supply(name="Queso A", quantity=10.0, organization_id=org_a.id),
        models.Supply(name="Queso B", quantity=20.0, organization_id=org_b.id),
    ])
    db_session.commit()
    return org_a, org_b


def test_scoped_query_filtra_por_organization(db_session, two_orgs_with_data):
    org_a, org_b = two_orgs_with_data

    items_a = scoped_query(db_session, models.MenuItem, organization_id=org_a.id).all()
    items_b = scoped_query(db_session, models.MenuItem, organization_id=org_b.id).all()

    assert {i.name for i in items_a} == {"Pizza A"}
    assert {i.name for i in items_b} == {"Pizza B"}


def test_scoped_query_falla_sin_organization_id(db_session):
    with pytest.raises(ValueError, match="organization_id requerido"):
        scoped_query(db_session, models.MenuItem, organization_id=None)


def test_scoped_query_falla_si_model_no_es_tenant(db_session):
    # OrderItem no tiene organization_id (lo hereda de Order via FK).
    with pytest.raises(ValueError, match="no tiene `organization_id`"):
        scoped_query(db_session, models.OrderItem, organization_id=1)


def test_has_org_column():
    assert has_org_column(models.MenuItem)
    assert has_org_column(models.Supply)
    assert has_org_column(models.Organization) is False  # es la org misma
    assert has_org_column(models.OrderItem) is False
