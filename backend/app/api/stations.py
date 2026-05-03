from typing import Any, List
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.rate_limit import limiter
from app.db.session import get_db
from app.db import models
from app.schemas import station as station_schema
from app.api.auth import get_current_user, require_owner
from app.core.activity import log_activity
from app.core.tenant import get_owned_or_404

router = APIRouter()

@router.get("/", response_model=List[station_schema.Station])
@limiter.limit("180/minute")
def read_stations(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """ Get all stations for current organization. """
    return db.query(models.Station)\
             .filter(models.Station.organization_id == current_user.organization_id)\
             .offset(skip).limit(limit).all()

@router.post("/", response_model=station_schema.Station)
@limiter.limit("120/minute")
def create_station(
    request: Request,
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
    station_in: station_schema.StationCreate,
) -> Any:
    """ Add new production station for a kitchen. """
    station = models.Station(
        name=station_in.name, 
        is_active=station_in.is_active,
        kitchen_id=station_in.kitchen_id,
        organization_id=current_user.organization_id
    )
    db.add(station)
    db.commit()
    db.refresh(station)
    log_activity(
        db, current_user,
        action="create", entity_type="station", entity_id=station.id,
        description=f"Creó estación '{station.name}'"
    )
    return station

@router.put("/{id}", response_model=station_schema.Station)
@limiter.limit("120/minute")
def update_station(
    request: Request,
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
    id: int,
    station_in: station_schema.StationUpdate,
) -> Any:
    """ Update production station. """
    station = get_owned_or_404(db, models.Station, id, current_user, "Station not found")

    update_data = station_in.model_dump(exclude_unset=True)
    for field in update_data:
        setattr(station, field, update_data[field])

    db.add(station)
    db.commit()
    db.refresh(station)
    log_activity(
        db, current_user,
        action="update", entity_type="station", entity_id=station.id,
        description=f"Actualizó estación '{station.name}'"
    )
    return station

@router.delete("/{id}", response_model=station_schema.Station)
@limiter.limit("60/minute")
def delete_station(
    request: Request,
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
    id: int,
) -> Any:
    """ Delete a station. """
    station = get_owned_or_404(db, models.Station, id, current_user, "Station not found")
    deleted_id = station.id
    db.delete(station)
    db.commit()
    log_activity(
        db, current_user,
        action="delete", entity_type="station", entity_id=deleted_id,
        description=f"Eliminó estación ID {deleted_id}"
    )
    return station
