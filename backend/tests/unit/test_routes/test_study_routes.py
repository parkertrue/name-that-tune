import json


class TestStudyNext:
    def test_requires_authentication(self, client):
        response = client.get('/api/study/next')
        assert response.status_code == 401

    def test_returns_track_without_answer(self, client, auth_headers, sample_tracks,
                                          sample_deck):
        response = client.get(f'/api/study/next?deck_id={sample_deck.id}',
                              headers=auth_headers)
        assert response.status_code == 200
        data = json.loads(response.data)
        # The answer must never be leaked by /next.
        assert 'title' not in data
        assert 'artists' not in data
        assert 'track_id' in data
        assert 'num_artists' in data
        assert data['total'] == 3

    def test_done_when_no_active_tracks(self, client, auth_headers, sample_tracks,
                                        sample_deck, db):
        from app.models import Track
        for track in db.session.query(Track).all():
            track.mastered = True
        db.session.commit()

        response = client.get(f'/api/study/next?deck_id={sample_deck.id}',
                              headers=auth_headers)
        assert response.status_code == 200
        assert json.loads(response.data) == {'done': True}

    def test_excludes_mastered_tracks(self, client, auth_headers, sample_tracks,
                                      sample_deck, db):
        from app.models import Track
        # Master all but one; /next must return the remaining one.
        active = sample_tracks[0]
        for track in sample_tracks[1:]:
            track.mastered = True
        db.session.commit()

        response = client.get(f'/api/study/next?deck_id={sample_deck.id}',
                              headers=auth_headers)
        data = json.loads(response.data)
        assert data['track_id'] == active.id
        assert data['remaining'] == 1
        assert data['mastered_count'] == 2

    def test_all_scope_spans_decks(self, client, auth_headers, sample_tracks):
        response = client.get('/api/study/next?deck_id=all', headers=auth_headers)
        assert response.status_code == 200
        assert json.loads(response.data)['total'] == 3

    def test_all_scope_dedupes_songs_across_decks(self, client, auth_headers,
                                                  sample_tracks, sample_user, db):
        from app.models import Deck, Track
        # A second deck re-uses a song already present in the first deck.
        other = Deck(user_id=sample_user.id, name='Second')
        db.session.add(other)
        db.session.commit()
        db.session.add(Track(
            deck_id=other.id, title='Bohemian Rhapsody', artists=['Queen'],
            spotify_id='4u7EnebtmKWzUH433cf5Qv',  # same id as sample_tracks[0]
        ))
        db.session.commit()

        response = client.get('/api/study/next?deck_id=all', headers=auth_headers)
        data = json.loads(response.data)
        # 4 track rows exist, but the shared song collapses to 3 distinct songs.
        assert data['total'] == 3

    def test_all_scope_keeps_song_active_until_mastered_everywhere(
            self, client, auth_headers, sample_tracks, sample_user, db):
        from app.models import Deck, Track
        other = Deck(user_id=sample_user.id, name='Second')
        db.session.add(other)
        db.session.commit()
        db.session.add(Track(
            deck_id=other.id, title='Bohemian Rhapsody', artists=['Queen'],
            spotify_id='4u7EnebtmKWzUH433cf5Qv',
        ))
        # Master the copy in the first deck only.
        sample_tracks[0].mastered = True
        db.session.commit()

        response = client.get('/api/study/next?deck_id=all', headers=auth_headers)
        data = json.loads(response.data)
        # The song stays studyable via its still-active copy in the other deck.
        assert data['total'] == 3
        assert data['mastered_count'] == 0

    def test_other_users_deck_404(self, client, auth_headers, other_user_deck):
        response = client.get(f'/api/study/next?deck_id={other_user_deck.id}',
                              headers=auth_headers)
        assert response.status_code == 404


