import html

import nh3


class InputSanitizer:

    @staticmethod
    def sanitize_text(value: str, max_length: int = 256) -> str:
        """Strip null bytes and all HTML, truncate, and trim whitespace.

        Output is plain text, not HTML: entities are decoded before stripping
        (so entity-encoded markup like ``&lt;script&gt;`` is also removed) and
        again afterwards (so real characters such as ``&`` in "Brooks & Dunn"
        survive verbatim instead of nh3's HTML-escaped ``&amp;``).
        """
        if not isinstance(value, str):
            return ""
        value = value.replace('\x00', '')[:max_length]
        value = html.unescape(value)
        value = nh3.clean(value, tags=set())
        value = html.unescape(value)
        return value.strip()
