from fastapi import APIRouter, Depends, BackgroundTasks, Request, Query, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.db.session import get_db
from app.core.bot.engine import BotEngine
from app.core.config import settings
import hmac
import hashlib
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class MockMetaPayload(BaseModel):
    channel: str # whatsapp, messenger
    channel_user_id: str
    message: str 
    # Optional field to simulate interactive button/list clicks
    interactive_id: str = None 
    org_id: int = 1

@router.post("/mock")
def mock_webhook_receive(payload: MockMetaPayload, db: Session = Depends(get_db)):
    """
    Simulates receiving a payload from Meta APIs without needing ngrok or internet connection.
    """
    
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
async def receive_meta_event(request: Request, bg_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Receives real events from Meta (WhatsApp, IG, Messenger).
    Extracts data and processes it asynchronously after validating signature.
    """
    # 1. Signature Validation (X-Hub-Signature-256)
    if settings.META_APP_SECRET:
        signature = request.headers.get("X-Hub-Signature-256")
        if not signature:
            raise HTTPException(status_code=403, detail="Missing signature header")
        
        body_bytes = await request.body()
        expected_sig = hmac.new(
            settings.META_APP_SECRET.encode(),
            body_bytes,
            hashlib.sha256
        ).hexdigest()
        
        # Format is 'sha256=HEX_SIG'
        if signature.replace("sha256=", "") != expected_sig:
            raise HTTPException(status_code=403, detail="Invalid signature")
        
        body = await request.json() # Already bytes consumed, but FastAPI handles JSON re-parse
    else:
        # Skip validation if secret is not set (not recommended for production)
        body = await request.json()
    
    # Meta expects immediate 200 OK
    bg_tasks.add_task(process_meta_payload, body, db)
    
    return {"status": "EVENT_RECEIVED"}

def process_meta_payload(body: dict, db: Session):
    """
    Parser logic for the complex Meta JSON payloads
    """
    try:
        # 1. WhatsApp Parser
        if body.get("object") == "whatsapp_business_account":
            for entry in body.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})
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

                        # We assume org_id=1 for this MVP or resolve from WhatsApp Business ID
                        BotEngine.process_message(
                            db=db,
                            organization_id=1,
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
                    
                    # We assume org_id=1
                    BotEngine.process_message(
                        db=db,
                        organization_id=1,
                        channel="messenger" if body.get("object") == "page" else "instagram",
                        sender_id=sender_id,
                        text=text
                    )
    except Exception:
        logger.exception("Error parsing Meta payload")

