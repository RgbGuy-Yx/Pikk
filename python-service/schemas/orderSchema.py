from pydantic import BaseModel, Field
from typing import List, Optional


class OrderItem(BaseModel):
    item: str = Field(..., description="The name of the item being ordered")
    qty: float = Field(..., description="The quantity of the item")
    unit: Optional[str] = Field(default="piece", description="The unit of measurement (e.g., kg, litre, piece, packet)")


class ChatResponse(BaseModel):
    reply: str = Field(..., description="Natural language response from the bot")
    intent: str = Field(default="greeting", description="place_order, product_query, order_status, faq, or greeting")
    items: Optional[List[OrderItem]] = Field(default_factory=list, description="Items for place_order intent")
    query: Optional[str] = Field(None, description="Product name or question topic")
    original_text: Optional[str] = Field(None, description="Original user input before translation")
    normalized_text: Optional[str] = Field(None, description="English text after Sarvam translation")
