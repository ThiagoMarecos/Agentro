"""
Schemas de clientes.
"""

from pydantic import BaseModel


class CustomerResponse(BaseModel):
    id: str
    store_id: str
    email: str
    first_name: str | None
    last_name: str | None
    phone: str | None

    class Config:
        from_attributes = True
