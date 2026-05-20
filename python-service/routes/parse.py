from fastapi import APIRouter, Body
from services.groqService import parse_order_text
from schemas.orderSchema import ParseResult

router = APIRouter(tags=['parse'])


@router.post('/parse-order', response_model=ParseResult)
def parse_order(payload: dict = Body(default={})): 
    text = payload.get("text", "")
    result = parse_order_text(text)
    return result
