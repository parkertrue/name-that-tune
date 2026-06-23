from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_serializer,
    field_validator
)
from datetime import datetime
from app.utils.sanitizer import InputSanitizer

DECK_NAME_MAX_LENGTH = 100


class DeckCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=DECK_NAME_MAX_LENGTH)

    model_config = ConfigDict(extra="forbid")

    @field_validator('name')
    @classmethod
    def sanitize_name(cls, v):
        sanitized = InputSanitizer.sanitize_text(v, max_length=DECK_NAME_MAX_LENGTH)
        if not sanitized:
            raise ValueError('Deck name cannot be empty after sanitization')
        return sanitized


class DeckResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    total: int = 0
    mastered: int = 0
    active: int = 0

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('created_at')
    def serialize_dt(self, dt: datetime, _info):
        return dt.isoformat()
