"""replace notes with decks and tracks

Revision ID: a1b2c3d4e5f6
Revises: 40460e983e45
Create Date: 2026-06-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '40460e983e45'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table('notes')

    op.create_table(
        'decks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'tracks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('deck_id', sa.Integer(), nullable=False),
        sa.Column('spotify_id', sa.String(length=64), nullable=True),
        sa.Column('title', sa.String(length=256), nullable=False),
        sa.Column('artists', sa.Text(), nullable=False),
        sa.Column('weight', sa.Integer(), server_default='3', nullable=False),
        sa.Column('mastered', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['deck_id'], ['decks.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('tracks', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_tracks_deck_id'), ['deck_id'], unique=False)


def downgrade():
    with op.batch_alter_table('tracks', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_tracks_deck_id'))
    op.drop_table('tracks')
    op.drop_table('decks')

    op.create_table(
        'notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('content', sa.String(length=256), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
