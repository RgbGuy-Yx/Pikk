import os
import json
from groq import Groq
from schemas.orderSchema import ParseResult
from dotenv import load_dotenv

load_dotenv()

# Initialize Groq client
# Note: In production, ensure GROQ_API_KEY is set in the environment
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_PROMPT = """
You are an expert order parsing assistant for a grocery shop called 'ShopBot'.
Your task is to convert natural language messages into a structured JSON format.

RULES:
1. Detect if the user message is an 'order' or a 'non_order' (like greetings, general questions, or chat).
2. If it's an 'order':
   - Extract each item, its quantity, and unit.
   - If unit is not mentioned, use 'piece'.
   - Handle Hinglish (e.g., '2 kilo atta', 'ek litre tel').
   - Handle abbreviations (e.g., 'kg' for kilogram, 'ltr' for litre).
   - If multiple items are present, include them all in the 'items' list.
3. If it's a 'non_order':
   - Set intent to 'non_order'.
   - Leave the 'items' list empty.
4. ALWAYS return ONLY valid JSON.
5. Do NOT include any explanations or extra text.

OUTPUT FORMAT:
{
  "intent": "order" | "non_order",
  "items": [
    {
      "item": "string",
      "qty": number,
      "unit": "string"
    }
  ]
}
"""

def parse_order_text(text: str) -> ParseResult:
    """
    Parses natural language text into a structured order using Groq LLaMA 3.
    """
    try:
        if not text or not text.strip():
            return ParseResult(intent="non_order", items=[])

        response = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text}
            ],
            response_format={"type": "json_object"},
            temperature=0,
        )

        content = response.choices[0].message.content
        data = json.loads(content)
        
        # Validate with Pydantic
        return ParseResult(**data)
    
    except Exception as e:
        # Log the error (in a real app, use a logger)
        print(f"Error parsing order with Groq: {e}")
        # Return a safe fallback to prevent server crashes
        return ParseResult(intent="non_order", items=[])
