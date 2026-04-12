"""
Schemas de settings.
"""

from pydantic import BaseModel


class SettingUpdate(BaseModel):
    key: str
    value: str | None


class SettingResponse(BaseModel):
    key: str
    value: str | None

    class Config:
        from_attributes = True
