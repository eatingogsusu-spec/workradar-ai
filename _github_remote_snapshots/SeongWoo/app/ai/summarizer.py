"""
summarizer.py — Azure OpenAI GPT 호출 및 구조화 출력 모듈
팀메모리 프로젝트 / 담당: 이성우
"""

import os
import json
import logging
import time
from dotenv import load_dotenv
from openai import AzureOpenAI, APIConnectionError, APITimeoutError, RateLimitError

load_dotenv()
logger = logging.getLogger(__name__)

GPT_MODEL = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4o")
MAX_TOKENS = 1500
MAX_RETRIES = 3
RETRY_DELAY = 2


def _get_client() -> AzureOpenAI:
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")

    if not api_key:
        raise EnvironmentError("[summarizer] AZURE_OPENAI_API_KEY가 .env에 없습니다.")
    if not endpoint:
        raise EnvironmentError("[summarizer] AZURE_OPENAI_ENDPOINT가 .env에 없습니다.")

    return AzureOpenAI(
        api_key=api_key,
        azure_endpoint=endpoint,
        api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01"),
    )


def _call_gpt(client: AzureOpenAI, prompt: str, max_tokens: int = MAX_TOKENS) -> str:
    """GPT 호출 + 재시도 로직."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.chat.completions.create(
                model=GPT_MODEL,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
            )
            return response.choices[0].message.content.strip()
        except RateLimitError:
            wait = RETRY_DELAY * attempt
            logger.warning(f"[summarizer] Rate limit, {wait}초 후 재시도 ({attempt}/{MAX_RETRIES})")
            time.sleep(wait)
        except APITimeoutError:
            logger.warning(f"[summarizer] 타임아웃, 재시도 ({attempt}/{MAX_RETRIES})")
            time.sleep(RETRY_DELAY)
        except APIConnectionError as e:
            raise ConnectionError(f"[summarizer] Azure 연결 실패: {e}")

    raise RuntimeError(f"[summarizer] {MAX_RETRIES}회 재시도 후 실패")


def _parse_json_response(raw: str, fallback: dict) -> dict:
    """GPT 응답에서 JSON 파싱. ```json ... ``` 마크다운도 처리."""
    if not raw:
        logger.warning("[summarizer] GPT 응답이 비어있습니다.")
        return fallback
    try:
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        result = json.loads(raw)
        logger.info("[summarizer] JSON 파싱 성공")
        print("[summarizer] JSON 파싱 성공")
        return result
    except json.JSONDecodeError as e:
        logger.error(f"[summarizer] JSON 파싱 실패: {e}\n원본 응답: {raw[:200]}")
        return fallback


def extract_todos(document_text: str) -> dict:
    """
    문서에서 Todo, 결정사항, 이슈를 자동 추출.

    Args:
        document_text: 원본 문서 텍스트
    Returns:
        {"todos": [...], "decisions": [...], "issues": [...]}
    Raises:
        ValueError: 문서가 비어있을 때
        ConnectionError: Azure 연결 실패 시
    """
    if not document_text or not document_text.strip():
        raise ValueError("[summarizer] 문서 텍스트가 비어있습니다.")
    if len(document_text) > 10000:
        logger.warning(f"[summarizer] 문서가 너무 깁니다 ({len(document_text)}자). 앞 10000자만 사용.")
        document_text = document_text[:10000]

    client = _get_client()
    prompt = f"""
다음 문서를 분석해서 정보를 추출해줘.

[문서 내용]
{document_text}

아래 JSON 형식으로만 답해줘. 다른 말은 하지 마.
추출할 수 없는 항목은 빈 배열로 반환해.

{{
  "todos": [
    {{"content": "할 일", "assignee": "담당자 또는 null", "due_date": "마감일 또는 null"}}
  ],
  "decisions": ["결정사항"],
  "issues": [
    {{"title": "이슈 제목", "description": "상세 설명", "severity": "high/medium/low"}}
  ]
}}

