"""
MetaClient — Cliente HTTP para enviar mensajes a Meta Graph API.
Soporta WhatsApp, Facebook Messenger e Instagram DM.

Tokens por canal:
  - WhatsApp: usa META_WA_TOKEN si está definido, sino cae a META_ACCESS_TOKEN
  - Messenger/Instagram: usa META_ACCESS_TOKEN (Page Access Token)
"""
import logging

import requests

logger = logging.getLogger(__name__)

META_GRAPH_URL = "https://graph.facebook.com/v19.0"

# Cache de tokens para evitar importar settings en cada llamada
_WA_TOKEN: str | None = None
_MESSENGER_TOKEN: str | None = None


def _get_wa_token() -> str:
    """Token para WhatsApp Business API."""
    global _WA_TOKEN
    if not _WA_TOKEN:
        from app.core.config import settings
        # Preferir META_WA_TOKEN; si no está, usar META_ACCESS_TOKEN como fallback
        _WA_TOKEN = (settings.META_WA_TOKEN or settings.META_ACCESS_TOKEN or "").strip()
    return _WA_TOKEN


def _get_messenger_token() -> str:
    """Token para Messenger/Instagram (Page Access Token)."""
    global _MESSENGER_TOKEN
    if not _MESSENGER_TOKEN:
        from app.core.config import settings
        _MESSENGER_TOKEN = (settings.META_ACCESS_TOKEN or "").strip()
    return _MESSENGER_TOKEN


def _send(url: str, payload: dict, token: str) -> bool:
    if not token:
        logger.error("Token de Meta no configurado. Mensaje no enviado. URL: %s", url)
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
    return _send(url, payload, _get_wa_token())


def send_messenger_message(payload: dict) -> bool:
    url = f"{META_GRAPH_URL}/me/messages"
    return _send(url, payload, _get_messenger_token())


def send_instagram_message(payload: dict) -> bool:
    url = f"{META_GRAPH_URL}/me/messages"
    return _send(url, payload, _get_messenger_token())


def dispatch_outbound_messages(
    outbound_messages: list,
    channel: str,
    phone_number_id: str | None = None,
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
