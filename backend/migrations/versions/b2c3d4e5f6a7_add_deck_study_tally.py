"""add deck study tally (correct_count, wrong_count)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('decks', schema=None) as batch_op:
        batch_op.add_column(sa.Column(
            'correct_count', sa.Integer(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column(
            'wrong_count', sa.Integer(), server_default='0', nullable=False))


def downgrade():
    with op.batch_alter_table('decks', schema=None) as batch_op:
        batch_op.drop_column('wrong_count')
        batch_op.drop_column('correct_count')
