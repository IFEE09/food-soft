class WhatsAppAdapter:
    """Formatter for Meta WhatsApp Cloud API messages."""

    @staticmethod
    def format_text(to: str, text: str) -> dict:
        return {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {"preview_url": False, "body": text}
        }

    @staticmethod
    def format_list(to: str, header_text: str, body_text: str, button_text: str, sections: list) -> dict:
        """
        sections must be a list of dicts: {"title": "Menu Category", "rows": [{"id": "xyz", "title": "Pizza", "description": "$12"}]}
        """
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
                    "button": button_text[:20],  # max 20 chars
                    "sections": sections
                }
            }
        }

    @staticmethod
    def format_buttons(to: str, body_text: str, buttons: list) -> dict:
        """
        buttons must be a list of dicts: {"id": "btn_1", "title": "Accept"} -- max 3 buttons
        """
        action_buttons = []
        for btn in buttons[:3]:
            action_buttons.append({
                "type": "reply",
                "reply": {
                    "id": btn["id"],
                    "title": btn["title"][:20]  # max 20 chars
                }
            })

        return {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body_text},
                "action": {
                    "buttons": action_buttons
                }
            }
        }

class MessengerAdapter:
    """Mock for Facebook Messenger Adapter (Placeholder for Phase 5)"""
    @staticmethod
    def format_text(to: str, text: str) -> dict:
        # Generic Template logic would go here
        return {"messaging_type": "RESPONSE", "recipient": {"id": to}, "message": {"text": text}}
