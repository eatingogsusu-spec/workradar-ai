from pathlib import Path


class FileParser:
    async def parse(self, path: Path) -> str:
        return path.read_text(encoding="utf-8", errors="ignore")