판단 기준:
- todos: "~해야 한다", "~할 것", "~까지 완료" 액션 아이템
- decisions: "~로 결정", "확정", "합의" 결정사항
- issues: "미결", "블로커", "논의 필요", "미지정" 리스크
"""
    print(f"[summarizer] extract_todos 시작 (문서 길이: {len(document_text)}자)")
    raw = _call_gpt(client, prompt)
    return _parse_json_response(raw, fallback={"todos": [], "decisions": [], "issues": []})


def answer_question(query: str, context: str) -> dict:
    """
    사용자 질문 + context로 챗봇 답변 생성.

    Args:
        query  : 사용자 질문
        context: retriever.build_context()의 반환값
    Returns:
        {"answer": str, "sources": list[str]}
    Raises:
        ValueError: 질문 또는 context가 비어있을 때
    """
    if not query or not query.strip():
        raise ValueError("[summarizer] 질문이 비어있습니다.")
    if not context or not context.strip():
        logger.warning("[summarizer] context가 비어있습니다. 관련 문서 없이 답변합니다.")
        context = "관련 문서를 찾을 수 없습니다."

    client = _get_client()
    prompt = f"""
너는 팀메모리 AI 어시스턴트야.
아래 문서 내용을 바탕으로 질문에 답해줘.
문서에 없는 내용은 "해당 내용을 찾을 수 없습니다"라고 답해.

[참고 문서]
{context}

[질문]
{query}

아래 JSON 형식으로만 답해줘. 다른 말은 하지 마.
{{
  "answer": "답변 (친절하고 명확하게, 한국어로)",
  "sources": ["참고한 문서 파일명들"]
}}
"""
    print(f"[summarizer] answer_question 시작: '{query}'")
    raw = _call_gpt(client, prompt, max_tokens=MAX_TOKENS)
    return _parse_json_response(raw, fallback={"answer": "답변을 생성할 수 없습니다.", "sources": []})


def summarize_document(document_text: str) -> dict:
    """
    문서를 3~5줄로 요약.

    Args:
        document_text: 원본 문서 텍스트
    Returns:
        {"summary": str, "keywords": list[str]}
    Raises:
        ValueError: 문서가 비어있을 때
    """
    if not document_text or not document_text.strip():
        raise ValueError("[summarizer] 문서 텍스트가 비어있습니다.")

    client = _get_client()
    prompt = f"""
다음 문서를 요약해줘.

[문서 내용]
{document_text}

아래 JSON 형식으로만 답해줘. 다른 말은 하지 마.
{{
  "summary": "핵심 내용 요약 (3~5줄, 한국어)",
  "keywords": ["핵심 키워드 최대 5개"]
}}
"""
    print(f"[summarizer] summarize_document 시작 (문서 길이: {len(document_text)}자)")
    raw = _call_gpt(client, prompt, max_tokens=500)
    return _parse_json_response(raw, fallback={"summary": "요약을 생성할 수 없습니다.", "keywords": []})


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    from app.ai.retriever import retrieve, build_context

    TEST_FILE = "dummy/documents/meeting_2026_05_11_final.txt"

    print("=" * 50)
    print("summarizer.py 테스트 (에러 핸들링 포함)")
    print("=" * 50)

    # 빈 문서 오류 테스트
    try:
        extract_todos("")
    except ValueError as e:
        print(f"✅ 빈 문서 오류 정상 처리: {e}")

    # 빈 질문 오류 테스트
    try:
        answer_question("", "context")
    except ValueError as e:
        print(f"✅ 빈 질문 오류 정상 처리: {e}")

    with open(TEST_FILE, "r", encoding="utf-8") as f:
        document_text = f.read()

    print("\n[테스트 1] extract_todos")
    print("-" * 40)
    result = extract_todos(document_text)
    print(json.dumps(result, ensure_ascii=False, indent=2))

    print("\n[테스트 2] summarize_document")
    print("-" * 40)
    summary = summarize_document(document_text)
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    print("\n[테스트 3] answer_question (RAG)")
    print("-" * 40)
    query = "이성우가 해야 할 일이 뭐야?"
    results = retrieve(query, top_k=3)
    context = build_context(results)
    answer = answer_question(query, context)
    print(json.dumps(answer, ensure_ascii=False, indent=2))

    print("\n✅ 전체 AI 파이프라인 테스트 완료!")
