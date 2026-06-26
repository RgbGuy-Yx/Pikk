import logging
from fastapi import APIRouter, Body
from services.sarvamService import translate_to_english
from services.groqService import chat

logger = logging.getLogger("parseRoute")
logger.setLevel(logging.INFO)

router = APIRouter(tags=['parse'])


@router.post('/intent')
def parse_intent(payload: dict = Body(default={})):
    raw_text = payload.get("text", "")
    phone = payload.get("phone", "unknown")

    logger.info(f"[parse] Phone: {phone} | Raw text: '{raw_text}'")

    # Step 1: Translate to English via Sarvam
    normalized = translate_to_english(raw_text)
    logger.info(f"[parse] Phone: {phone} | Translated: '{normalized}'")

    # Step 2: Send to Groq (with tool calling)
    result = chat(normalized, phone)
    result["original_text"] = raw_text
    result["normalized_text"] = normalized

    logger.info(f"[parse] Phone: {phone} | Intent: {result['intent']} | Reply: '{result['reply'][:80]}...'")
    return result
