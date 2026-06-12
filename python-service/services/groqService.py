import os
import json
from groq import Groq
from schemas.orderSchema import ParseResult
from dotenv import load_dotenv

load_dotenv()

# Initialize Groq client
# Note: In production, ensure GROQ_API_KEY is set in the environment
api_key = os.getenv("GROQ_API_KEY")
client = None
if api_key:
    try:
        client = Groq(api_key=api_key)
    except Exception as e:
        print(f"Error initializing Groq client: {e}")
else:
    print("WARNING: GROQ_API_KEY environment variable is not set. Order parsing will use fallback mode.")

SYSTEM_PROMPT = """
You are an expert bilingual order parsing assistant for a grocery shop called 'ShopBot' in India.
Your task is to convert natural language customer messages (written in English, Hindi, or Hinglish) into a standardized structured JSON format.

RULES:
1. DETECT INTENT:
   - Determine if the user message is a grocery 'order' or a 'non_order' (e.g., greetings, general inquiries, spam, or chit-chat like "hi", "how are you", "is my order ready?").
   - If intent is 'non_order', set "intent" to "non_order" and keep the "items" list empty.

2. EXTRACT ITEMS (Only for 'order' intent):
   - For each grocery item, extract the item name, quantity (qty), and unit of measurement.
   - Standardize item names to clean, readable English singular nouns where possible (e.g., "atta" -> "atta", "tel" / "tel" -> "oil", "doodh" -> "milk", "aloo" -> "potato").
   - Extract numerical quantities. Convert word numbers to digits (e.g., "ek" -> 1, "do" -> 2, "teen" -> 3, "aadha" -> 0.5, "half" -> 0.5, "one" -> 1, "two" -> 2).
   - Standardize units to standard terms: "kg" (for kilograms/kilo), "gm" (for grams/gm/g), "litre" (for litres/liters/l/ltr), "packet" (for packets/pkt), "piece" (for pieces/pcs/single items).
   - If no unit is specified (e.g., "1 oil", "3 bread"), default the unit to "piece" or the most appropriate retail package unit (e.g. "packet" or "piece").

3. HINGLISH & BILINGUAL HANDLING EXAMPLES:
   - "2kg atta and 1 oil" -> intent: "order", items: [{"item": "atta", "qty": 2.0, "unit": "kg"}, {"item": "oil", "qty": 1.0, "unit": "piece"}]
   - "500gm daal" -> intent: "order", items: [{"item": "daal", "qty": 500.0, "unit": "gm"}]
   - "ek litre doodh" -> intent: "order", items: [{"item": "milk", "qty": 1.0, "unit": "litre"}]
   - "aadha kg daal" -> intent: "order", items: [{"item": "daal", "qty": 0.5, "unit": "kg"}]
   - "hi how are you" -> intent: "non_order", items: []

4. JSON OUTPUT FORMAT:
   - Return ONLY a valid JSON object.
   - Do NOT include any explanations, preamble, markdown formatting, or trailing text.

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

def clean_and_validate_json(content: str) -> ParseResult:
    """
    Cleans markdown code fences and validates string content against the Pydantic ParseResult schema.
    """
    content = content.strip()
    if content.startswith("```"):
        lines = content.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        content = "\n".join(lines).strip()
        
    data = json.loads(content)
    return ParseResult(**data)


def parse_order_regex_fallback(text: str) -> ParseResult:
    """
    Offline local regex segment-based parser for tertiary fallback.
    """
    lower_text = text.lower()
    items = []
    
    import re
    segments = lower_text.replace("and", ",").split(",")
    for segment in segments:
        segment = segment.strip()
        if not segment:
            continue
        # Match numbers (digits or basic Hinglish numbers)
        num_match = re.search(r"(\d+(\.\d+)?)", segment)
        qty = 1.0
        if num_match:
            qty = float(num_match.group(1))
        elif "ek" in segment or "one" in segment:
            qty = 1.0
        elif "do" in segment or "two" in segment:
            qty = 2.0
        elif "teen" in segment or "three" in segment:
            qty = 3.0
        elif "aadha" in segment or "half" in segment:
            qty = 0.5

        # Detect unit
        unit = "piece"
        if "kg" in segment or "kilo" in segment:
            unit = "kg"
        elif "gm" in segment or "gram" in segment or re.search(r"\d+g\b", segment) or re.search(r"\d+\s*g\b", segment):
            unit = "gm"
        elif "litre" in segment or "liter" in segment or "ltr" in segment or " l " in f" {segment} ":
            unit = "litre"
        elif "packet" in segment or "pkt" in segment:
            unit = "packet"

        # Match items
        if "atta" in segment:
            items.append({"item": "atta", "qty": qty, "unit": "kg" if unit == "piece" else unit})
        elif "oil" in segment or "tel" in segment:
            items.append({"item": "oil", "qty": qty, "unit": "piece" if unit == "piece" else unit})
        elif "daal" in segment or "dal" in segment:
            items.append({"item": "daal", "qty": qty, "unit": "kg" if unit == "piece" else unit})
        elif "doodh" in segment or "milk" in segment:
            items.append({"item": "milk", "qty": qty, "unit": "litre" if unit == "piece" else unit})
        elif "aloo" in segment or "potato" in segment:
            items.append({"item": "potato", "qty": qty, "unit": "kg" if unit == "piece" else unit})
        elif "sugar" in segment or "chini" in segment:
            items.append({"item": "sugar", "qty": qty, "unit": "kg" if unit == "piece" else unit})

    intent = "order" if items else "non_order"
    result = ParseResult(intent=intent, items=items)
    print(f"[llmService] Local Regex Fallback Output: {result}")
    return result


def parse_order_text(text: str) -> ParseResult:
    """
    Parses natural language text into a structured order using a robust three-tier failover pipeline:
    Tier 1: Groq LLaMA 3 (Fast, low-latency primary)
    Tier 2: Sarvam AI 30B (Indic-centric cloud API fallback)
    Tier 3: Local Regex Heuristics (100% offline fallback)
    """
    try:
        if not text or not text.strip():
            return ParseResult(intent="non_order", items=[])

        print(f"[llmService] Incoming parsing request: '{text}'")

        # -------------------------------------------------------------
        # TIER 1: Groq LLaMA 3 (Primary API)
        # -------------------------------------------------------------
        if client:
            try:
                print("[llmService] Attempting Tier 1: Groq LLaMA 3...")
                response = client.chat.completions.create(
                    model="llama3-8b-8192",
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": text}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0,
                    timeout=3.0,  # Fail fast if Groq hangs!
                )
                content = response.choices[0].message.content.strip()
                print(f"[llmService] Tier 1 (Groq) Raw response: {content}")
                
                result = clean_and_validate_json(content)
                print(f"[llmService] Tier 1 (Groq) Succeeded!")
                return result
            except Exception as e:
                print(f"[llmService] Tier 1 (Groq) failed: {e}. Trying Tier 2 (Sarvam)...")

        # -------------------------------------------------------------
        # TIER 2: Sarvam AI Indic LLM (Secondary API Fallover)
        # -------------------------------------------------------------
        sarvam_api_key = os.getenv("SARVAM_API_KEY")
        if sarvam_api_key:
            try:
                print("[llmService] Attempting Tier 2: Sarvam AI...")
                import requests
                # Standard Sarvam AI Chat Completion API endpoint
                url = "https://api.sarvam.ai/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {sarvam_api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "sarvam-30b",  # Can be configured to "sarvam-30b" or "sarvam-105b"
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": text}
                    ],
                    "temperature": 0.0,
                    "response_format": {"type": "json_object"}
                }
                response = requests.post(url, json=payload, headers=headers, timeout=4.0)
                if response.status_code == 200:
                    content = response.json()["choices"][0]["message"]["content"].strip()
                    print(f"[llmService] Tier 2 (Sarvam) Raw response: {content}")
                    
                    result = clean_and_validate_json(content)
                    print(f"[llmService] Tier 2 (Sarvam) Succeeded!")
                    return result
                else:
                    print(f"[llmService] Tier 2 (Sarvam) HTTP error code: {response.status_code}")
            except Exception as e:
                print(f"[llmService] Tier 2 (Sarvam) failed: {e}. Falling back to Tier 3 (Regex)...")

        # -------------------------------------------------------------
        # TIER 3: Local Offline Regex Heuristics (Tertiary Local Fallback)
        # -------------------------------------------------------------
        print("[llmService] Attempting Tier 3: Local Regex Fallback...")
        return parse_order_regex_fallback(text)

    except Exception as e:
        print(f"[llmService] Critical pipeline crash: {e}")
        return ParseResult(intent="non_order", items=[])
