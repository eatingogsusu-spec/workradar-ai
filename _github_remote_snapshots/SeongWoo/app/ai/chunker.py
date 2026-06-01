"""
chunker.py — 문서 유형별 청킹 모듈
팀메모리 프로젝트 / 담당: 이성우
"""

import os
import re
import csv
import io
import logging
from typing import Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
SEPARATORS = ["\n\n", "\n", ". ", ", ", " ", ""]


def _chunk_meeting(text: str, metadata: dict) -> list[dict]:
    sections = re.split(r"\n---+\n", text)
    chunks = []
    for i, section in enumerate(sections):
        section = section.strip()
        if not section:
            continue
        chunks.append({"text": section, "metadata": {**metadata, "chunk_index": i, "chunk_type": "section"}})
    logger.info(f"meeting → {len(chunks)}개 섹션 청크")
    return chunks


def _chunk_email(text: str, metadata: dict) -> list[dict]:
    pattern = r"===EMAIL_START===(.*?)===EMAIL_END==="
    emails = re.findall(pattern, text, re.DOTALL)
    chunks = []
    for i, email in enumerate(emails):
        email = email.strip()
        if not email:
            continue
        chunks.append({"text": email, "metadata": {**metadata, "chunk_index": i, "chunk_type": "email"}})
    logger.info(f"email → {len(chunks)}개 이메일 청크")
    return chunks


def _chunk_chat(text: str, metadata: dict) -> list[dict]:
    pattern = r"===DATE: (.+?)===\n===ISSUE: (.+?)===\n(.*?)===ISSUE_END==="
    matches = re.findall(pattern, text, re.DOTALL)
    chunks = []
    for i, (date, issue, content) in enumerate(matches):
        content = content.strip()
        if not content:
            continue
        chunk_text = f"[{date} / {issue}]\n{content}"
        chunks.append({"text": chunk_text, "metadata": {**metadata, "chunk_index": i, "chunk_type": "chat_issue", "date": date.strip(), "issue": issue.strip()}})
    logger.info(f"chat → {len(chunks)}개 이슈 묶음 청크")
    return chunks


def _chunk_csv(text: str, metadata: dict) -> list[dict]:
    reader = csv.DictReader(io.StringIO(text))
    chunks = []
    for i, row in enumerate(reader):
        row_text = " / ".join([f"{k}: {v}" for k, v in row.items() if v])
        if not row_text.strip():
            continue
        chunks.append({"text": row_text, "metadata": {**metadata, "chunk_index": i, "chunk_type": "csv_row"}})
    logger.info(f"csv → {len(chunks)}개 row 청크")
    return chunks


def _chunk_handover(text: str, metadata: dict) -> list[dict]:
    pattern = r"===SECTION: (.+?)===\n(.*?)===SECTION_END==="
    matches = re.findall(pattern, text, re.DOTALL)
    chunks = []
    for i, (section_title, content) in enumerate(matches):
        content = content.strip()
        if not content:
            continue
        chunk_text = f"[{section_title.strip()}]\n{content}"
        chunks.append({"text": chunk_text, "metadata": {**metadata, "chunk_index": i, "chunk_type": "section", "section_title": section_title.strip()}})
    logger.info(f"handover → {len(chunks)}개 섹션 청크")
    return chunks


def _chunk_default(text: str, metadata: dict) -> list[dict]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP,
        separators=SEPARATORS, length_function=len
    )
    raw_chunks = splitter.split_text(text)
    chunks = []
    for i, chunk_text in enumerate(raw_chunks):
        chunk_text = chunk_text.strip()
        if not chunk_text:
            continue
        chunks.append({"text": chunk_text, "metadata": {**metadata, "chunk_index": i, "chunk_type": "text"}})
    logger.info(f"default → {len(chunks)}개 균일 청크")
    return chunks


CHUNKER_MAP = {
    "meeting":  _chunk_meeting,
    "email":    _chunk_email,
    "chat":     _chunk_chat,
    "csv":      _chunk_csv,
    "handover": _chunk_handover,
    "report":   _chunk_default,
}


