from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.session import get_db
from app.core.bot.engine import BotEngine

router = APIRouter()

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
    Passes data exactly as if it were extracted from the complex Meta JSON.
    """
    
    # Run the bot engine synchronously for testing (in production we might task it)
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
