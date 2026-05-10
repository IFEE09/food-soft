"""
REST API para mesas de restaurante y reservaciones.
Rutas:
  /tables/                     GET, POST
  /tables/{id}                 GET, PUT, DELETE
  /tables/{id}/status          PATCH  (available | occupied | reserved | cleaning)
  /reservations/               GET, POST
  /reservations/{id}           GET, PUT, DELETE
  /reservations/{id}/status    PATCH  (pending | confirmed | seated | cancelled | no_show)
  /reservations/availability   GET   (fecha + party_size → mesas disponibles)
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import get_current_user, require_owner
from app.db.models import Reservation, RestaurantTable, User
from app.db.session import get_db

router = APIRouter(tags=["tables"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class TableCreate(BaseModel):
    number: int
    name: str | None = None
    capacity: int = 4
    pos_x: float = 0.0
    pos_y: float = 0.0
    shape: str = "square"   # square | round | rectangle
    kitchen_id: int | None = None


class TableUpdate(BaseModel):
    number: int | None = None
    name: str | None = None
    capacity: int | None = None
    pos_x: float | None = None
    pos_y: float | None = None
    shape: str | None = None
    is_active: bool | None = None
    kitchen_id: int | None = None


class TableStatusPatch(BaseModel):
    status: str  # available | occupied | reserved | cleaning


class ReservationCreate(BaseModel):
    table_id: int | None = None
    guest_name: str
    guest_phone: str | None = None
    guest_email: str | None = None
    party_size: int = 2
    reserved_at: datetime
    duration_minutes: int = 90
    notes: str | None = None
    source: str = "online"   # online | phone | walkin | whatsapp


class ReservationUpdate(BaseModel):
    table_id: int | None = None
    guest_name: str | None = None
    guest_phone: str | None = None
    guest_email: str | None = None
    party_size: int | None = None
    reserved_at: datetime | None = None
    duration_minutes: int | None = None
    notes: str | None = None
    status: str | None = None


class ReservationStatusPatch(BaseModel):
    status: str  # pending | confirmed | seated | cancelled | no_show


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_org_id(user: User) -> int:
    if not user.organization_id:
        raise HTTPException(status_code=400, detail="Usuario sin organización activa.")
    return user.organization_id


def _table_or_404(db: Session, table_id: int, org_id: int) -> RestaurantTable:
    t = db.query(RestaurantTable).filter_by(id=table_id, organization_id=org_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Mesa no encontrada.")
    return t


def _reservation_or_404(db: Session, res_id: int, org_id: int) -> Reservation:
    r = db.query(Reservation).filter_by(id=res_id, organization_id=org_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reservación no encontrada.")
    return r


def _table_to_dict(t: RestaurantTable) -> dict:
    return {
        "id": t.id,
        "number": t.number,
        "name": t.name,
        "capacity": t.capacity,
        "status": t.status,
        "pos_x": t.pos_x,
        "pos_y": t.pos_y,
        "shape": t.shape,
        "is_active": t.is_active,
        "kitchen_id": t.kitchen_id,
        "organization_id": t.organization_id,
    }


def _res_to_dict(r: Reservation) -> dict:
    return {
        "id": r.id,
        "table_id": r.table_id,
        "table_number": r.table.number if r.table else None,
        "guest_name": r.guest_name,
        "guest_phone": r.guest_phone,
        "guest_email": r.guest_email,
        "party_size": r.party_size,
        "reserved_at": r.reserved_at.isoformat() if r.reserved_at else None,
        "duration_minutes": r.duration_minutes,
        "status": r.status,
        "notes": r.notes,
        "source": r.source,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


# ── Tables ────────────────────────────────────────────────────────────────────

@router.get("/tables/")
def list_tables(
    kitchen_id: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org_id = _get_org_id(user)
    q = db.query(RestaurantTable).filter_by(organization_id=org_id, is_active=True)
    if kitchen_id:
        q = q.filter_by(kitchen_id=kitchen_id)
    return [_table_to_dict(t) for t in q.order_by(RestaurantTable.number).all()]


@router.post("/tables/", status_code=201)
def create_table(
    body: TableCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_owner),
):
    org_id = _get_org_id(user)
    # Verificar que el número no esté duplicado en la organización
    existing = db.query(RestaurantTable).filter_by(organization_id=org_id, number=body.number).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Ya existe la Mesa {body.number} en esta organización.")
    t = RestaurantTable(
        organization_id=org_id,
        kitchen_id=body.kitchen_id,
        number=body.number,
        name=body.name,
        capacity=body.capacity,
        pos_x=body.pos_x,
        pos_y=body.pos_y,
        shape=body.shape,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _table_to_dict(t)


@router.get("/tables/{table_id}")
def get_table(
    table_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _table_to_dict(_table_or_404(db, table_id, _get_org_id(user)))


@router.put("/tables/{table_id}")
def update_table(
    table_id: int,
    body: TableUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_owner),
):
    t = _table_or_404(db, table_id, _get_org_id(user))
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(t, field, value)
    db.commit()
    db.refresh(t)
    return _table_to_dict(t)


@router.patch("/tables/{table_id}/status")
def update_table_status(
    table_id: int,
    body: TableStatusPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    valid = {"available", "occupied", "reserved", "cleaning"}
    if body.status not in valid:
        raise HTTPException(status_code=422, detail=f"Estado inválido. Opciones: {valid}")
    t = _table_or_404(db, table_id, _get_org_id(user))
    t.status = body.status
    db.commit()
    return {"id": t.id, "status": t.status}


@router.delete("/tables/{table_id}", status_code=204)
def delete_table(
    table_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_owner),
):
    t = _table_or_404(db, table_id, _get_org_id(user))
    t.is_active = False   # Soft delete
    db.commit()


# ── Reservations ──────────────────────────────────────────────────────────────

@router.get("/reservations/")
def list_reservations(
    date: str | None = Query(None, description="YYYY-MM-DD — filtra por día"),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org_id = _get_org_id(user)
    q = db.query(Reservation).filter_by(organization_id=org_id)
    if status:
        q = q.filter_by(status=status)
    if date:
        try:
            day = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=422, detail="Formato de fecha inválido. Usa YYYY-MM-DD.")
        day_end = day + timedelta(days=1)
        q = q.filter(Reservation.reserved_at >= day, Reservation.reserved_at < day_end)
    return [_res_to_dict(r) for r in q.order_by(Reservation.reserved_at).all()]


@router.get("/reservations/availability")
def check_availability(
    date: str = Query(..., description="YYYY-MM-DD"),
    time: str = Query(..., description="HH:MM"),
    party_size: int = Query(2),
    duration_minutes: int = Query(90),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Devuelve las mesas disponibles para la fecha/hora y tamaño de grupo."""
    org_id = _get_org_id(user)
    try:
        requested_dt = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M").replace(tzinfo=UTC)
    except ValueError:
        raise HTTPException(status_code=422, detail="Formato inválido. Usa date=YYYY-MM-DD y time=HH:MM.")

    requested_end = requested_dt + timedelta(minutes=duration_minutes)

    # Todas las mesas activas con capacidad suficiente
    all_tables = (
        db.query(RestaurantTable)
        .filter_by(organization_id=org_id, is_active=True)
        .filter(RestaurantTable.capacity >= party_size)
        .all()
    )

    # Reservaciones que se solapan con el horario pedido
    conflicting = (
        db.query(Reservation.table_id)
        .filter(
            Reservation.organization_id == org_id,
            Reservation.status.in_(["pending", "confirmed", "seated"]),
            Reservation.reserved_at < requested_end,
            (Reservation.reserved_at + timedelta(minutes=duration_minutes)) > requested_dt,
        )
        .all()
    )
    busy_ids = {row[0] for row in conflicting if row[0]}

    available = [_table_to_dict(t) for t in all_tables if t.id not in busy_ids]
    return {"requested_at": requested_dt.isoformat(), "party_size": party_size, "available_tables": available}


