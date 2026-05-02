import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Dict, Optional

from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.core.bot.engine import BotEngine
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

class MockMetaPayload(BaseModel):
    channel: str # whatsapp, messenger
    channel_user_id: str
    message: str 
    # Optional field to simulate interactive button/list clicks
    interactive_id: Optional[str] = None
    org_id: int = 1

@router.post("/mock")
def mock_webhook_receive(payload: MockMetaPayload, db: Session = Depends(get_db)):
    """
    Simulates receiving a payload from Meta APIs without needing ngrok or internet connection.
    """
    if settings.ENV == "production":
        raise HTTPException(status_code=404, detail="Not Found")
    if not settings.ENABLE_BOT_MOCK_ENDPOINT:
        raise HTTPException(status_code=404, detail="Not Found")

    response_logs = BotEngine.process_message(
        db=db,
        organization_id=payload.org_id,
        channel=payload.channel,
        sender_id=payload.channel_user_id,
        text=payload.message,
        interactive_id=payload.interactive_id
    )

    return {
        "status": "success",
        "simulated_replies_generated": response_logs,
        "message": "En producción, estos JSON se enviarían por HTTP POST a Graph API envueltos en Axios/requests."
    }

@router.get("/webhook")
def verify_meta_webhook(
    mode: str = Query(None, alias="hub.mode"),
    token: str = Query(None, alias="hub.verify_token"),
    challenge: str = Query(None, alias="hub.challenge")
):
    """
    Meta Webhook Verification (Handshake)
    """
    if mode == "subscribe" and token == settings.META_VERIFY_TOKEN:
        return int(challenge)
    raise HTTPException(status_code=403, detail="Verification token mismatch")

@router.post("/webhook")
async def receive_meta_event(request: Request, bg_tasks: BackgroundTasks):
    """
    Receives real events from Meta (WhatsApp, IG, Messenger).
    Extracts data and processes it asynchronously after validating signature.
    """
    if settings.ENV == "production" and not (settings.META_APP_SECRET or "").strip():
        raise HTTPException(
            status_code=503,
            detail="META_APP_SECRET no configurado; webhook deshabilitado.",
        )

    body_bytes = await request.body()

    if settings.META_APP_SECRET:
        signature = request.headers.get("X-Hub-Signature-256")
        if not signature:
            raise HTTPException(status_code=403, detail="Missing signature header")

        expected_sig = hmac.new(
            settings.META_APP_SECRET.encode(),
            body_bytes,
            hashlib.sha256,
        ).hexdigest()
        sig_hex = signature.replace("sha256=", "").strip()
        if not hmac.compare_digest(sig_hex, expected_sig):
            raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        body = json.loads(body_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    # Meta expects immediate 200 OK
    bg_tasks.add_task(process_meta_payload, body)
    
    return {"status": "EVENT_RECEIVED"}


def _resolve_whatsapp_organization_id(db: Session, metadata: Optional[Dict]) -> int:
    """Multitenancy: metadata.phone_number_id → Organization.whatsapp_phone_number_id."""
    meta = metadata or {}
    pn = meta.get("phone_number_id")
    if pn:
        pn_str = str(pn).strip()
        org = (
            db.query(models.Organization)
            .filter(models.Organization.whatsapp_phone_number_id == pn_str)
            .first()
        )
        if org:
            return org.id
        logger.warning(
            "WhatsApp phone_number_id=%s sin organización vinculada; usar PATCH "
            "/organizations/me/whatsapp. DEFAULT_BOT_ORGANIZATION_ID=%s.",
            pn_str,
            settings.DEFAULT_BOT_ORGANIZATION_ID,
        )
    else:
        logger.warning(
            "Webhook WhatsApp sin metadata.phone_number_id; usando "
            "DEFAULT_BOT_ORGANIZATION_ID=%s.",
            settings.DEFAULT_BOT_ORGANIZATION_ID,
        )
    return settings.DEFAULT_BOT_ORGANIZATION_ID


def process_meta_payload(body: dict):
    """
    Parser logic for the complex Meta JSON payloads.
    Uses a fresh DB session (request session must not be used after the HTTP response).
    """
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        # 1. WhatsApp Parser
        if body.get("object") == "whatsapp_business_account":
            for entry in body.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    metadata = value.get("metadata") or {}
                    org_id = _resolve_whatsapp_organization_id(db, metadata)
                    for message in value.get("messages", []):
                        sender_id = message.get("from")
                        text = message.get("text", {}).get("body", "")
                        interactive = message.get("interactive", {})
                        
                        interactive_id = None
                        if interactive:
                            if interactive.get("type") == "button_reply":
                                interactive_id = interactive.get("button_reply", {}).get("id")
                            elif interactive.get("type") == "list_reply":
                                interactive_id = interactive.get("list_reply", {}).get("id")

                        BotEngine.process_message(
                            db=db,
                            organization_id=org_id,
                            channel="whatsapp",
                            sender_id=sender_id,
                            text=text,
                            interactive_id=interactive_id
                        )

        # 2. Messenger / Instagram Parser
        elif body.get("object") == "page" or body.get("object") == "instagram":
             for entry in body.get("entry", []):
                for messaging in entry.get("messaging", []):
                    sender_id = messaging.get("sender", {}).get("id")
                    message = messaging.get("message", {})
                    text = message.get("text", "")
                    
                    BotEngine.process_message(
                        db=db,
                        organization_id=settings.DEFAULT_BOT_ORGANIZATION_ID,
                        channel="messenger" if body.get("object") == "page" else "instagram",
                        sender_id=sender_id,
                        text=text
                    )
    except Exception:
        logger.exception("Error parsing Meta payload")
    finally:
        db.close()

