"""
MetaClient — Cliente HTTP para enviar mensajes a Meta Graph API.
Soporta WhatsApp, Facebook Messenger e Instagram DM.
"""
import logging
import os
from typing import Optional

import requests

logger = logging.getLogger(__name__)

META_GRAPH_URL = "https://graph.facebook.com/v19.0"
_ACCESS_TOKEN: Optional[str] = None


def _get_token() -> str:
    global _ACCESS_TOKEN
    if not _ACCESS_TOKEN:
        from app.core.config import settings
        _ACCESS_TOKEN = settings.META_ACCESS_TOKEN or ""
    return _ACCESS_TOKEN


def _send(url: str, payload: dict) -> bool:
    token = _get_token()
    if not token:
        logger.error("META_ACCESS_TOKEN no configurado. Mensaje no enviado.")
        return False
    try:
        resp = requests.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        if resp.status_code not in (200, 201):
            logger.error(
                "Meta API error %s: %s",
                resp.status_code,
                resp.text[:300],
            )
            return False
        return True
    except requests.exceptions.Timeout:
        logger.error("Timeout al enviar mensaje a Meta API.")
        return False
    except requests.exceptions.RequestException as exc:
        logger.error("Error de red al enviar mensaje a Meta API: %s", exc)
        return False


def send_whatsapp_message(phone_number_id: str, payload: dict) -> bool:
    url = f"{META_GRAPH_URL}/{phone_number_id}/messages"
    return _send(url, payload)


def send_messenger_message(payload: dict) -> bool:
    url = f"{META_GRAPH_URL}/me/messages"
    return _send(url, payload)


def send_instagram_message(payload: dict) -> bool:
    url = f"{META_GRAPH_URL}/me/messages"
    return _send(url, payload)


def dispatch_outbound_messages(
    outbound_messages: list,
    channel: str,
    phone_number_id: Optional[str] = None,
) -> None:
    """
    Despacha todos los mensajes salientes generados por BotEngine a Meta.
    Cada mensaje tiene la forma: {"action": "SEND_TEXT|SEND_MENU|SEND_BUTTONS", "payload": {...}}
    """
    for msg in outbound_messages:
        payload = msg.get("payload", {})
        if not payload:
            continue

        try:
            if channel == "whatsapp":
                if not phone_number_id:
                    logger.error("dispatch: phone_number_id requerido para WhatsApp.")
                    continue
                send_whatsapp_message(phone_number_id, payload)
            elif channel == "messenger":
                send_messenger_message(payload)
            elif channel == "instagram":
                send_instagram_message(payload)
            else:
                logger.warning("dispatch: canal desconocido '%s'.", channel)
        except Exception:
            logger.exception("dispatch: error inesperado enviando mensaje.")
