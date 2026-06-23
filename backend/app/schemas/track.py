import re

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_validator
)
from app.utils.sanitizer import InputSanitizer

TITLE_MAX_LENGTH = 256
ARTIST_MAX_LENGTH = 256
SPOTIFY_ID_MAX_LENGTH = 64
MAX_ARTISTS = 16
MAX_IMPORT_TRACKS = 1000

# Spotify track IDs are 22-character base62 strings. Constraining to this
# charset prevents query/path injection into the embed iframe URL on the
# frontend (e.g. appending `?`/`#`/`&`/`/` to break out of the track path).
SPOTIFY_ID_PATTERN = re.compile(r'^[A-Za-z0-9]{22}$')


class TrackImportItem(BaseModel):
    spotify_id: str | None = Field(default=None, max_length=SPOTIFY_ID_MAX_LENGTH)
    title: str = Field(min_length=1, max_length=TITLE_MAX_LENGTH)
    artists: list[str] = Field(min_length=1, max_length=MAX_ARTISTS)

    model_config = ConfigDict(extra="forbid")

    @field_validator('title')
    @classmethod
    def sanitize_title(cls, v):
        sanitized = InputSanitizer.sanitize_text(v, max_length=TITLE_MAX_LENGTH)
        if not sanitized:
            raise ValueError('Track title cannot be empty after sanitization')
        return sanitized

    @field_validator('artists')
    @classmethod
    def sanitize_artists(cls, v):
        cleaned = [
            InputSanitizer.sanitize_text(a, max_length=ARTIST_MAX_LENGTH)
            for a in v
        ]
        cleaned = [a for a in cleaned if a]
        if not cleaned:
            raise ValueError('Track must have at least one artist')
        return cleaned

    @field_validator('spotify_id')
    @classmethod
    def sanitize_spotify_id(cls, v):
        if v is None:
            return None
        cleaned = InputSanitizer.sanitize_text(v, max_length=SPOTIFY_ID_MAX_LENGTH)
        if not cleaned:
            return None
        if not SPOTIFY_ID_PATTERN.match(cleaned):
            raise ValueError('Invalid Spotify track ID')
        return cleaned


class TrackBulkImportRequest(BaseModel):
    tracks: list[TrackImportItem] = Field(min_length=1, max_length=MAX_IMPORT_TRACKS)

    model_config = ConfigDict(extra="forbid")


class TrackResponse(BaseModel):
    id: int
    title: str
    artists: list[str]
    spotify_id: str | None
    ease_factor: float
    interval: int
    repetitions: int
    mastered: bool

    model_config = ConfigDict(from_attributes=True)


class StudyNextResponse(BaseModel):
    track_id: int
    spotify_id: str | None
    num_artists: int
    ease_factor: float
    interval: int
    repetitions: int
    remaining: int
    total: int
    mastered_count: int
    correct_total: int = 0
    wrong_total: int = 0


class GradeRequest(BaseModel):
    track_id: int
    action: str = Field(pattern="^(guess|reveal|rate|master)$")
    # Required when action == "rate": the Anki-style difficulty rating.
    rating: str | None = Field(default=None, pattern="^(again|hard|good|easy)$")
    guess_artists: list[str] = Field(default_factory=list, max_length=MAX_ARTISTS)
    guess_title: str = Field(default="", max_length=TITLE_MAX_LENGTH)
    # Study scope ("all" or a deck id) used to report the cumulative tally.
    deck_id: str | None = Field(default=None, max_length=16)

    model_config = ConfigDict(extra="forbid")


class GradeResponse(BaseModel):
    correct: bool
    title: str
    artists: list[str]
    ease_factor: float
    interval: int
    repetitions: int
    mastered: bool
    correct_total: int = 0
    wrong_total: int = 0