def chunk_file(
    file_path: str,
    document_id: Optional[int] = None,
    doc_type: Optional[str] = None,
    encoding: str = "utf-8",
) -> list[dict]:
    """
    파일을 읽어 유형에 맞게 청킹.

    Raises:
        FileNotFoundError: 파일이 존재하지 않을 때
        ValueError: 파일이 비어있을 때
        UnicodeDecodeError: 인코딩 오류 시 cp949로 재시도
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"[chunker] 파일을 찾을 수 없습니다: {file_path}")

    # 인코딩 오류 시 cp949(한국어 윈도우)로 재시도
    try:
        with open(file_path, "r", encoding=encoding) as f:
            text = f.read()
    except UnicodeDecodeError:
        logger.warning(f"UTF-8 실패, cp949로 재시도: {file_path}")
        try:
            with open(file_path, "r", encoding="cp949") as f:
                text = f.read()
        except UnicodeDecodeError as e:
            raise UnicodeDecodeError(
                e.encoding, e.object, e.start, e.end,
                f"[chunker] 파일 인코딩 오류: {file_path}"
            )

    if not text.strip():
        raise ValueError(f"[chunker] 파일이 비어있습니다: {file_path}")

    filename = os.path.basename(file_path)
    if doc_type is None:
        doc_type = _infer_doc_type(filename)

    date = _extract_date_from_filename(filename)
    metadata = {
        "source": filename,
        "file_name": filename,
        "file_path": file_path,
        "doc_type": doc_type,
    }
    if document_id is not None:
        metadata["document_id"] = document_id
    if date:
        metadata["date"] = date

    logger.info(f"파일 읽기 완료: {filename} ({len(text)}자) / 유형: {doc_type}")
    print(f"[chunker] 파일 읽기 완료: {filename} ({len(text)}자) / 유형: {doc_type}")

    chunker_fn = CHUNKER_MAP.get(doc_type, _chunk_default)
    chunks = chunker_fn(text, metadata)

    if not chunks:
        logger.warning(f"청크가 생성되지 않았습니다: {file_path}")

    return chunks


def chunk_files_bulk(file_list: list[dict]) -> list[dict]:
    """
    여러 파일을 한꺼번에 청킹.
    개별 파일 오류 시 해당 파일은 건너뛰고 계속 진행.
    """
    if not file_list:
        raise ValueError("[chunker] file_list가 비어있습니다.")

    all_chunks = []
    errors = []

    for file_info in file_list:
        file_path = file_info.get("file_path", "")
        try:
            chunks = chunk_file(
                file_path=file_path,
                document_id=file_info.get("document_id"),
                doc_type=file_info.get("doc_type"),
            )
            all_chunks.extend(chunks)
        except FileNotFoundError as e:
            logger.error(str(e))
            errors.append(file_path)
        except ValueError as e:
            logger.error(str(e))
            errors.append(file_path)
        except Exception as e:
            logger.error(f"[chunker] 예상치 못한 오류 ({file_path}): {e}")
            errors.append(file_path)

    if errors:
        print(f"[chunker] 경고: {len(errors)}개 파일 처리 실패 → {errors}")

    print(f"[chunker] 전체 {len(file_list)}개 파일 → 총 {len(all_chunks)}개 청크")
    return all_chunks


def _infer_doc_type(filename: str) -> str:
    filename = filename.lower()
    if filename.startswith("meeting"): return "meeting"
    if filename.startswith("email"): return "email"
    if filename.startswith("chat"): return "chat"
    if filename.endswith(".csv"): return "csv"
    if filename.startswith("handover"): return "handover"
    if filename.startswith("report"): return "report"
    return "report"


def _extract_date_from_filename(filename: str) -> Optional[str]:
    match = re.search(r"(\d{4})_(\d{2})_(\d{2})", filename)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    return None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    TEST_FILES = [
        {"file_path": "dummy/documents/meeting_2026_05_07_kickoff.txt",      "document_id": 1,  "doc_type": "meeting"},
        {"file_path": "dummy/documents/meeting_2026_05_08_topic2.txt",       "document_id": 2,  "doc_type": "meeting"},
        {"file_path": "dummy/documents/meeting_2026_05_11_topic3.txt",       "document_id": 3,  "doc_type": "meeting"},
        {"file_path": "dummy/documents/meeting_2026_05_11_final.txt",        "document_id": 4,  "doc_type": "meeting"},
        {"file_path": "dummy/documents/meeting_2026_05_13_week2_check.txt",  "document_id": 5,  "doc_type": "meeting"},
        {"file_path": "dummy/documents/report_2026_05_13_sungwoo_week2.txt", "document_id": 6,  "doc_type": "report"},
        {"file_path": "dummy/documents/email_2026_05_08_12.txt",             "document_id": 7,  "doc_type": "email"},
        {"file_path": "dummy/documents/chat_2026_05_11_13.txt",              "document_id": 8,  "doc_type": "chat"},
        {"file_path": "dummy/documents/tasks_2026_05_week2.csv",             "document_id": 9,  "doc_type": "csv"},
        {"file_path": "dummy/documents/handover_2026_05_13.txt",             "document_id": 10, "doc_type": "handover"},
        {"file_path": "dummy/documents/없는파일.txt",                          "document_id": 99, "doc_type": "meeting"},  # 오류 테스트
    ]

    print("=" * 50)
    print("chunker.py 에러 핸들링 테스트")
    print("=" * 50)

    all_chunks = chunk_files_bulk(TEST_FILES)

    from collections import Counter
    print("\n--- 유형별 청크 수 ---")
    type_counts = Counter(c["metadata"]["doc_type"] for c in all_chunks)
    for doc_type, count in type_counts.items():
        print(f"  {doc_type}: {count}개")
    print(f"\n✅ 완료: 총 {len(all_chunks)}개 청크 (없는파일은 건너뜀)")