class TestStudyGrade:
    def _grade(self, client, headers, body):
        return client.post('/api/study/grade', data=json.dumps(body),
                           headers=headers)

    def test_guess_reveals_without_scheduling(self, client, auth_headers,
                                              sample_tracks, sample_deck):
        # A correct guess reveals the answer but does NOT schedule or tally;
        # scheduling waits for the rating.
        track = sample_tracks[0]  # Queen / Bohemian Rhapsody
        response = self._grade(client, auth_headers, {
            'track_id': track.id, 'action': 'guess',
            'guess_artists': ['Queen'], 'guess_title': 'Bohemian Rhapsody',
            'deck_id': str(sample_deck.id),
        })
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['correct'] is True
        assert data['title'] == 'Bohemian Rhapsody'
        assert data['interval'] == 0       # unchanged
        assert data['repetitions'] == 0
        assert data['correct_total'] == 0  # no tally yet

    def test_wrong_guess_reports_incorrect(self, client, auth_headers, sample_tracks):
        track = sample_tracks[0]
        response = self._grade(client, auth_headers, {
            'track_id': track.id, 'action': 'guess',
            'guess_artists': ['Wrong'], 'guess_title': 'Nope',
        })
        data = json.loads(response.data)
        assert data['correct'] is False
        assert data['interval'] == 0

    def test_reveal_reveals_answer_without_scheduling(self, client, auth_headers,
                                                     sample_tracks):
        track = sample_tracks[0]
        response = self._grade(client, auth_headers, {
            'track_id': track.id, 'action': 'reveal',
        })
        data = json.loads(response.data)
        assert data['correct'] is False
        assert data['title'] == 'Bohemian Rhapsody'
        assert data['interval'] == 0       # not scheduled
        assert data['mastered'] is False

    def test_rate_good_schedules_card(self, client, auth_headers, sample_tracks,
                                      sample_deck):
        track = sample_tracks[0]
        response = self._grade(client, auth_headers, {
            'track_id': track.id, 'action': 'rate', 'rating': 'good',
            'deck_id': str(sample_deck.id),
        })
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['correct'] is True
        assert data['interval'] == 1
        assert data['repetitions'] == 1
        assert data['correct_total'] == 1

    def test_rate_again_counts_as_wrong(self, client, auth_headers, sample_tracks,
                                        sample_deck):
        track = sample_tracks[0]
        response = self._grade(client, auth_headers, {
            'track_id': track.id, 'action': 'rate', 'rating': 'again',
            'deck_id': str(sample_deck.id),
        })
        data = json.loads(response.data)
        assert data['correct'] is False
        assert data['interval'] == 1
        assert data['repetitions'] == 0
        assert data['wrong_total'] == 1

    def test_rate_requires_rating(self, client, auth_headers, sample_tracks):
        response = self._grade(client, auth_headers, {
            'track_id': sample_tracks[0].id, 'action': 'rate',
        })
        assert response.status_code == 400

    def test_master_action_graduates(self, client, auth_headers, sample_tracks):
        from app.models.track import GRADUATION_INTERVAL
        track = sample_tracks[0]
        response = self._grade(client, auth_headers, {
            'track_id': track.id, 'action': 'master',
        })
        data = json.loads(response.data)
        assert data['mastered'] is True
        assert data['interval'] == GRADUATION_INTERVAL

    def test_invalid_action_rejected(self, client, auth_headers, sample_tracks):
        response = self._grade(client, auth_headers, {
            'track_id': sample_tracks[0].id, 'action': 'bogus',
        })
        assert response.status_code == 422

    def test_invalid_rating_rejected(self, client, auth_headers, sample_tracks):
        response = self._grade(client, auth_headers, {
            'track_id': sample_tracks[0].id, 'action': 'rate', 'rating': 'bogus',
        })
        assert response.status_code == 422

    def test_other_users_track_404(self, client, auth_headers, other_user_deck):
        other_track_id = other_user_deck.tracks[0].id
        response = self._grade(client, auth_headers, {
            'track_id': other_track_id, 'action': 'reveal',
        })
        assert response.status_code == 404


class TestStudyTally:
    """The cumulative correct/wrong tally is persisted server-side per deck."""

    def _grade(self, client, headers, body):
        return client.post('/api/study/grade', data=json.dumps(body),
                           headers=headers)

    def test_grade_returns_running_tally(self, client, auth_headers, sample_tracks,
                                         sample_deck):
        # One good rating (correct) + one again rating (wrong).
        correct = self._grade(client, auth_headers, {
            'track_id': sample_tracks[0].id, 'action': 'rate', 'rating': 'good',
            'deck_id': str(sample_deck.id),
        })
        assert json.loads(correct.data)['correct_total'] == 1

        wrong = self._grade(client, auth_headers, {
            'track_id': sample_tracks[1].id, 'action': 'rate', 'rating': 'again',
            'deck_id': str(sample_deck.id),
        })
        data = json.loads(wrong.data)
        assert data['correct_total'] == 1
        assert data['wrong_total'] == 1

    def test_tally_persists_to_next(self, client, auth_headers, sample_tracks,
                                    sample_deck):
        self._grade(client, auth_headers, {
            'track_id': sample_tracks[0].id, 'action': 'rate', 'rating': 'good',
            'deck_id': str(sample_deck.id),
        })
        # A fresh /next (e.g. after a page refresh) reports the same tally.
        response = client.get(f'/api/study/next?deck_id={sample_deck.id}',
                              headers=auth_headers)
        data = json.loads(response.data)
        assert data['correct_total'] == 1
        assert data['wrong_total'] == 0

    def test_all_scope_sums_decks(self, client, auth_headers, sample_tracks,
                                  sample_deck):
        self._grade(client, auth_headers, {
            'track_id': sample_tracks[0].id, 'action': 'master',
            'deck_id': 'all',
        })
        response = client.get('/api/study/next?deck_id=all', headers=auth_headers)
        assert json.loads(response.data)['correct_total'] == 1

    def test_reset_zeroes_tally(self, client, auth_headers, sample_tracks,
                                sample_deck):
        self._grade(client, auth_headers, {
            'track_id': sample_tracks[0].id, 'action': 'rate', 'rating': 'again',
            'deck_id': str(sample_deck.id),
        })
        client.post(f'/api/decks/{sample_deck.id}/reset', headers=auth_headers)
        response = client.get(f'/api/study/next?deck_id={sample_deck.id}',
                              headers=auth_headers)
        data = json.loads(response.data)
        assert data['correct_total'] == 0
        assert data['wrong_total'] == 0
