"""
Webhook omnicanal para Meta Cloud API.
Recibe eventos de WhatsApp, Facebook Messenger e Instagram DM en un único endpoint.
"""
import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.bot.engine import BotEngine
from app.core.bot.meta_client import dispatch_outbound_messages
from app.core.config import settings
from app.core.idempotency import claim_once
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
    interactive_id: str | None = None


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
        return PlainTextResponse(content=challenge, status_code=200)

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
@limiter.limit("30/minute")
def mock_bot_message(
    request: Request,
    payload: MockBotPayload,
    db: Session = Depends(get_db),
):
    """Endpoint público para el ChatSimulator (web/SDK).

    Procesa el mensaje contra el BotEngine sin requerir autenticación.
    Se controla por ENABLE_BOT_MOCK_ENDPOINT (por defecto True).
    Rate limit: 30 mensajes/minuto por IP — protege contra abuso de DeepSeek.
    """
    if not settings.ENABLE_BOT_MOCK_ENDPOINT:
        raise HTTPException(status_code=403, detail="Endpoint del chat público deshabilitado.")

    outbound = BotEngine.process_message(
        db=db,
        organization_id=payload.organization_id,
        channel=payload.channel,
        sender_id=payload.channel_user_id,
        text=payload.text,
        interactive_id=payload.interactive_id,
    )
    return {"outbound_messages": outbound}


def _resolve_org_by_whatsapp(db: Session, phone_number_id: str | None) -> int | None:
    if not phone_number_id:
        return None
    pn = str(phone_number_id).strip()
    org = db.query(models.Organization).filter(
        models.Organization.whatsapp_phone_number_id == pn
    ).first()
    if not org:
        logger.warning("WhatsApp phone_number_id=%s sin organización vinculada.", pn)
    return org.id if org else None


def _resolve_org_by_page(db: Session, page_id: str | None, channel: str) -> int | None:
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
                        msg_id = msg.get("id")
                        if msg_id and not claim_once(f"meta:wa:{msg_id}"):
                            logger.info("Webhook duplicado WA ignorado: %s", msg_id)
                            continue

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

                    msg_id = (event.get("message") or {}).get("mid") or (
                        event.get("postback") or {}
                    ).get("mid")
                    if msg_id and not claim_once(f"meta:fb:{msg_id}"):
                        logger.info("Webhook duplicado FB ignorado: %s", msg_id)
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

                    msg_id = (event.get("message") or {}).get("mid") or (
                        event.get("postback") or {}
                    ).get("mid")
                    if msg_id and not claim_once(f"meta:ig:{msg_id}"):
                        logger.info("Webhook duplicado IG ignorado: %s", msg_id)
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


# ── Messenger Profile Setup ───────────────────────────────────────────────────
@router.post("/setup-messenger-profile", summary="Configura Get Started + Greeting en Messenger")
def setup_messenger_profile():
    """
    Configura el Messenger Profile de la página conectada:
      - Botón 'Empezar' (Get Started) con payload GET_STARTED
      - Texto de bienvenida personalizado en español

    Requiere META_FB_TOKEN con permisos pages_messaging y pages_show_list.
    Llamar una vez después de cambiar el Page Access Token o al configurar una nueva página.
    """
    import requests as _req

    token = (settings.META_FB_TOKEN or settings.META_ACCESS_TOKEN or "").strip()
    if not token:
        raise HTTPException(
            status_code=503,
            detail="META_FB_TOKEN no configurado. Agrega el Page Access Token en las variables de entorno."
        )

    payload = {
        "get_started": {"payload": "GET_STARTED"},
        "greeting": [
            {
                "locale": "default",
                "text": "¡Hola {{user_first_name}}! 👋 Bienvenido a Horno 74. Presiona Empezar para ver nuestro menú y hacer tu pedido."
            },
            {
                "locale": "es_LA",
                "text": "¡Hola {{user_first_name}}! 👋 Bienvenido a Horno 74. Presiona Empezar para ver nuestro menú y hacer tu pedido."
            }
        ]
    }

    try:
        resp = _req.post(
            "https://graph.facebook.com/v19.0/me/messenger_profile",
            params={"access_token": token},
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
    except _req.exceptions.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Error de red al contactar Meta API: {exc}")

    if resp.status_code != 200:
        logger.error("setup_messenger_profile: Meta API %s: %s", resp.status_code, resp.text[:300])
        raise HTTPException(
            status_code=resp.status_code,
            detail=f"Meta API respondió {resp.status_code}: {resp.text[:300]}"
        )

    data = resp.json()
    if data.get("result") != "success":
        raise HTTPException(status_code=400, detail=f"Meta no confirmó éxito: {data}")

    logger.info("Messenger Profile configurado correctamente (Get Started + Greeting).")
    return {
        "status": "ok",
        "message": "Messenger Profile configurado: botón Empezar + texto de bienvenida activados.",
        "meta_response": data,
    }
