import pytest
from pydantic import ValidationError

from app.schemas import DeckCreateRequest


class TestDeckCreateRequest:
    def test_valid_name(self):
        req = DeckCreateRequest(name='80s Rock')
        assert req.name == '80s Rock'

    def test_strips_html(self):
        req = DeckCreateRequest(name='<b>Rock</b>')
        assert '<b>' not in req.name
        assert 'Rock' in req.name

    def test_empty_name_rejected(self):
        with pytest.raises(ValidationError):
            DeckCreateRequest(name='')

    def test_whitespace_only_rejected(self):
        with pytest.raises(ValidationError):
            DeckCreateRequest(name='   ')

    def test_too_long_rejected(self):
        with pytest.raises(ValidationError):
            DeckCreateRequest(name='x' * 101)

    def test_extra_field_rejected(self):
        with pytest.raises(ValidationError):
            DeckCreateRequest(name='ok', color='blue')
