"""
embedder.py — 임베딩 및 FAISS 저장 모듈
팀메모리 프로젝트 / 담당: 이성우
"""

import os
import shutil
import pickle
import logging
import time
import numpy as np
from typing import Optional
from dotenv import load_dotenv
from openai import AzureOpenAI, APIConnectionError, APITimeoutError, RateLimitError

load_dotenv()
logger = logging.getLogger(__name__)

FAISS_DIR = os.getenv("FAISS_DIR", "./faiss_db")
BATCH_SIZE = 10
MAX_RETRIES = 3
RETRY_DELAY = 2  # 초


def _get_client() -> AzureOpenAI:
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01")

    if not api_key:
        raise EnvironmentError("[embedder] AZURE_OPENAI_API_KEY가 .env에 없습니다.")
    if not endpoint:
        raise EnvironmentError("[embedder] AZURE_OPENAI_ENDPOINT가 .env에 없습니다.")
    if not endpoint.startswith("https://"):
        raise ValueError(f"[embedder] ENDPOINT가 https://로 시작해야 합니다: {endpoint}")

    return AzureOpenAI(api_key=api_key, azure_endpoint=endpoint, api_version=api_version)


def _embed_with_retry(client: AzureOpenAI, texts: list[str], deployment: str) -> list:
    """API 호출 실패 시 최대 3회 재시도."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.embeddings.create(input=texts, model=deployment)
            return [r.embedding for r in response.data]
        except RateLimitError:
            wait = RETRY_DELAY * attempt
            logger.warning(f"[embedder] Rate limit 초과, {wait}초 후 재시도 ({attempt}/{MAX_RETRIES})")
            time.sleep(wait)
        except APITimeoutError:
            logger.warning(f"[embedder] 타임아웃, 재시도 ({attempt}/{MAX_RETRIES})")
            time.sleep(RETRY_DELAY)
        except APIConnectionError as e:
            raise ConnectionError(f"[embedder] Azure 연결 실패: {e}")

    raise RuntimeError(f"[embedder] {MAX_RETRIES}회 재시도 후 실패")


def embed_and_store(chunks: list[dict]) -> bool:
    """
    청크 리스트를 임베딩 후 FAISS에 저장.

    Args:
        chunks: chunker.py의 chunk_files_bulk() 결과
    Returns:
        성공 여부 (True/False)
    Raises:
        ValueError: chunks가 비어있을 때
        EnvironmentError: API 키/엔드포인트 누락 시
        ConnectionError: Azure 연결 실패 시
    """
    if not chunks:
        raise ValueError("[embedder] 저장할 청크가 없습니다.")

    import faiss

    client = _get_client()
    deployment = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-large")

    print(f"[embedder] {len(chunks)}개 청크 임베딩 시작...")
    print(f"[embedder] 배포: {deployment} / 저장 경로: {FAISS_DIR}")

    all_embeddings, all_texts, all_metadatas = [], [], []
    total = len(chunks)

    for i in range(0, total, BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        texts = [c["text"] for c in batch]
        metadatas = [c["metadata"] for c in batch]

        embeddings = _embed_with_retry(client, texts, deployment)

        all_embeddings.extend(embeddings)
        all_texts.extend(texts)
        all_metadatas.extend(metadatas)

        print(f"[embedder] 진행: {min(i + BATCH_SIZE, total)}/{total}개 완료")

    vectors = np.array(all_embeddings, dtype=np.float32)
    dimension = vectors.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(vectors)

    os.makedirs(FAISS_DIR, exist_ok=True)
    faiss.write_index(index, os.path.join(FAISS_DIR, "index.faiss"))

    with open(os.path.join(FAISS_DIR, "texts.pkl"), "wb") as f:
        pickle.dump(all_texts, f)
    with open(os.path.join(FAISS_DIR, "metadatas.pkl"), "wb") as f:
        pickle.dump(all_metadatas, f)

    print(f"[embedder] ✅ 전체 저장 완료! 벡터 수: {index.ntotal}개")
    return True


def reset_vectorstore():
    """FAISS DB 초기화."""
    if os.path.exists(FAISS_DIR):
        shutil.rmtree(FAISS_DIR)
        print(f"[embedder] FAISS DB 초기화 완료: {FAISS_DIR}")
    else:
        print(f"[embedder] 초기화할 DB가 없습니다.")


def get_index_count() -> int:
    """저장된 벡터 수 반환."""
    import faiss
    index_path = os.path.join(FAISS_DIR, "index.faiss")
    if not os.path.exists(index_path):
        return 0
    index = faiss.read_index(index_path)
    return index.ntotal


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    from app.ai.chunker import chunk_files_bulk

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
    ]

    print("=" * 50)
    print("embedder.py 테스트 (FAISS + 에러 핸들링)")
    print("=" * 50)

    chunks = chunk_files_bulk(TEST_FILES)
    reset_vectorstore()
    success = embed_and_store(chunks)

    if success:
        count = get_index_count()
        print(f"\n✅ FAISS에 저장된 벡터 수: {count}개")
