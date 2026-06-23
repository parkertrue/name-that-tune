"""Fuzzy answer matching for study grading.

Python port of the prototype's client-side matcher (norm / fuz / matchOne /
chk). Kept pure and dependency-free so it can be unit-tested in isolation.
"""
import re

# Token overlap ratio required for a fuzzy match (prototype's 0.6).
FUZZY_THRESHOLD = 0.6

_NON_ALNUM = re.compile(r'[^a-z0-9\s]')
_WHITESPACE = re.compile(r'\s+')


def normalize(value: str) -> str:
    """Lowercase, strip non-alphanumerics, collapse whitespace."""
    if not isinstance(value, str):
        return ""
    value = value.lower()
    value = _NON_ALNUM.sub('', value)
    value = _WHITESPACE.sub(' ', value)
    return value.strip()


def fuzzy(a: str, b: str) -> bool:
    """True when the shared-token ratio meets the threshold (prototype `fuz`).

    Both inputs are expected to be already normalized.
    """
    words_a = [w for w in a.split(' ') if w]
    words_b = [w for w in b.split(' ') if w]
    if not words_a or not words_b:
        return False
    matched = [
        w for w in words_a
        if any(w in bw or bw in w for bw in words_b)
    ]
    return len(matched) >= min(len(words_a), len(words_b)) * FUZZY_THRESHOLD


def match_one(guess: str, actual: str) -> bool:
    """Match a single field: substring either way, or fuzzy (prototype `matchOne`)."""
    g = normalize(guess)
    a = normalize(actual)
    if not g:
        return False
    return a in g or g in a or fuzzy(g, a)


def grade(guess_artists: list[str], guess_title: str, actual_artists: list[str],
          actual_title: str) -> bool:
    """Grade a full guess (prototype `chk`).

    Title must match. The player must name *every* actual artist: each supplied
    guess field must be non-empty and match a distinct actual artist, and all
    actual artists must be accounted for.
    """
    if not match_one(guess_title or "", actual_title):
        return False

    remaining = list(actual_artists)
    for guess in guess_artists:
        if not (guess and guess.strip()):
            return False
        match_idx = next(
            (i for i, actual in enumerate(remaining) if match_one(guess, actual)),
            -1,
        )
        if match_idx < 0:
            return False
        remaining.pop(match_idx)

    # Every actual artist must have been matched by a guess.
    return not remaining
