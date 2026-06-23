from app.utils import matching


class TestNormalize:
    def test_lowercases(self):
        assert matching.normalize("HELLO") == "hello"

    def test_strips_punctuation(self):
        assert matching.normalize("Crazy in Love!") == "crazy in love"

    def test_collapses_whitespace(self):
        assert matching.normalize("  a   b  ") == "a b"

    def test_non_string_returns_empty(self):
        assert matching.normalize(None) == ""


class TestMatchOne:
    def test_exact_match(self):
        assert matching.match_one("Queen", "Queen") is True

    def test_case_and_punctuation_insensitive(self):
        assert matching.match_one("queen!", "Queen") is True

    def test_substring_match(self):
        # Guess is a substring of the actual title.
        assert matching.match_one("bohemian", "Bohemian Rhapsody") is True

    def test_empty_guess_is_false(self):
        assert matching.match_one("", "Queen") is False

    def test_unrelated_is_false(self):
        assert matching.match_one("Madonna", "Queen") is False


class TestGrade:
    def test_correct_single_artist(self):
        assert matching.grade(["Queen"], "Bohemian Rhapsody",
                              ["Queen"], "Bohemian Rhapsody") is True

    def test_wrong_title_fails(self):
        assert matching.grade(["Queen"], "Wrong Title",
                              ["Queen"], "Bohemian Rhapsody") is False

    def test_wrong_artist_fails(self):
        assert matching.grade(["Madonna"], "Bohemian Rhapsody",
                              ["Queen"], "Bohemian Rhapsody") is False

    def test_multiple_artists_correct_any_order(self):
        assert matching.grade(["Jay-Z", "Beyonce"], "Crazy in Love",
                              ["Beyonce", "Jay-Z"], "Crazy in Love") is True

    def test_missing_artist_field_fails(self):
        # Only one artist supplied for a two-artist track -> must name both.
        assert matching.grade(["Beyonce"], "Crazy in Love",
                              ["Beyonce", "Jay-Z"], "Crazy in Love") is False

    def test_empty_artist_field_fails(self):
        assert matching.grade(["Beyonce", ""], "Crazy in Love",
                              ["Beyonce", "Jay-Z"], "Crazy in Love") is False

    def test_duplicate_guess_consumes_distinct_actuals(self):
        # Guessing the same artist twice should not match a single actual twice.
        assert matching.grade(["Queen", "Queen"], "Song",
                              ["Queen", "David Bowie"], "Song") is False

    def test_fuzzy_title_match(self):
        # Minor wording differences still pass via token overlap.
        assert matching.grade(["Queen"], "Bohemian Rhapsody live",
                              ["Queen"], "Bohemian Rhapsody") is True
