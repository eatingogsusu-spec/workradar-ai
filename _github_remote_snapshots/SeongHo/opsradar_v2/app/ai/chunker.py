class TextChunker:
    def __init__(self, chunk_size: int = 1200, overlap: int = 120) -> None:
        self.chunk_size = chunk_size
        self.overlap = overlap

    def split(self, text: str) -> list[str]:
        chunks: list[str] = []
        start = 0
        while start < len(text):
            end = start + self.chunk_size
            chunks.append(text[start:end].strip())
            if end >= len(text):
                break
            start = max(end - self.overlap, start + 1)
        return [chunk for chunk in chunks if chunk]
