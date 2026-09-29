"""decode HTML entities in existing deck/track text

Older rows were sanitized with nh3 alone, which HTML-escaped surviving text
(e.g. "Brooks & Dunn" was stored as "Brooks &amp; Dunn"). The sanitizer now
emits plain text; this backfills existing data so titles/artists/deck names
display correctly and grade correctly (normalize() would otherwise see a stray
"amp" token).

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-24 00:00:00.000000

"""
import html
import json

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def _decode_artists(raw: str) -> str:
    """Decode entities within a JSON-encoded list of artist strings."""
    try:
        artists = json.loads(raw)
    except (TypeError, ValueError):
        return raw
    if not isinstance(artists, list):
        return raw
    return json.dumps([html.unescape(a) if isinstance(a, str) else a
                       for a in artists])


def upgrade():
    conn = op.get_bind()

    decks = sa.table('decks', sa.column('id', sa.Integer),
                     sa.column('name', sa.String))
    for row in conn.execute(sa.select(decks.c.id, decks.c.name)):
        decoded = html.unescape(row.name)
        if decoded != row.name:
            conn.execute(decks.update().where(decks.c.id == row.id)
                         .values(name=decoded))

    tracks = sa.table('tracks', sa.column('id', sa.Integer),
                      sa.column('title', sa.String),
                      sa.column('artists', sa.Text))
    for row in conn.execute(sa.select(tracks.c.id, tracks.c.title,
                                       tracks.c.artists)):
        new_title = html.unescape(row.title)
        new_artists = _decode_artists(row.artists)
        if new_title != row.title or new_artists != row.artists:
            conn.execute(tracks.update().where(tracks.c.id == row.id)
                         .values(title=new_title, artists=new_artists))


def downgrade():
    # Decoding is a lossy, corrective backfill; re-escaping is neither possible
    # to do reliably nor desirable. No-op.
    pass
