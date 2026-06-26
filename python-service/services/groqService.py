import os
import json
import logging
import requests as http_requests
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("groqService")
logger.setLevel(logging.INFO)

api_key = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=api_key) if api_key else None
NODE_SERVICE_URL = os.getenv("NODE_SERVICE_URL", "http://localhost:3001")

# ---------------------------------------------------------------------------
# System prompt — friendly grocery shop assistant
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are pikk, a friendly and helpful AI assistant for "pikk" — your favourite neighbourhood kirana store! We deliver fresh groceries, daily essentials, and more right to your doorstep.

You help customers over WhatsApp with:

1. Placing grocery orders
2. Checking product availability and prices
3. Tracking order status
4. General store questions (timings, delivery, etc.)

## How you work
- When a customer asks about a product (availability, price, stock), you have a `check_inventory` tool. Call it to look up real-time product info from the store's inventory. Always use the tool before answering product questions.
- When a customer asks "what do you have", "what can I order", "what items are available", or any similar query about available products, you MUST call the `check_inventory` tool first. Use an empty string or a broad keyword like "all" to fetch the full product list. Never make up or list items from memory.
- When a customer wants to place an order, extract items with quantities and units from their message.
- You can handle English, Hindi, and Hinglish messages. Always respond in English.

## Welcome Message Format
When greeting a customer, respond with a well-structured message in this EXACT format (keep the line breaks and bold markers):

Hey there! Welcome to *pikk* 🛒

Your favourite neighbourhood kirana store! 🏪

Here's what I can help you with:
🛒 *Place an Order* — Just tell me what you need
💰 *Check Prices* — Ask me about any product
📦 *Track Orders* — I'll update your order status
❓ *Ask Anything* — Store info, delivery, timings

*What would you like to do today?* 😊

## Common Indian grocery terms
- atta = wheat flour | chini = sugar | tel = cooking oil | daal = lentils
- doodh = milk | aloo = potato | pyaaz = onion | tamatar = tomato | chawal = rice
- namak = salt | paneer = cottage cheese | ghee = clarified butter
- chai = tea | besan = gram flour | maida = refined flour
- rava = semolina | poha = flattened rice | haldi = turmeric

## Rules
- Be warm, helpful, and concise. Use emojis sparingly and only where they add value.
- WhatsApp messages should be short and easy to read.
- If a customer says "I want to order" or "mujhe order karna hai" without listing items, ask them what they'd like.
- If a customer lists items (with or without saying "order"), treat it as a place_order intent.
- For order status, you need the customer's phone number (it's provided in the context).
- Never make up product prices or availability. Always use the check_inventory tool.
- When placing an order, confirm the items and total before the backend processes it.
- When greeting a customer, use the Welcome Message Format above.
- When asked about available items, call check_inventory first and present the results.

