import random

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import select, func

from app import db
from app.models import Deck, Track
from app.models.track import dedupe_by_song, quality_for_rating
from app.schemas import StudyNextResponse, GradeRequest, GradeResponse
from app.utils.errors import error_response
from app.utils import matching


study_bp = Blueprint('study', __name__, url_prefix='/api/study')


def _scope_filters(user_id: int, deck_id_param: str | None):
    """Build the list of WHERE clauses scoping tracks to the user / deck.

    Returns (filters, error) where error is a Flask response tuple if the
    requested deck is missing or not owned by the user.
    """
    filters = [Deck.user_id == user_id]
    if deck_id_param and deck_id_param != "all":
        try:
            deck_id = int(deck_id_param)
        except ValueError:
            return None, error_response("DECK_NOT_FOUND", "Deck not found", 404)
        deck = db.session.get(Deck, deck_id)
        if deck is None or deck.user_id != user_id:
            return None, error_response("DECK_NOT_FOUND", "Deck not found", 404)
        filters.append(Track.deck_id == deck_id)
    return filters, None


def _scope_score(user_id: int, deck_id_param: str | None) -> tuple[int, int]:
    """Cumulative (correct, wrong) tally summed over the decks in scope."""
    stmt = select(
        func.coalesce(func.sum(Deck.correct_count), 0),
        func.coalesce(func.sum(Deck.wrong_count), 0),
    ).where(Deck.user_id == user_id)
    if deck_id_param and deck_id_param != "all":
        try:
            stmt = stmt.where(Deck.id == int(deck_id_param))
        except ValueError:
            return 0, 0
    correct, wrong = db.session.execute(stmt).one()
    return int(correct), int(wrong)


def _pick_weighted(tracks: list[Track]) -> Track:
    """Weighted-random pick; shorter SM-2 interval ⇒ more likely (due sooner)."""
    weights = [t.selection_weight() for t in tracks]
    total = sum(weights)
    if total <= 0:
        return random.choice(tracks)
    r = random.uniform(0, total)
    upto = 0.0
    for track, weight in zip(tracks, weights):
        upto += weight
        if r <= upto:
            return track
    return tracks[-1]


@study_bp.route('/next', methods=['GET'])
@jwt_required()
def study_next():
    """Return the next track to study within the requested scope.

    Picks a weighted-random non-mastered track. The answer (title/artists) is
    deliberately withheld. Responds with {"done": true} when nothing is left.
    """
    user_id = int(get_jwt_identity())
    deck_id_param = request.args.get('deck_id')
    exclude_param = request.args.get('exclude')

    filters, error = _scope_filters(user_id, deck_id_param)
    if error is not None:
        return error

    is_all_scope = not (deck_id_param and deck_id_param != "all")
    base = select(Track).join(Deck, Track.deck_id == Deck.id).where(*filters)

    if is_all_scope:
        # "All Songs" spans every deck, so a song imported into more than one
        # deck would otherwise appear multiple times. Collapse duplicates by
        # spotify_id before counting and picking.
        songs = dedupe_by_song(db.session.execute(base).scalars().all())
        total = len(songs)
        mastered_count = sum(1 for t in songs if t.mastered)
        active = [t for t in songs if not t.mastered]
    else:
        total = db.session.execute(
            select(func.count()).select_from(base.subquery())
        ).scalar_one()
        mastered_count = db.session.execute(
            select(func.count()).select_from(
                base.where(Track.mastered.is_(True)).subquery()
            )
        ).scalar_one()
        active = db.session.execute(
            base.where(Track.mastered.is_(False))
        ).scalars().all()

    if not active:
        return jsonify({"done": True}), 200

    # Avoid immediately repeating the previous card when possible.
    candidates = active
    if exclude_param and len(active) > 1:
        try:
            exclude_id = int(exclude_param)
            filtered = [t for t in active if t.id != exclude_id]
            if filtered:
                candidates = filtered
        except ValueError:
            pass

    track = _pick_weighted(candidates)

    correct_total, wrong_total = _scope_score(user_id, deck_id_param)
    response = StudyNextResponse(
        track_id=track.id,
        spotify_id=track.spotify_id,
        num_artists=len(track.artists),
        ease_factor=track.ease_factor,
        interval=track.interval,
        repetitions=track.repetitions,
        remaining=len(active),
        total=total,
        mastered_count=mastered_count,
        correct_total=correct_total,
        wrong_total=wrong_total,
    )
    return jsonify(response.model_dump()), 200


@study_bp.route('/grade', methods=['POST'])
@jwt_required()
def grade():
    """Grade or record one card.

    The flow is two-step (Anki-style): `guess`/`reveal` only reveal the answer
    (no scheduling, no tally); `rate` then applies the SM-2 update and the deck
    tally. `master` is a shortcut that immediately graduates the card.

    Actions: guess | reveal | rate | master.
    """
    payload = GradeRequest(**request.get_json())
    user_id = int(get_jwt_identity())

    track = db.session.execute(
        select(Track).join(Deck, Track.deck_id == Deck.id).where(
            Track.id == payload.track_id, Deck.user_id == user_id
        )
    ).scalar_one_or_none()

    if track is None:
        return error_response("TRACK_NOT_FOUND", "Track not found", 404)

    # Whether the deck tally moves, and in which direction. Only the scheduling
    # actions (rate/master) touch the tally so each card counts at most once.
    scored = False
    correct = False

    if payload.action == "master":
        track.graduate()
        correct = True
        scored = True
    elif payload.action == "rate":
        if payload.rating is None:
            return error_response(
                "RATING_REQUIRED", "A rating is required to rate a card", 400)
        track.apply_review(quality_for_rating(payload.rating))
        correct = payload.rating != "again"
        scored = True
    elif payload.action == "reveal":
        # Give up: reveal the answer only; the user then rates the card.
        correct = False
    else:  # guess
        # Reveal whether the typed guess matched; scheduling waits for the rating.
        correct = matching.grade(
            payload.guess_artists, payload.guess_title,
            track.artists, track.title,
        )

    if scored:
        if correct:
            track.deck.correct_count += 1
        else:
            track.deck.wrong_count += 1

    db.session.commit()

    # Report the cumulative tally for the scope the client is studying
    # (falls back to the track's own deck when no scope is supplied).
    scope = payload.deck_id if payload.deck_id is not None else str(track.deck_id)
    correct_total, wrong_total = _scope_score(user_id, scope)

    response = GradeResponse(
        correct=correct,
        title=track.title,
        artists=track.artists,
        ease_factor=track.ease_factor,
        interval=track.interval,
        repetitions=track.repetitions,
        mastered=track.mastered,
        correct_total=correct_total,
        wrong_total=wrong_total,
    )
    return jsonify(response.model_dump()), 200
