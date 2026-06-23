from app.models import Track
from app.models.track import (
    INITIAL_EASE, MIN_EASE, GRADUATION_INTERVAL, quality_for_rating,
)


class TestTrackArtists:
    def test_artists_roundtrip(self, db, sample_deck):
        track = Track(deck_id=sample_deck.id, title='Song',
                      artists=['A', 'B'])
        db.session.add(track)
        db.session.commit()
        db.session.refresh(track)
        assert track.artists == ['A', 'B']

    def test_default_sm2_state(self, db, sample_deck):
        track = Track(deck_id=sample_deck.id, title='Song', artists=['A'])
        db.session.add(track)
        db.session.commit()
        db.session.refresh(track)
        assert track.ease_factor == INITIAL_EASE
        assert track.interval == 0
        assert track.repetitions == 0
        assert track.mastered is False


class TestQualityForRating:
    def test_mapping(self):
        assert quality_for_rating('again') < 3
        assert quality_for_rating('hard') >= 3
        assert quality_for_rating('good') >= 3
        assert quality_for_rating('easy') >= 3
        # Easy is the strongest signal, again the weakest.
        assert quality_for_rating('easy') > quality_for_rating('good')
        assert quality_for_rating('good') > quality_for_rating('hard')


class TestApplyReview:
    def _new(self, sample_deck):
        return Track(deck_id=sample_deck.id, title='S', artists=['A'])

    def test_first_correct_sets_interval_one(self, sample_deck):
        track = self._new(sample_deck)
        track.apply_review(quality_for_rating('good'))
        assert track.interval == 1
        assert track.repetitions == 1
        assert track.mastered is False

    def test_second_correct_sets_interval_six(self, sample_deck):
        track = self._new(sample_deck)
        track.apply_review(quality_for_rating('good'))
        track.apply_review(quality_for_rating('good'))
        assert track.interval == 6
        assert track.repetitions == 2

    def test_third_correct_multiplies_by_ease(self, sample_deck):
        track = self._new(sample_deck)
        for _ in range(3):
            track.apply_review(quality_for_rating('good'))
        # interval 6 * ease 2.5 = 15
        assert track.interval == 15
        assert track.repetitions == 3

    def test_good_keeps_ease(self, sample_deck):
        track = self._new(sample_deck)
        track.apply_review(quality_for_rating('good'))
        assert track.ease_factor == INITIAL_EASE

    def test_easy_raises_ease(self, sample_deck):
        track = self._new(sample_deck)
        track.apply_review(quality_for_rating('easy'))
        assert track.ease_factor > INITIAL_EASE

    def test_hard_lowers_ease(self, sample_deck):
        track = self._new(sample_deck)
        track.apply_review(quality_for_rating('hard'))
        assert track.ease_factor < INITIAL_EASE

    def test_again_resets_to_lapse(self, sample_deck):
        track = self._new(sample_deck)
        for _ in range(3):  # interval grows to 15, reps 3
            track.apply_review(quality_for_rating('good'))
        track.apply_review(quality_for_rating('again'))
        assert track.interval == 1
        assert track.repetitions == 0
        assert track.ease_factor < INITIAL_EASE

    def test_ease_floored_at_min(self, sample_deck):
        track = self._new(sample_deck)
        for _ in range(20):
            track.apply_review(quality_for_rating('again'))
        assert track.ease_factor == MIN_EASE

    def test_graduates_at_threshold(self, sample_deck):
        track = self._new(sample_deck)
        # 1 -> 6 -> 15 -> 38 graduates on the 4th good review.
        for _ in range(3):
            track.apply_review(quality_for_rating('good'))
        assert track.mastered is False
        track.apply_review(quality_for_rating('good'))
        assert track.interval >= GRADUATION_INTERVAL
        assert track.mastered is True

    def test_graduate_shortcut(self, sample_deck):
        track = self._new(sample_deck)
        track.graduate()
        assert track.interval == GRADUATION_INTERVAL
        assert track.mastered is True

    def test_selection_weight_favors_new_cards(self, sample_deck):
        new = self._new(sample_deck)
        seen = self._new(sample_deck)
        seen.interval = 10
        assert new.selection_weight() > seen.selection_weight()
        assert seen.selection_weight() >= 1
