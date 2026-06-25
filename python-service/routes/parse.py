from fastapi import APIRouter, Body
from services.groqService import route_intent
from schemas.orderSchema import IntentResult

router = APIRouter(tags=['parse'])

@router.post('/intent', response_model=IntentResult)
def parse_intent(payload: dict = Body(default={})): 
    text = payload.get("text", "")
    result = route_intent(text)
    return result