## Output format
Always respond with a JSON object containing these fields:
- "reply": your natural language response to the customer
- "intent": one of "place_order", "product_query", "order_status", "faq", "greeting"
- "items": array of {"item": "product_name", "qty": number, "unit": "kg|litre|piece|packet|gm"} if ordering, else []
- "query": product name or question topic if relevant, else ""
"""

# ---------------------------------------------------------------------------
# Tools Groq can call
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "check_inventory",
            "description": "Look up products in the store inventory. Returns product name, price, stock, and unit. Pass an empty string or 'all' to get the full list of available items.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {
                        "type": "string",
                        "description": "Product name to search for (e.g., 'atta', 'sugar', 'milk'). Use empty string or 'all' to list all available items."
                    }
                },
                "required": ["product_name"]
            }
        }
    }
]


def _execute_tool(tool_name: str, tool_args: dict) -> str:
    """Execute a tool call by hitting the Node.js backend."""
    if tool_name == "check_inventory":
        product_name = tool_args.get("product_name", "")
        logger.info(f"[groqService] Tool call: check_inventory('{product_name}')")
        try:
            resp = http_requests.get(f"{NODE_SERVICE_URL}/inventory", timeout=5)
            if resp.status_code == 200:
                products = resp.json()
                # If query is empty or broad, return all items
                if not product_name or product_name.lower() in ("all", "list", "items", "products", "everything"):
                    result = products
                else:
                    # Filter by name match (case-insensitive substring)
                    matches = [
                        p for p in products
                        if product_name.lower() in p.get("name", "").lower()
                        or p.get("name", "").lower() in product_name.lower()
                    ]
                    if not matches:
                        # Also try fuzzy: split words and check each
                        words = product_name.lower().split()
                        matches = [
                            p for p in products
                            if any(w in p.get("name", "").lower() for w in words)
                        ]
                    result = matches[:5] if matches else []
                logger.info(f"[groqService] Inventory result: {len(result)} matches for '{product_name}'")
                return json.dumps(result)
            else:
                logger.error(f"[groqService] Inventory API returned {resp.status_code}")
                return json.dumps([])
        except Exception as e:
            logger.error(f"[groqService] Inventory API error: {e}")
            return json.dumps([])

    logger.warning(f"[groqService] Unknown tool: {tool_name}")
    return json.dumps([])


def _clean_json(text: str) -> str:
    """Strip markdown code fences if present."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def chat(text: str, phone: str = "unknown") -> dict:
    """
    Main entry point. Translates are already done by sarvam before calling this.
    Sends the English text to Groq (with tool calling), returns structured response.
    """
    if not text or not text.strip():
        return {
            "reply": "Hey there! Welcome to *pikk* 🛒\n\nYour favourite neighbourhood kirana store! 🏪\n\nHere's what I can help you with:\n🛒 *Place an Order* — Just tell me what you need\n💰 *Check Prices* — Ask me about any product\n📦 *Track Orders* — I'll update your order status\n❓ *Ask Anything* — Store info, delivery, timings\n\n*What would you like to do today?* 😊",
            "intent": "greeting",
            "items": [],
            "query": "",
            "original_text": text,
            "normalized_text": text,
        }

    if not groq_client:
        logger.warning("[groqService] No Groq client, returning fallback")
        return {
            "reply": "Sorry, I'm having trouble right now. Please try again later.",
            "intent": "greeting",
            "items": [],
            "query": "",
            "original_text": text,
            "normalized_text": text,
        }

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": text},
    ]

    try:
        logger.info(f"[groqService] Sending to Groq: '{text}' (phone: {phone})")

        # First call — may trigger a tool call
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.3,
            timeout=10.0,
        )

        msg = response.choices[0].message

        # Handle tool calls
        if msg.tool_calls:
            logger.info(f"[groqService] Groq requested {len(msg.tool_calls)} tool call(s)")
            messages.append(msg)

            for tc in msg.tool_calls:
                fn_name = tc.function.name
                fn_args = json.loads(tc.function.arguments)
                tool_result = _execute_tool(fn_name, fn_args)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": tool_result,
                })

            # Second call with tool results — get final structured response
            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.3,
                timeout=10.0,
            )
            content = _clean_json(response.choices[0].message.content)
            logger.info(f"[groqService] Groq final response (after tools): {content}")
        else:
            # No tool call — Groq responded directly. Ask it to structure the output.
            messages.append({"role": "assistant", "content": msg.content or ""})
            messages.append({
                "role": "user",
                "content": (
                    "Now format your response as JSON with these fields:\n"
                    '- "reply": your natural language response (keep it as-is)\n'
                    '- "intent": one of "place_order", "product_query", "order_status", "faq", "greeting"\n'
                    '- "items": array of {item, qty, unit} if customer wants to order, else []\n'
                    '- "query": product name or question topic if relevant, else ""\n'
                    "Return ONLY valid JSON, no other text."
                ),
            })

            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.3,
                timeout=10.0,
            )
            content = _clean_json(response.choices[0].message.content)
            logger.info(f"[groqService] Groq structured response: {content}")

        # Parse final JSON
        data = json.loads(content)
        return {
            "reply": data.get("reply", ""),
            "intent": data.get("intent", "greeting"),
            "items": data.get("items", []),
            "query": data.get("query", ""),
            "original_text": text,
            "normalized_text": text,
        }

    except Exception as e:
        logger.error(f"[groqService] Error: {e}")
        return {
            "reply": "Sorry, I had trouble understanding that. Could you please try again?",
            "intent": "greeting",
            "items": [],
            "query": "",
            "original_text": text,
            "normalized_text": text,
        }
