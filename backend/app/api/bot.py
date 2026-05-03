"""
Webhook omnicanal para Meta Cloud API.
Recibe eventos de WhatsApp, Facebook Messenger e Instagram DM en un único endpoint.
"""
import hashlib
import hmac
import json
import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.bot.engine import BotEngine
from app.core.bot.meta_client import dispatch_outbound_messages
from app.core.config import settings
from app.core.rate_limit import limiter
from app.db import models
from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


class MockBotPayload(BaseModel):
    channel: str
    channel_user_id: str
    organization_id: int
    text: str = ""
    interactive_id: Optional[str] = None


@router.get("/webhook")
@limiter.limit("30/minute")
def verify_webhook(request: Request):
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    verify_token = (settings.META_VERIFY_TOKEN or "").strip()
    if not verify_token:
        raise HTTPException(status_code=503, detail="META_VERIFY_TOKEN no configurado.")

    if mode == "subscribe" and token == verify_token:
        logger.info("Webhook verificado correctamente por Meta.")
        return int(challenge)

    raise HTTPException(status_code=403, detail="Token de verificación inválido.")


@router.post("/webhook")
@limiter.limit("300/minute")
async def receive_webhook(request: Request, bg_tasks: BackgroundTasks):
    if not (settings.META_APP_SECRET or "").strip():
        raise HTTPException(status_code=503, detail="META_APP_SECRET no configurado; webhook deshabilitado.")

    body_bytes = await request.body()

    signature = request.headers.get("X-Hub-Signature-256", "")
    if not signature:
        raise HTTPException(status_code=403, detail="Missing X-Hub-Signature-256 header.")

    expected_sig = hmac.new(
        settings.META_APP_SECRET.encode(),
        body_bytes,
        hashlib.sha256,
    ).hexdigest()
    sig_hex = signature.replace("sha256=", "").strip()

    if not hmac.compare_digest(sig_hex, expected_sig):
        raise HTTPException(status_code=403, detail="Invalid signature.")

    try:
        body = json.loads(body_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON body.")

    bg_tasks.add_task(process_meta_payload, body)
    return {"status": "EVENT_RECEIVED"}


@router.post("/mock")
@limiter.limit("60/minute")
def mock_bot_message(
    request: Request,
    payload: MockBotPayload,
    db: Session = Depends(get_db),
):
    if settings.ENV == "production" or not settings.ENABLE_BOT_MOCK_ENDPOINT:
        raise HTTPException(status_code=403, detail="Endpoint mock deshabilitado en producción.")

    outbound = BotEngine.process_message(
        db=db,
        organization_id=payload.organization_id,
        channel=payload.channel,
        sender_id=payload.channel_user_id,
        text=payload.text,
        interactive_id=payload.interactive_id,
    )
    return {"outbound_messages": outbound}


def _resolve_org_by_whatsapp(db: Session, phone_number_id: Optional[str]) -> Optional[int]:
    if not phone_number_id:
        return None
    pn = str(phone_number_id).strip()
    org = db.query(models.Organization).filter(
        models.Organization.whatsapp_phone_number_id == pn
    ).first()
    if not org:
        logger.warning("WhatsApp phone_number_id=%s sin organización vinculada.", pn)
    return org.id if org else None


def _resolve_org_by_page(db: Session, page_id: Optional[str], channel: str) -> Optional[int]:
    if not page_id:
        return None
    pid = str(page_id).strip()
    if channel == "messenger":
        org = db.query(models.Organization).filter(
            models.Organization.facebook_page_id == pid
        ).first()
    else:
        org = db.query(models.Organization).filter(
            models.Organization.instagram_page_id == pid
        ).first()
    if not org:
        logger.warning(
            "%s page_id=%s sin organización vinculada. "
            "Vincular con PATCH /organizations/me/%s",
            channel, pid, channel,
        )
    return org.id if org else None


def process_meta_payload(body: dict):
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        obj_type = body.get("object", "")

        # ── WhatsApp ─────────────────────────────────────────────────────────
        if obj_type == "whatsapp_business_account":
            for entry in body.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    metadata = value.get("metadata") or {}
                    phone_number_id = metadata.get("phone_number_id")
                    org_id = _resolve_org_by_whatsapp(db, phone_number_id)
                    if org_id is None:
                        continue

                    for msg in value.get("messages", []):
                        sender_id = msg.get("from", "")
                        text = (msg.get("text") or {}).get("body", "")

                        interactive_id = None
                        interactive = msg.get("interactive") or {}
                        if interactive.get("type") == "button_reply":
                            interactive_id = interactive.get("button_reply", {}).get("id")
                        elif interactive.get("type") == "list_reply":
                            interactive_id = interactive.get("list_reply", {}).get("id")

                        outbound = BotEngine.process_message(
                            db=db,
                            organization_id=org_id,
                            channel="whatsapp",
                            sender_id=sender_id,
                            text=text,
                            interactive_id=interactive_id,
                        )
                        dispatch_outbound_messages(
                            outbound_messages=outbound,
                            channel="whatsapp",
                            phone_number_id=phone_number_id,
                        )

        # ── Facebook Messenger ───────────────────────────────────────────────
        elif obj_type == "page":
            for entry in body.get("entry", []):
                page_id = str(entry.get("id", "")).strip()
                org_id = _resolve_org_by_page(db, page_id, "messenger")
                if org_id is None:
                    continue

                for event in entry.get("messaging", []):
                    sender_id = (event.get("sender") or {}).get("id", "")
                    if not sender_id:
                        continue

                    text = ""
                    interactive_id = None

                    if "message" in event:
                        msg = event["message"]
                        text = msg.get("text", "")
                        qr = msg.get("quick_reply")
                        if qr:
                            interactive_id = qr.get("payload")

                    elif "postback" in event:
                        interactive_id = event["postback"].get("payload", "")

                    outbound = BotEngine.process_message(
                        db=db,
                        organization_id=org_id,
                        channel="messenger",
                        sender_id=sender_id,
                        text=text,
                        interactive_id=interactive_id,
                    )
                    dispatch_outbound_messages(
                        outbound_messages=outbound,
                        channel="messenger",
                    )

        # ── Instagram DM ─────────────────────────────────────────────────────
        elif obj_type == "instagram":
            for entry in body.get("entry", []):
                ig_id = str(entry.get("id", "")).strip()
                org_id = _resolve_org_by_page(db, ig_id, "instagram")
                if org_id is None:
                    continue

                for event in entry.get("messaging", []):
                    sender_id = (event.get("sender") or {}).get("id", "")
                    if not sender_id:
                        continue

                    text = ""
                    interactive_id = None

                    if "message" in event:
                        msg = event["message"]
                        text = msg.get("text", "")
                        qr = msg.get("quick_reply")
                        if qr:
                            interactive_id = qr.get("payload")

                    elif "postback" in event:
                        interactive_id = event["postback"].get("payload", "")

                    outbound = BotEngine.process_message(
                        db=db,
                        organization_id=org_id,
                        channel="instagram",
                        sender_id=sender_id,
                        text=text,
                        interactive_id=interactive_id,
                    )
                    dispatch_outbound_messages(
                        outbound_messages=outbound,
                        channel="instagram",
                    )

        else:
            logger.debug("Webhook: tipo de objeto desconocido '%s'; ignorado.", obj_type)

    except Exception:
        logger.exception("Error procesando payload de Meta.")
    finally:
        db.close()
