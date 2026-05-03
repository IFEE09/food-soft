"""
Adaptadores de mensajería para Meta Cloud API.

Cada adaptador formatea los payloads JSON que se envían a la Graph API
para su canal correspondiente:
  - WhatsAppAdapter   → WhatsApp Business Cloud API
  - MessengerAdapter  → Facebook Messenger (Page Messaging)
  - InstagramAdapter  → Instagram Direct Messages (Messaging API)
"""
from typing import Any, List


class WhatsAppAdapter:
    """Formateador para Meta WhatsApp Cloud API."""

    @staticmethod
    def format_text(to: str, text: str) -> dict:
        return {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {"preview_url": False, "body": text},
        }

    @staticmethod
    def format_list(
        to: str,
        header_text: str,
        body_text: str,
        button_text: str,
        sections: List[dict],
    ) -> dict:
        return {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "interactive",
            "interactive": {
                "type": "list",
                "header": {"type": "text", "text": header_text},
                "body": {"text": body_text},
                "action": {
                    "button": button_text[:20],
                    "sections": sections,
                },
            },
        }

    @staticmethod
    def format_buttons(to: str, body_text: str, buttons: List[dict]) -> dict:
        action_buttons = [
            {
                "type": "reply",
                "reply": {"id": btn["id"], "title": btn["title"][:20]},
            }
            for btn in buttons[:3]
        ]
        return {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body_text},
                "action": {"buttons": action_buttons},
            },
        }


class MessengerAdapter:
    """Formateador para Facebook Messenger (Page Messaging API)."""

    @staticmethod
    def format_text(to: str, text: str) -> dict:
        return {
            "messaging_type": "RESPONSE",
            "recipient": {"id": to},
            "message": {"text": text},
        }

    @staticmethod
    def format_quick_replies(to: str, text: str, buttons: List[dict]) -> dict:
        quick_replies = [
            {
                "content_type": "text",
                "title": btn["title"][:20],
                "payload": btn["id"],
            }
            for btn in buttons[:13]
        ]
        return {
            "messaging_type": "RESPONSE",
            "recipient": {"id": to},
            "message": {
                "text": text,
                "quick_replies": quick_replies,
            },
        }

    @staticmethod
    def format_generic_template(to: str, elements: List[dict]) -> dict:
        return {
            "messaging_type": "RESPONSE",
            "recipient": {"id": to},
            "message": {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "template_type": "generic",
                        "elements": elements[:10],
                    },
                }
            },
        }


class InstagramAdapter:
    """Formateador para Instagram Direct Messages (Messaging API)."""

    @staticmethod
    def format_text(to: str, text: str) -> dict:
        return {
            "recipient": {"id": to},
            "message": {"text": text},
        }

    @staticmethod
    def format_quick_replies(to: str, text: str, buttons: List[dict]) -> dict:
        quick_replies = [
            {
                "content_type": "text",
                "title": btn["title"][:20],
                "payload": btn["id"],
            }
            for btn in buttons[:13]
        ]
        return {
            "recipient": {"id": to},
            "message": {
                "text": text,
                "quick_replies": quick_replies,
            },
        }

    @staticmethod
    def format_generic_template(to: str, elements: List[dict]) -> dict:
        return {
            "recipient": {"id": to},
            "message": {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "template_type": "generic",
                        "elements": elements[:10],
                    },
                }
            },
        }
