import html
import re

_TAGS = re.compile(r"<[^>]*>")
_WS = re.compile(r"[ \t]+")


def clean_text(value: str) -> str:
    """Strip markup from third-party text. Content is data: it is never interpreted."""
    text = html.unescape(_TAGS.sub(" ", value))
    return "\n".join(_WS.sub(" ", line).strip() for line in text.splitlines()).strip()
