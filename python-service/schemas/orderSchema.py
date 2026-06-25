from pydantic import BaseModel, Field
from typing import List, Optional

class OrderItem(BaseModel):
    item: str = Field(..., description="The name of the item being ordered")
    qty: float = Field(..., description="The quantity of the item")
    unit: Optional[str] = Field(default="piece", description="The unit of measurement (e.g., kg, litre, packet)")

class IntentData(BaseModel):
    items: Optional[List[OrderItem]] = Field(default_factory=list, description="List of items for 'place_order' intent")
    query: Optional[str] = Field(None, description="The product name for 'product_query' or question for 'faq'")

class IntentResult(BaseModel):
    intent: str = Field(..., description="Must be one of: place_order, product_query, order_status, faq, greeting")
    data: IntentData = Field(default_factory=IntentData)
