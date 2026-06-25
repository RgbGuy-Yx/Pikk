import os
import json
from groq import Groq
from schemas.orderSchema import IntentResult, IntentData
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=api_key) if api_key else None

INTENT_SYSTEM_PROMPT = """
You are an intent classifier and entity extractor for 'ShopBot', a grocery store WhatsApp bot.
Classify the user's message into exactly one of these intents:
- place_order: User wants to order groceries (e.g., "2kg atta and 1 oil").
- product_query: User asks if an item is available, its price, etc. (e.g., "Do you have atta?", "What is the price of milk?").
- order_status: User asks about their order (e.g., "Where is my order?", "Is my order ready?").
- faq: User asks general store questions (e.g., "What are your timings?", "Where is your shop?").
- greeting: User says hello or chit-chats (e.g., "Hello", "Hi").

Data extraction rules:
- For 'place_order', extract the items into a list with 'item', 'qty' (number), and 'unit' (kg, gm, litre, piece, packet).
- For 'product_query' or 'faq', extract the main topic/item into the 'query' field.
- For others, leave data empty.

Output strictly as JSON:
{
  "intent": "place_order" | "product_query" | "order_status" | "faq" | "greeting",
  "data": {
    "items": [{"item": "...", "qty": 1, "unit": "kg"}],
    "query": "..."
  }
}
"""

def clean_and_validate_intent_json(content: str) -> IntentResult:
    content = content.strip()
    if content.startswith("```"):
        lines = content.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        content = "\n".join(lines).strip()
    data = json.loads(content)
    return IntentResult(**data)

def route_intent(text: str) -> IntentResult:
    if not text or not text.strip():
        return IntentResult(intent="greeting", data=IntentData())
        
    try:
        response = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {"role": "system", "content": INTENT_SYSTEM_PROMPT},
                {"role": "user", "content": text}
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            timeout=5.0,
        )
        content = response.choices[0].message.content.strip()
        return clean_and_validate_intent_json(content)
    except Exception as e:
        print(f"[groqService] Error routing intent: {e}")
        return IntentResult(intent="greeting", data=IntentData())

