from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app import db
if TYPE_CHECKING:
    from app.models import User, Track


class Deck(db.Model):
    __tablename__ = "decks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        db.ForeignKey('users.id'),
        nullable=False
    )
    name: Mapped[str] = mapped_column(
        db.String(100),
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )
    # Cumulative study tally for this deck (persists across sessions).
    correct_count: Mapped[int] = mapped_column(
        db.Integer,
        nullable=False,
        default=0,
        server_default="0"
    )
    wrong_count: Mapped[int] = mapped_column(
        db.Integer,
        nullable=False,
        default=0,
        server_default="0"
    )
    user: Mapped["User"] = relationship(
        "User",
        backref=db.backref("decks", cascade="all, delete-orphan")
    )
    tracks: Mapped[list["Track"]] = relationship(
        "Track",
        back_populates="deck",
        cascade="all, delete-orphan"
    )

    def __init__(self, *, user_id: int, name: str) -> None:
        self.user_id = user_id
        self.name = name
        self.correct_count = 0
        self.wrong_count = 0
