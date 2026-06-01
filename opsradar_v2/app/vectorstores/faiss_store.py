from pathlib import Path

from app.core.config import settings


class FaissStore:
    def __init__(self, base_dir: Path | None = None) -> None:
        self.base_dir = base_dir or settings.FAISS_DATA_DIR
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def index_path(self, project_id: str) -> Path:
        project_dir = self.base_dir / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        return project_dir / "index.faiss"
