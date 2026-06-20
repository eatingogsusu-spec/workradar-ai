"""File parsing helpers for the OpsRadar AI pipeline."""

from __future__ import annotations

import csv
import io
from pathlib import Path


SUPPORTED_EXTENSIONS = {".txt", ".csv", ".pdf", ".docx", ".md", ".markdown"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024


def parse_file(file_path: str | Path) -> tuple[str, str]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"file not found: {path}")

    size = path.stat().st_size
    if size > MAX_FILE_SIZE_BYTES:
        raise ValueError("file size exceeds 10MB")

    ext = path.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"unsupported file extension: {ext}")

    if ext in (".txt", ".md", ".markdown"):
        text = _parse_text(path)
    elif ext == ".csv":
        text = _parse_csv(path)
    elif ext == ".pdf":
        text = _parse_pdf(path)
    else:
        text = _parse_docx(path)

    if not text.strip():
        raise ValueError("file has no extractable text")

    return text, infer_doc_type(path.name)


def infer_doc_type(filename: str) -> str:
    name = filename.lower()
    if any(token in name for token in ("meeting", "minutes", "회의", "회의록")):
        return "meeting"
    if any(token in name for token in ("email", "mail", "메일")):
        return "email"
    if any(token in name for token in ("chat", "slack", "채팅", "대화")):
        return "chat"
    if name.endswith(".csv") or any(token in name for token in ("task", "todo", "업무", "할일")):
        return "csv"
    if any(token in name for token in ("handover", "onboard", "인수인계")):
        return "handover"
    if any(token in name for token in ("report", "status", "보고", "보고서")):
        return "report"
    return "report"


def _parse_text(path: Path) -> str:
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "utf-8", "cp949", "euc-kr", "utf-16", "utf-16-le", "utf-16-be"):
        try:
            return _repair_mojibake(raw.decode(encoding))
        except (UnicodeDecodeError, UnicodeError):
            continue
    raise RuntimeError("failed to decode text file")


def _repair_mojibake(text: str) -> str:
    """Repair common UTF-8 text accidentally decoded as Latin-1/CP1252."""
    if not _looks_mojibake(text):
        return text
    for encoding in ("latin1", "cp1252"):
        try:
            repaired = text.encode(encoding).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        if _score_readability(repaired) > _score_readability(text):
            return repaired
    return text


def _looks_mojibake(text: str) -> bool:
    markers = ("Ã", "Â", "ì", "ë", "í", "ê", "ï»¿", "�")
    return any(marker in text for marker in markers)


def _score_readability(text: str) -> int:
    korean = sum(1 for char in text if "\uac00" <= char <= "\ud7a3")
    mojibake = sum(text.count(marker) for marker in ("Ã", "Â", "ì", "ë", "í", "ê", "ï»¿", "�"))
    return korean * 3 - mojibake * 5


def _parse_csv(path: Path) -> str:
    content = _parse_text(path)
    reader = csv.DictReader(io.StringIO(content))
    lines = []
    for row in reader:
        line = " / ".join(f"{key}: {value}" for key, value in row.items() if value)
        if line.strip():
            lines.append(line)
    return "\n".join(lines) if lines else content


def _parse_pdf(path: Path) -> str:
    try:
        import fitz

        doc = fitz.open(str(path))
        pages = []
        for page_number, page in enumerate(doc, start=1):
            page_text = page.get_text()
            if page_text.strip():
                pages.append(f"[page {page_number}]\n{page_text}")
        doc.close()
        if pages:
            return "\n\n".join(pages)
    except ImportError:
        pass

    try:
        from PyPDF2 import PdfReader

        reader = PdfReader(str(path))
        pages = []
        for page_number, page in enumerate(reader.pages, start=1):
            page_text = page.extract_text()
            if page_text and page_text.strip():
                pages.append(f"[page {page_number}]\n{page_text}")
        return "\n\n".join(pages)
    except ImportError as exc:
        raise RuntimeError("missing PDF parser package") from exc


def _parse_docx(path: Path) -> str:
    try:
        from docx import Document
    except ImportError as exc:
        raise RuntimeError("missing python-docx package") from exc

    doc = Document(str(path))
    return "\n".join(paragraph.text.strip() for paragraph in doc.paragraphs if paragraph.text.strip())
