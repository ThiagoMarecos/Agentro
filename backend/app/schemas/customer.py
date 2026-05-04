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


class CreateCustomerRequest(BaseModel):
    """Para crear cliente rápido desde el POS o el admin."""
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    email: str | None = None  # opcional — si no viene, generamos uno placeholder
    document: str | None = None  # cédula / RUC / DNI / CUIT (se guarda en notes si el modelo no tiene campo)


class UpdateCustomerRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    email: str | None = None
