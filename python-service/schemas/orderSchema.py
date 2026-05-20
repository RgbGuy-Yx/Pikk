from pydantic import BaseModel, Field
from typing import List, Optional

class OrderItem(BaseModel):
    item: str = Field(..., description="The name of the item being ordered")
    qty: float = Field(..., description="The quantity of the item")
    unit: Optional[str] = Field(default="piece", description="The unit of measurement (e.g., kg, litre, packet)")

class ParseResult(BaseModel):
    items: List[OrderItem] = Field(default_factory=list, description="List of items parsed from the order")
    intent: str = Field(..., description="The detected intent of the message: 'order' or 'non_order'")
