import json
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app import db
if TYPE_CHECKING:
    from app.models import Deck

# SM-2 spaced-repetition constants (classic SuperMemo-2, applied session-locally:
# the interval governs how soon a card re-appears within a study session rather
# than across calendar days).
INITIAL_EASE = 2.5
MIN_EASE = 1.3
# A card whose interval reaches this threshold is considered "graduated"
# (Anki's "mature" line). The UI still labels this state "mastered".
GRADUATION_INTERVAL = 21

# Maps the Anki-style rating buttons to an SM-2 quality score (0-5).
# A quality < 3 is treated as a lapse (interval/repetitions reset). Tunable.
RATING_QUALITY = {
    "again": 1,
    "hard": 3,
    "good": 4,
    "easy": 5,
}


def quality_for_rating(rating: str) -> int:
    """Translate an Again/Hard/Good/Easy rating into an SM-2 quality score."""
    return RATING_QUALITY[rating]


class Track(db.Model):
    __tablename__ = "tracks"

    id: Mapped[int] = mapped_column(primary_key=True)
    deck_id: Mapped[int] = mapped_column(
        db.ForeignKey('decks.id'),
        nullable=False,
        index=True
    )
    spotify_id: Mapped[str | None] = mapped_column(
        db.String(64),
        nullable=True
    )
    title: Mapped[str] = mapped_column(
        db.String(256),
        nullable=False
    )
    # JSON-encoded list[str]; access via the artists property.
    artists_json: Mapped[str] = mapped_column(
        "artists",
        db.Text,
        nullable=False
    )
    # SM-2 scheduling state.
    ease_factor: Mapped[float] = mapped_column(
        db.Float,
        nullable=False,
        default=INITIAL_EASE,
        server_default=str(INITIAL_EASE)
    )
    interval: Mapped[int] = mapped_column(
        db.Integer,
        nullable=False,
        default=0,
        server_default="0"
    )
    repetitions: Mapped[int] = mapped_column(
        db.Integer,
        nullable=False,
        default=0,
        server_default="0"
    )
    # True once the card "graduates" (interval >= GRADUATION_INTERVAL). The UI
    # surfaces this as "mastered".
    mastered: Mapped[bool] = mapped_column(
        db.Boolean,
        nullable=False,
        default=False,
        server_default=db.false()
    )
    created_at: Mapped[datetime] = mapped_column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )
    deck: Mapped["Deck"] = relationship("Deck", back_populates="tracks")

    def __init__(
        self,
        *,
        deck_id: int,
        title: str,
        artists: list[str],
        spotify_id: str | None = None,
    ) -> None:
        self.deck_id = deck_id
        self.title = title
        self.artists = artists
        self.spotify_id = spotify_id
        self.ease_factor = INITIAL_EASE
        self.interval = 0
        self.repetitions = 0
        self.mastered = False

    @property
    def artists(self) -> list[str]:
        try:
            value = json.loads(self.artists_json)
            return value if isinstance(value, list) else []
        except (TypeError, ValueError):
            return []

    @artists.setter
    def artists(self, value: list[str]) -> None:
        self.artists_json = json.dumps(list(value))

    def apply_review(self, quality: int) -> None:
        """Update SM-2 state after a rated review (quality 0-5).

        Quality < 3 is a lapse: repetitions and interval reset. Otherwise the
        interval grows (1 → 6 → round(interval * ease_factor)) and the ease
        factor is nudged by the standard SM-2 formula (floored at MIN_EASE).
        The card graduates ("mastered") once its interval reaches the maturity
        threshold.
        """
        if quality < 3:
            self.repetitions = 0
            self.interval = 1
        else:
            if self.repetitions == 0:
                self.interval = 1
            elif self.repetitions == 1:
                self.interval = 6
            else:
                self.interval = round(self.interval * self.ease_factor)
            self.repetitions += 1

        self.ease_factor = max(
            MIN_EASE,
            self.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
        )
        self.mastered = self.interval >= GRADUATION_INTERVAL

    def graduate(self) -> None:
        """Immediately mature a card (the "Mastered" shortcut)."""
        self.interval = GRADUATION_INTERVAL
        self.mastered = True

    def selection_weight(self) -> int:
        """Session-local pick weight: shorter interval ⇒ more likely to recur.

        New cards (interval 0) get the highest weight; cards approaching
        graduation get the lowest. Always at least 1 so any active card can
        still be picked.
        """
        return max(1, GRADUATION_INTERVAL - self.interval)


def dedupe_by_song(tracks: list[Track]) -> list[Track]:
    """Collapse tracks that share a spotify_id down to one representative.

    Used by the virtual "All Songs" scope so a song that lives in several
    decks is only counted and studied once. Prefers a still-active (not yet
    mastered) copy as the representative, so the song keeps appearing until it
    is mastered in every deck it belongs to. Tracks without a spotify_id can't
    be matched across decks and are always kept.
    """
    index_by_id: dict[str, int] = {}
    result: list[Track] = []
    for track in tracks:
        if track.spotify_id is None:
            result.append(track)
            continue
        index = index_by_id.get(track.spotify_id)
        if index is None:
            index_by_id[track.spotify_id] = len(result)
            result.append(track)
        elif result[index].mastered and not track.mastered:
            result[index] = track
    return result
