"""Text normalization helpers."""

import re


def normalize(text: str) -> str:
    """Normalize whitespace before chunking and analysis."""
    text = re.sub(r"\s+", " ", text)
    return text.strip()

