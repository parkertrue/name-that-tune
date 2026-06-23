import json
from sqlalchemy import select, func


class TestGetDecks:
    def test_requires_authentication(self, client):
        response = client.get('/api/decks')
        assert response.status_code == 401
        assert json.loads(response.data)['error']['code'] == 'AUTH_MISSING_TOKEN'

    def test_empty_list(self, client, auth_headers, sample_user):
        response = client.get('/api/decks', headers=auth_headers)
        assert response.status_code == 200
        assert json.loads(response.data) == []

    def test_returns_decks_with_counts(self, client, auth_headers, sample_tracks):
        response = client.get('/api/decks', headers=auth_headers)
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 1
        deck = data[0]
        assert deck['name'] == 'My Deck'
        assert deck['total'] == 3
        assert deck['mastered'] == 0
        assert deck['active'] == 3

    def test_only_returns_own_decks(self, client, auth_headers, sample_deck,
                                    other_user_deck):
        response = client.get('/api/decks', headers=auth_headers)
        data = json.loads(response.data)
        ids = [d['id'] for d in data]
        assert other_user_deck.id not in ids


class TestAllSongsSummary:
    def test_requires_authentication(self, client):
        assert client.get('/api/decks/all').status_code == 401

    def test_empty_summary(self, client, auth_headers, sample_user):
        response = client.get('/api/decks/all', headers=auth_headers)
        assert response.status_code == 200
        assert json.loads(response.data) == {
            'total': 0, 'mastered': 0, 'active': 0
        }

    def test_counts_and_dedupes_across_decks(self, client, auth_headers,
                                             sample_tracks, sample_user, db):
        from app.models import Deck, Track
        other = Deck(user_id=sample_user.id, name='Second')
        db.session.add(other)
        db.session.commit()
        db.session.add(Track(
            deck_id=other.id, title='Bohemian Rhapsody', artists=['Queen'],
            spotify_id='4u7EnebtmKWzUH433cf5Qv',  # same id as sample_tracks[0]
        ))
        db.session.commit()

        response = client.get('/api/decks/all', headers=auth_headers)
        # 4 rows across two decks, but the shared song counts once -> 3.
        assert json.loads(response.data) == {
            'total': 3, 'mastered': 0, 'active': 3
        }

    def test_excludes_other_users(self, client, auth_headers, other_user_deck):
        response = client.get('/api/decks/all', headers=auth_headers)
        assert json.loads(response.data) == {
            'total': 0, 'mastered': 0, 'active': 0
        }


class TestCreateDeck:
    def test_create_success(self, client, auth_headers, sample_user):
        response = client.post('/api/decks',
                               data=json.dumps({'name': '80s Rock'}),
                               headers=auth_headers)
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['name'] == '80s Rock'
        assert data['total'] == 0

    def test_empty_name_rejected(self, client, auth_headers):
        response = client.post('/api/decks', data=json.dumps({'name': ''}),
                               headers=auth_headers)
        assert response.status_code == 422

    def test_extra_fields_rejected(self, client, auth_headers):
        response = client.post('/api/decks',
                               data=json.dumps({'name': 'A', 'x': 1}),
                               headers=auth_headers)
        assert response.status_code == 422


class TestGetDeck:
    def test_returns_tracks(self, client, auth_headers, sample_tracks, sample_deck):
        response = client.get(f'/api/decks/{sample_deck.id}', headers=auth_headers)
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['total'] == 3
        assert len(data['tracks']) == 3
        track = data['tracks'][0]
        assert {'id', 'title', 'artists', 'spotify_id', 'ease_factor',
                'interval', 'repetitions', 'mastered'} <= set(track.keys())

    def test_missing_deck_404(self, client, auth_headers, sample_user):
        response = client.get('/api/decks/999999', headers=auth_headers)
        assert response.status_code == 404

    def test_other_users_deck_404(self, client, auth_headers, other_user_deck):
        response = client.get(f'/api/decks/{other_user_deck.id}',
                              headers=auth_headers)
        assert response.status_code == 404


class TestDeleteDeck:
    def test_delete_success(self, client, auth_headers, sample_deck, db):
        from app.models import Deck
        response = client.delete(f'/api/decks/{sample_deck.id}',
                                 headers=auth_headers)
        assert response.status_code == 200
        remaining = db.session.execute(
            select(func.count()).select_from(Deck)
        ).scalar_one()
        assert remaining == 0

    def test_delete_cascades_tracks(self, client, auth_headers, sample_tracks,
                                    sample_deck, db):
        from app.models import Track
        client.delete(f'/api/decks/{sample_deck.id}', headers=auth_headers)
        count = db.session.execute(
            select(func.count()).select_from(Track)
        ).scalar_one()
        assert count == 0

    def test_other_users_deck_404(self, client, auth_headers, other_user_deck):
        response = client.delete(f'/api/decks/{other_user_deck.id}',
                                 headers=auth_headers)
        assert response.status_code == 404


class TestImportTracks:
    def test_import_success(self, client, auth_headers, sample_deck):
        payload = {'tracks': [
            {'spotify_id': '5IVuqXILoxVWvWEPm82Bkj', 'title': 'Song A', 'artists': ['Artist A']},
            {'spotify_id': None, 'title': 'Song B', 'artists': ['Artist B', 'B2']},
        ]}
        response = client.post(f'/api/decks/{sample_deck.id}/tracks',
                               data=json.dumps(payload), headers=auth_headers)
        assert response.status_code == 201
        assert json.loads(response.data)['added'] == 2

    def test_import_dedupes_by_spotify_id(self, client, auth_headers, sample_tracks,
                                          sample_deck):
        # 4u7... already exists from sample_tracks.
        payload = {'tracks': [
            {'spotify_id': '4u7EnebtmKWzUH433cf5Qv', 'title': 'Dup', 'artists': ['Queen']},
            {'spotify_id': '7ouMYWpwJ422jRcDASZB7P', 'title': 'New', 'artists': ['New Artist']},
        ]}
        response = client.post(f'/api/decks/{sample_deck.id}/tracks',
                               data=json.dumps(payload), headers=auth_headers)
        assert response.status_code == 201
        assert json.loads(response.data)['added'] == 1

    def test_import_empty_list_rejected(self, client, auth_headers, sample_deck):
        response = client.post(f'/api/decks/{sample_deck.id}/tracks',
                               data=json.dumps({'tracks': []}), headers=auth_headers)
        assert response.status_code == 422

    def test_import_other_users_deck_404(self, client, auth_headers, other_user_deck):
        payload = {'tracks': [{'title': 'X', 'artists': ['Y']}]}
        response = client.post(f'/api/decks/{other_user_deck.id}/tracks',
                               data=json.dumps(payload), headers=auth_headers)
        assert response.status_code == 404


class TestResetDeck:
    def test_reset_restores_sm2_state(self, client, auth_headers, sample_tracks,
                                      sample_deck, db):
        from app.models import Track
        from app.models.track import INITIAL_EASE
        # Master/alter a track first.
        track = sample_tracks[0]
        track.ease_factor = 1.8
        track.interval = 30
        track.repetitions = 5
        track.mastered = True
        db.session.commit()

        response = client.post(f'/api/decks/{sample_deck.id}/reset',
                               headers=auth_headers)
        assert response.status_code == 200

        refreshed = db.session.get(Track, track.id)
        assert refreshed.ease_factor == INITIAL_EASE
        assert refreshed.interval == 0
        assert refreshed.repetitions == 0
        assert refreshed.mastered is False
