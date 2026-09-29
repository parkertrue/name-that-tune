from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import select, func

from app import db
from app.models import Deck, Track
from app.models.track import dedupe_by_song
from app.schemas import (
    DeckCreateRequest,
    DeckResponse,
    TrackBulkImportRequest,
    TrackResponse,
)
from app.utils.errors import error_response


decks_bp = Blueprint('decks', __name__, url_prefix='/api/decks')


def _get_owned_deck(deck_id: int, user_id: int) -> Deck | None:
    """Fetch a deck, returning None if it does not exist or is not owned."""
    deck = db.session.get(Deck, deck_id)
    if deck is None or deck.user_id != user_id:
        return None
    return deck


def _deck_counts(deck_id: int) -> tuple[int, int]:
    """Return (total, mastered) track counts for a deck."""
    total = db.session.execute(
        select(func.count()).select_from(Track).where(Track.deck_id == deck_id)
    ).scalar_one()
    mastered = db.session.execute(
        select(func.count()).select_from(Track).where(
            Track.deck_id == deck_id, Track.mastered.is_(True)
        )
    ).scalar_one()
    return total, mastered


def _deck_response(deck: Deck) -> dict:
    total, mastered = _deck_counts(deck.id)
    return DeckResponse(
        id=deck.id,
        name=deck.name,
        created_at=deck.created_at,
        total=total,
        mastered=mastered,
        active=total - mastered,
    ).model_dump()


@decks_bp.route('', methods=['GET'])
@jwt_required()
def get_decks():
    """Return all decks belonging to the current user with progress counts."""
    user_id = int(get_jwt_identity())

    stmt = select(Deck).where(Deck.user_id == user_id).order_by(Deck.created_at)
    decks = db.session.execute(stmt).scalars().all()

    response = [_deck_response(deck) for deck in decks]
    return jsonify(response), 200


@decks_bp.route('/all', methods=['GET'])
@jwt_required()
def all_songs_summary():
    """Progress counts for the virtual "All Songs" scope.

    De-duplicates songs that appear in multiple decks (by spotify_id) so these
    totals match what studying "All Songs" actually presents.
    """
    user_id = int(get_jwt_identity())
    tracks = db.session.execute(
        select(Track).join(Deck, Track.deck_id == Deck.id).where(
            Deck.user_id == user_id
        )
    ).scalars().all()

    songs = dedupe_by_song(tracks)
    total = len(songs)
    mastered = sum(1 for t in songs if t.mastered)
    return jsonify({
        "total": total,
        "mastered": mastered,
        "active": total - mastered,
    }), 200


@decks_bp.route('', methods=['POST'])
@jwt_required()
def create_deck():
    """Create a new deck."""
    payload = DeckCreateRequest(**request.get_json())
    user_id = int(get_jwt_identity())

    deck = Deck(user_id=user_id, name=payload.name)
    db.session.add(deck)
    db.session.commit()

    return jsonify(_deck_response(deck)), 201


@decks_bp.route('/<int:deck_id>', methods=['GET'])
@jwt_required()
def get_deck(deck_id):
    """Return a deck with all its tracks (for the mastery dashboard)."""
    user_id = int(get_jwt_identity())
    deck = _get_owned_deck(deck_id, user_id)
    if deck is None:
        return error_response("DECK_NOT_FOUND", "Deck not found", 404)

    tracks = [
        TrackResponse.model_validate(track).model_dump()
        for track in deck.tracks
    ]
    body = _deck_response(deck)
    body["tracks"] = tracks
    return jsonify(body), 200


@decks_bp.route('/<int:deck_id>', methods=['DELETE'])
@jwt_required()
def delete_deck(deck_id):
    """Delete a deck and all of its tracks."""
    user_id = int(get_jwt_identity())
    deck = _get_owned_deck(deck_id, user_id)
    if deck is None:
        return error_response("DECK_NOT_FOUND", "Deck not found", 404)

    db.session.delete(deck)
    db.session.commit()
    return jsonify({"message": "Deck deleted"}), 200


@decks_bp.route('/<int:deck_id>/tracks', methods=['POST'])
@jwt_required()
def import_tracks(deck_id):
    """Bulk-add tracks to a deck, de-duplicating by spotify_id within the deck."""
    payload = TrackBulkImportRequest(**request.get_json())
    user_id = int(get_jwt_identity())
    deck = _get_owned_deck(deck_id, user_id)
    if deck is None:
        return error_response("DECK_NOT_FOUND", "Deck not found", 404)

    existing_ids = {
        t.spotify_id for t in deck.tracks if t.spotify_id is not None
    }

    added = 0
    for item in payload.tracks:
        if item.spotify_id and item.spotify_id in existing_ids:
            continue
        db.session.add(Track(
            deck_id=deck.id,
            title=item.title,
            artists=item.artists,
            spotify_id=item.spotify_id,
        ))
        if item.spotify_id:
            existing_ids.add(item.spotify_id)
        added += 1

    db.session.commit()
    return jsonify({"added": added}), 201


@decks_bp.route('/tracks/<int:track_id>', methods=['DELETE'])
@jwt_required()
def delete_track(track_id):
    """Delete a single track (one deck's copy of a song).

    Only this Track row is removed, so the song disappears from the virtual
    "All Songs" scope unless another deck still holds a copy (matched by
    spotify_id) — that copy keeps the song in All Songs.
    """
    user_id = int(get_jwt_identity())
    track = db.session.execute(
        select(Track).join(Deck, Track.deck_id == Deck.id).where(
            Track.id == track_id, Deck.user_id == user_id
        )
    ).scalar_one_or_none()
    if track is None:
        return error_response("TRACK_NOT_FOUND", "Track not found", 404)

    db.session.delete(track)
    db.session.commit()
    return jsonify({"message": "Track deleted"}), 200


@decks_bp.route('/<int:deck_id>/reset', methods=['POST'])
@jwt_required()
def reset_deck(deck_id):
    """Reset all tracks in a deck back to their initial SM-2 state (un-master all)."""
    from app.models.track import INITIAL_EASE

    user_id = int(get_jwt_identity())
    deck = _get_owned_deck(deck_id, user_id)
    if deck is None:
        return error_response("DECK_NOT_FOUND", "Deck not found", 404)

    for track in deck.tracks:
        track.ease_factor = INITIAL_EASE
        track.interval = 0
        track.repetitions = 0
        track.mastered = False

    deck.correct_count = 0
    deck.wrong_count = 0

    db.session.commit()
    return jsonify({"message": "Deck reset"}), 200
