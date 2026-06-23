import nh3


class InputSanitizer:

    @staticmethod
    def sanitize_text(value: str, max_length: int = 256) -> str:
        """Strip null bytes and all HTML, truncate, and trim whitespace."""
        if not isinstance(value, str):
            return ""
        value = value.replace('\x00', '')[:max_length]
        value = nh3.clean(value, tags=set())
        return value.strip()
