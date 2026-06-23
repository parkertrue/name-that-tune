"""replace track weight with SM-2 scheduling fields

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('tracks', schema=None) as batch_op:
        batch_op.add_column(sa.Column(
            'ease_factor', sa.Float(), server_default='2.5', nullable=False))
        batch_op.add_column(sa.Column(
            'interval', sa.Integer(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column(
            'repetitions', sa.Integer(), server_default='0', nullable=False))
        batch_op.drop_column('weight')


def downgrade():
    with op.batch_alter_table('tracks', schema=None) as batch_op:
        batch_op.add_column(sa.Column(
            'weight', sa.Integer(), server_default='3', nullable=False))
        batch_op.drop_column('repetitions')
        batch_op.drop_column('interval')
        batch_op.drop_column('ease_factor')
