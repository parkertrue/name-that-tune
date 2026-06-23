import pytest
from pydantic import ValidationError

from app.schemas import TrackImportItem, TrackBulkImportRequest, GradeRequest


class TestTrackImportItem:
    def test_valid(self):
        item = TrackImportItem(spotify_id='4u7EnebtmKWzUH433cf5Qv',
                               title='Song', artists=['A', 'B'])
        assert item.title == 'Song'
        assert item.artists == ['A', 'B']

    def test_spotify_id_optional(self):
        item = TrackImportItem(title='Song', artists=['A'])
        assert item.spotify_id is None

    def test_blank_spotify_id_becomes_none(self):
        item = TrackImportItem(spotify_id='   ', title='Song', artists=['A'])
        assert item.spotify_id is None

    def test_malformed_spotify_id_rejected(self):
        # Wrong length / non-base62 chars must be rejected to prevent
        # query/path injection into the embed iframe URL.
        for bad in ('abc', 'brandnew', '4u7EnebtmKWzUH433cf5Q', 'a' * 23,
                    '4u7Eneb?mKWzUH433cf5Qv'):
            with pytest.raises(ValidationError):
                TrackImportItem(spotify_id=bad, title='Song', artists=['A'])

    def test_empty_title_rejected(self):
        with pytest.raises(ValidationError):
            TrackImportItem(title='', artists=['A'])

    def test_no_artists_rejected(self):
        with pytest.raises(ValidationError):
            TrackImportItem(title='Song', artists=[])

    def test_blank_artists_rejected(self):
        with pytest.raises(ValidationError):
            TrackImportItem(title='Song', artists=['   '])

    def test_strips_html_in_title_and_artists(self):
        item = TrackImportItem(title='<i>Song</i>', artists=['<b>A</b>'])
        assert '<i>' not in item.title
        assert '<b>' not in item.artists[0]


class TestTrackBulkImportRequest:
    def test_valid(self):
        req = TrackBulkImportRequest(tracks=[
            {'title': 'Song', 'artists': ['A']},
        ])
        assert len(req.tracks) == 1

    def test_empty_rejected(self):
        with pytest.raises(ValidationError):
            TrackBulkImportRequest(tracks=[])


class TestGradeRequest:
    def test_valid_guess(self):
        req = GradeRequest(track_id=1, action='guess',
                           guess_artists=['A'], guess_title='T')
        assert req.action == 'guess'

    def test_defaults(self):
        req = GradeRequest(track_id=1, action='master')
        assert req.guess_artists == []
        assert req.guess_title == ''

    def test_invalid_action_rejected(self):
        with pytest.raises(ValidationError):
            GradeRequest(track_id=1, action='delete')
