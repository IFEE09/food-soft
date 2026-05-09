"""
Healthchecks separados (estándar k8s/Railway):
  /health  → liveness:  el proceso está vivo. Nunca toca DB.
  /ready   → readiness: dependencias OK (DB pingeable). Si falla, el orquestador deja de
             enviar tráfico a este pod hasta que se recupere.

No mover lógica de negocio aquí. Estos endpoints deben ser baratos y rápidos.
"""

from __future__ import annotations

import requests as _requests
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import get_db

router = APIRouter(tags=["health"])
log = get_logger(__name__)


@router.get("/health", summary="Liveness probe")
def liveness() -> dict[str, str]:
    """Siempre 200 si el proceso responde. NO consulta dependencias."""
    return {"status": "ok"}


@router.get("/ready", summary="Readiness probe")
def readiness(db: Session = Depends(get_db)) -> dict[str, str]:
    """200 si la DB está alcanzable; 503 si no."""
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        log.warning("readiness_db_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        )
    return {"status": "ready"}


@router.get("/diag/whatsapp", summary="Diagnóstico WhatsApp — temporal")
def diag_whatsapp(db: Session = Depends(get_db)) -> dict:
    """
    Endpoint temporal de diagnóstico:
    1. Verifica META_ACCESS_TOKEN
    2. Consulta Meta API para listar phone numbers de la cuenta
    3. Muestra whatsapp_phone_number_id guardado en la BD
    4. Intenta enviar un mensaje de prueba al repartidor
    """
    from app.core.config import settings
    from app.db import models

    result = {}

    # 1. Token
    token = settings.META_ACCESS_TOKEN or ""
    result["token_configurado"] = bool(token)
    result["token_preview"] = token[:12] + "..." if token else "VACÍO"

    # 2. Consultar phone numbers en Meta API
    if token:
        try:
            resp = _requests.get(
                "https://graph.facebook.com/v19.0/me/phone_numbers",
                headers={"Authorization": f"Bearer {token}"},
                timeout=8,
            )
            result["meta_api_status"] = resp.status_code
            if resp.status_code == 200:
                data = resp.json()
                result["meta_phone_numbers"] = data.get("data", [])
            else:
                result["meta_api_error"] = resp.text[:300]
        except Exception as e:
            result["meta_api_exception"] = str(e)
    else:
        result["meta_api"] = "SALTADO — sin token"

    # 3. phone_number_id en BD
    orgs = db.query(models.Organization).all()
    result["organizaciones"] = [
        {"id": o.id, "name": o.name, "phone_number_id": o.whatsapp_phone_number_id}
        for o in orgs
    ]

    # 4. Prueba de envío al repartidor
    if token and orgs:
        org = orgs[0]
        pnid = org.whatsapp_phone_number_id
        if pnid:
            try:
                payload = {
                    "messaging_product": "whatsapp",
                    "to": "529993372150",
                    "type": "text",
                    "text": {"body": "🔧 Mensaje de prueba de diagnóstico — sistema Horno 74"}
                }
                resp2 = _requests.post(
                    f"https://graph.facebook.com/v19.0/{pnid}/messages",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    timeout=10,
                )
                result["test_envio_status"] = resp2.status_code
                result["test_envio_respuesta"] = resp2.json()
            except Exception as e:
                result["test_envio_exception"] = str(e)
        else:
            result["test_envio"] = "SALTADO — phone_number_id vacío en BD"

    return result


@router.get("/diag/set-phone-id", summary="Guardar phone_number_id en BD — temporal")
def diag_set_phone_id(
    org_id: int,
    phone_number_id: str,
    db: Session = Depends(get_db)
) -> dict:
    """
    Endpoint temporal para guardar el whatsapp_phone_number_id en la BD.
    Uso: /diag/set-phone-id?org_id=3&phone_number_id=1121553614371005
    """
    from app.db import models
    org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not org:
        return {"error": f"Organización {org_id} no encontrada"}
    old_id = org.whatsapp_phone_number_id
    org.whatsapp_phone_number_id = phone_number_id.strip()
    db.add(org)
    db.commit()
    db.refresh(org)
    return {
        "ok": True,
        "org_id": org.id,
        "org_name": org.name,
        "phone_number_id_anterior": old_id,
        "phone_number_id_nuevo": org.whatsapp_phone_number_id
    }