@router.post("/reservations/", status_code=201)
def create_reservation(
    body: ReservationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org_id = _get_org_id(user)
    r = Reservation(
        organization_id=org_id,
        table_id=body.table_id,
        guest_name=body.guest_name,
        guest_phone=body.guest_phone,
        guest_email=body.guest_email,
        party_size=body.party_size,
        reserved_at=body.reserved_at,
        duration_minutes=body.duration_minutes,
        notes=body.notes,
        source=body.source,
        status="pending",
    )
    db.add(r)
    # Si se asignó mesa, marcarla como reservada
    if body.table_id:
        t = db.query(RestaurantTable).filter_by(id=body.table_id, organization_id=org_id).first()
        if t:
            t.status = "reserved"
    db.commit()
    db.refresh(r)
    return _res_to_dict(r)


@router.get("/reservations/{res_id}")
def get_reservation(
    res_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _res_to_dict(_reservation_or_404(db, res_id, _get_org_id(user)))


@router.put("/reservations/{res_id}")
def update_reservation(
    res_id: int,
    body: ReservationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = _reservation_or_404(db, res_id, _get_org_id(user))
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(r, field, value)
    db.commit()
    db.refresh(r)
    return _res_to_dict(r)


@router.patch("/reservations/{res_id}/status")
def update_reservation_status(
    res_id: int,
    body: ReservationStatusPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    valid = {"pending", "confirmed", "seated", "cancelled", "no_show"}
    if body.status not in valid:
        raise HTTPException(status_code=422, detail=f"Estado inválido. Opciones: {valid}")
    org_id = _get_org_id(user)
    r = _reservation_or_404(db, res_id, org_id)
    r.status = body.status
    # Liberar mesa si se cancela o no_show
    if body.status in ("cancelled", "no_show") and r.table_id:
        t = db.query(RestaurantTable).filter_by(id=r.table_id, organization_id=org_id).first()
        if t and t.status == "reserved":
            t.status = "available"
    # Marcar mesa como ocupada si se sienta al cliente
    if body.status == "seated" and r.table_id:
        t = db.query(RestaurantTable).filter_by(id=r.table_id, organization_id=org_id).first()
        if t:
            t.status = "occupied"
    db.commit()
    return {"id": r.id, "status": r.status}


@router.delete("/reservations/{res_id}", status_code=204)
def delete_reservation(
    res_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_owner),
):
    r = _reservation_or_404(db, res_id, _get_org_id(user))
    db.delete(r)
    db.commit()
