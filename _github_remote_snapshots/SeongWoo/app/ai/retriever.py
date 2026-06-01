"""
retriever.py — RAG 검색 모듈
팀메모리 프로젝트 / 담당: 이성우
"""

import os
import pickle
import logging
import numpy as np
from typing import Optional
from dotenv import load_dotenv
from openai import AzureOpenAI, APIConnectionError, APITimeoutError, RateLimitError

load_dotenv()
logger = logging.getLogger(__name__)

FAISS_DIR = os.getenv("FAISS_DIR", "./faiss_db")
DEFAULT_TOP_K = 3


def _get_client() -> AzureOpenAI:
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")

    if not api_key:
        raise EnvironmentError("[retriever] AZURE_OPENAI_API_KEY가 .env에 없습니다.")
    if not endpoint:
        raise EnvironmentError("[retriever] AZURE_OPENAI_ENDPOINT가 .env에 없습니다.")

    return AzureOpenAI(
        api_key=api_key,
        azure_endpoint=endpoint,
        api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01"),
    )


def _load_index():
    """FAISS 인덱스 및 텍스트/메타데이터 불러오기."""
    import faiss

    required_files = ["index.faiss", "texts.pkl", "metadatas.pkl"]
    missing = [f for f in required_files if not os.path.exists(os.path.join(FAISS_DIR, f))]

    if missing:
        raise FileNotFoundError(
            f"[retriever] FAISS DB 파일 누락: {missing}\n"
            f"  → python -m app.ai.embedder 를 먼저 실행하세요."
        )

    index = faiss.read_index(os.path.join(FAISS_DIR, "index.faiss"))
    with open(os.path.join(FAISS_DIR, "texts.pkl"), "rb") as f:
        texts = pickle.load(f)
    with open(os.path.join(FAISS_DIR, "metadatas.pkl"), "rb") as f:
        metadatas = pickle.load(f)

    if index.ntotal == 0:
        raise ValueError("[retriever] FAISS DB가 비어있습니다. embedder를 다시 실행하세요.")

    return index, texts, metadatas


def retrieve(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    doc_type: Optional[str] = None,
    document_id: Optional[int] = None,
) -> list[dict]:
    """
    질문을 받아서 FAISS에서 가장 관련있는 청크를 반환.

    Args:
        query       : 사용자 질문
        top_k       : 가져올 청크 수 (기본 3개)
        doc_type    : 필터 (meeting/email/chat/csv/handover/report)
        document_id : 특정 문서 ID 필터

    Returns:
        [{"text": str, "score": float, "metadata": dict}, ...]

    Raises:
        ValueError: 빈 질문 또는 top_k 오류
        FileNotFoundError: FAISS DB 없음
        ConnectionError: Azure 연결 실패
    """
    if not query or not query.strip():
        raise ValueError("[retriever] 질문이 비어있습니다.")
    if top_k < 1 or top_k > 20:
        raise ValueError(f"[retriever] top_k는 1~20 사이여야 합니다: {top_k}")

    index, texts, metadatas = _load_index()

    print(f"[retriever] 검색 시작: '{query}' (top_k={top_k})")

    client = _get_client()
    deployment = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-large")

    try:
        response = client.embeddings.create(input=query, model=deployment)
    except APIConnectionError as e:
        raise ConnectionError(f"[retriever] Azure 연결 실패: {e}")
    except APITimeoutError:
        raise TimeoutError("[retriever] Azure API 타임아웃. 잠시 후 재시도하세요.")
    except RateLimitError:
        raise RuntimeError("[retriever] API 요청 한도 초과. 잠시 후 재시도하세요.")

    query_vector = np.array([response.data[0].embedding], dtype=np.float32)
    search_k = min(top_k * 10 if (doc_type or document_id) else top_k, index.ntotal)
    distances, indices = index.search(query_vector, search_k)

    output = []
    for dist, idx in zip(distances[0], indices[0]):
        if idx == -1:
            continue

        metadata = metadatas[idx]

        if doc_type and metadata.get("doc_type") != doc_type:
            continue
        if document_id and metadata.get("document_id") != document_id:
            continue

        output.append({
            "text": texts[idx],
            "score": round(float(1 / (1 + dist)), 4),
            "metadata": metadata,
            # 편의 접근용 (summarizer에서 바로 쓸 수 있도록)
            "source": metadata.get("source", ""),
            "file_name": metadata.get("file_name", metadata.get("source", "")),
            "document_id": metadata.get("document_id"),
            "doc_type": metadata.get("doc_type", ""),
            "date": metadata.get("date", ""),
        })

        if len(output) >= top_k:
            break

    print(f"[retriever] {len(output)}개 청크 검색 완료")
    for i, r in enumerate(output):
        print(f"  #{i+1} 유사도: {r['score']} | 출처: {r['source']}")

    return output


def retrieve_by_type(query: str, doc_type: str, top_k: int = DEFAULT_TOP_K) -> list[dict]:
    """특정 문서 유형에서만 검색."""
    valid_types = {"meeting", "email", "chat", "csv", "handover", "report"}
    if doc_type not in valid_types:
        raise ValueError(f"[retriever] 유효하지 않은 doc_type: {doc_type}. 가능한 값: {valid_types}")
    return retrieve(query, top_k=top_k, doc_type=doc_type)


def retrieve_by_document(query: str, document_id: int, top_k: int = DEFAULT_TOP_K) -> list[dict]:
    """특정 문서에서만 검색."""
    if document_id < 1:
        raise ValueError(f"[retriever] document_id는 1 이상이어야 합니다: {document_id}")
    return retrieve(query, top_k=top_k, document_id=document_id)


def build_context(results: list[dict]) -> str:
    """retrieve() 결과를 GPT에게 넘길 context 문자열로 변환."""
    if not results:
        return ""
    context_parts = []
    for r in results:
        source = r.get("source") or r["metadata"].get("source", "알 수 없음")
        date = r.get("date") or r["metadata"].get("date", "")
        date_str = f" ({date})" if date else ""
        context_parts.append(f"[출처: {source}{date_str}]\n{r['text']}")
    return "\n\n".join(context_parts)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    TEST_QUERIES = [
        "이번 프로젝트에서 결정된 기술 스택이 뭐야?",
        "이성우가 해야 할 일이 뭐야?",
        "이슈가 뭐가 있어?",
        "서비스 이름이 뭐야?",
    ]

    print("=" * 50)
    print("retriever.py 테스트 (에러 핸들링 포함)")
    print("=" * 50)

    # 빈 질문 테스트
    try:
        retrieve("")
    except ValueError as e:
        print(f"✅ 빈 질문 오류 정상 처리: {e}")

    # 잘못된 top_k 테스트
    try:
        retrieve("테스트", top_k=99)
    except ValueError as e:
        print(f"✅ top_k 오류 정상 처리: {e}")

    # 잘못된 doc_type 테스트
    try:
        retrieve_by_type("테스트", doc_type="invalid")
    except ValueError as e:
        print(f"✅ doc_type 오류 정상 처리: {e}")

    print()
    for query in TEST_QUERIES:
        print(f"\n질문: {query}")
        print("-" * 40)
        results = retrieve(query, top_k=3)
        if results:
            context = build_context(results)
            print("\n[GPT에게 넘길 context]")
            print(context[:300] + "..." if len(context) > 300 else context)

    print("\n✅ retriever.py 테스트 완료")
