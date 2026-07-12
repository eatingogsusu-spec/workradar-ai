"""AI handover document drafting — mirrors report_draft_service pattern."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.ai.llm_client import AzureOpenAIConfigError, chat_completion
from app.core.config import settings


logger = logging.getLogger(__name__)


SYSTEM_PROMPT = (
    "너는 운영 인수인계 문서를 작성하는 어시스턴트다. "
    "제공된 업무 데이터에만 근거해 작성하고, "
    "데이터에 없는 내용은 절대 지어내지 마라. "
    "추측이 필요하면 '확인 필요'로 표기. "
    "grounding JSON의 todos 배열에 실제로 존재하는 항목만 '업무'로 적어라. "
    "이슈를 업무로 바꿔 적거나, 없는 Todo를 만들지 마라. "
    "데이터에 없으면 '없음'으로 표기하는 것이 지어내는 것보다 항상 낫다. "
    "이슈를 누락하는 것은 업무를 지어내는 것만큼 나쁘다. "
    "모든 이슈는 남기되, 없는 Todo는 만들지 마라."
)

HANDOVER_PROMPT = """다음은 {owner}님이 {receiver}님에게 인계하는 업무 데이터입니다.
후임자가 이 문서만 읽고 업무를 즉시 파악할 수 있도록, 아래 4개 섹션으로 작성하세요.

## 1. 인수인계 개요 (3~4문장)
- 이 담당자가 주로 어떤 고객사/품목/이슈를 다뤘는지 맥락으로 요약.
- 단순 나열 금지. 업무들을 엮어서 "무슨 상황인지" 서술.
- 데이터에 근거 없는 일반적 조언("추가 지원 필요", "안정화 필요" 등)은 쓰지 마라. 구체적 근거가 있을 때만 서술.

## 2. 우선순위 및 즉시 조치 사항
- 후임자가 먼저 손대야 할 순서대로. High 우선순위와 마감 임박 건을 앞에.
- 각 항목: [무엇을] [왜 급한지] [다음 액션].
- 가장 시급한 1순위는 왜 나머지보다 먼저인지 한 문장으로 명시하라(예: "재발 시 분기 전체 납품 중단 위험이라 최우선").

## 3. 진행 중 업무 및 이슈 (인과 관계 중심)
- Todo와 이슈를 별도 목록으로 나열하지 마라. 대신 "이슈 → 그로 인해 생긴 Todo" 형태로 묶어서 서술하라.
- 예시 형식(아래 대괄호 값은 형식 설명용 자리표시자다. 실제 값은 grounding JSON에서만 가져와라):
    ▸ [이슈] [이슈 제목] ([담당자명])
      └ 원인: [grounding의 risk_reason]
      └ 이 이슈로 생긴 업무:
          · [Todo 제목] ([담당자명], [우선순위])
          · [Todo 제목] ([담당자명])
      └ 근거: [문서명]
- 이슈와 직접 연결 안 되는 독립 Todo는 마지막에 "기타 진행 업무"로 모아라.
- 같은 품목/고객사 건은 묶어서 보여줘 후임자가 패턴을 보게 하라.
- grounding의 모든 이슈는 빠짐없이 §3에 항목으로 남겨라. 어떤 이슈도 누락하지 마라. 이슈에 연결된 Todo가 없으면, 그 이슈를 삭제하지 말고 반드시 이렇게 남겨라:
    ▸ [이슈] (이슈 제목) (담당자)
      └ 원인/상태: (grounding의 내용)
      └ 직접 연결된 후속 업무: 없음 (후임자 판단 필요)
      └ 근거: (문서명)
  연결 Todo가 없다는 이유로 이슈 자체를 빼는 것은 인수인계 누락이므로 금지한다. 이슈 제목 자체를 업무처럼 재서술하지 마라.

## 4. 참고 자료
- 각 업무의 근거 문서(file_name)를 출처로 표기. 데이터에 있는 것만.
- 같은 문서가 여러 업무의 근거면 한 번만 적고 "(N개 업무 공통 근거)"로 표기.

업무 데이터(JSON):
{grounding_json}

주의: JSON에 없는 고객사/숫자/날짜를 지어내지 마라. 빈 항목은 "해당 없음"으로.

Markdown 본문만 출력하고, 코드 블록이나 작성 과정 설명은 포함하지 마라."""

ONBOARDING_PROMPT = """다음은 {target}님이 {department}에서 업무를 익히기 위해 선택한 실제 운영 자료입니다.
사수는 {mentor}님입니다. 신입이 문서를 읽는 데 그치지 않고, 실제 업무를 안전하게 이해하고 연습할 수 있는 30일 적응 플랜을 작성하세요.

## 1. 업무 지도
- 이 팀이 현재 어떤 고객사, 품목, 이슈, Todo 흐름을 다루는지 선택된 데이터만으로 3~5문장으로 설명.
- 업무 흐름은 "무엇을 확인하고 → 누구와 협업하며 → 어떤 결과를 남기는지" 관점으로 서술.
- 데이터에 없는 고객사, 품목, 부서, 업무 절차는 만들지 말고 "확인 필요"로 적는다.

## 2. 1 Step: 흐름과 자료 익히기
- 신입이 첫 번째 단계에서 확인할 자료와 질문을 3~5개 bullet로 작성.
- 문서명, Todo, Issue가 데이터에 있으면 원래 제목을 그대로 사용.
- 실제 업무를 단독 처리하라고 지시하지 말고, 업무 맥락과 완료 기준을 이해하는 활동으로 작성.

## 3. 2 Step: 사수와 함께 하는 실전 연습
- grounding JSON의 todos에 실제로 존재하는 항목만 실전 연습 업무로 사용.
- 각 항목은 [업무] / [왜 지금 중요한지] / [사수와 함께 확인할 완료 기준]을 한 bullet에 포함.
- High/Critical 또는 미해결 이슈와 연결된 업무는 반드시 사수 동행 또는 검토가 필요하다고 명시.
- Todo가 없으면 없는 업무를 만들지 말고 "실전 연습 후보 없음"이라고 적는다.

## 4. 3 Step: 독립 처리 범위와 리스크 기준
- 선택된 Todo/Issue를 근거로 신입이 독립 처리 가능한 범위와 반드시 사수에게 올려야 할 조건을 구분.
- 독립 처리라고 단정할 근거가 없으면 "사수와 범위 합의 필요"로 표기.
- 선택된 모든 이슈는 누락하지 말고, 이슈 제목과 현재 상태를 포함.

## 5. 사수 확인 및 참고 자료
- 사수가 짧게 확인할 수 있는 검증 질문 또는 체크 항목을 3~5개 작성.
- 각 줄은 바로 체크할 수 있는 행동 또는 질문 한 문장만 작성한다.
- "사수 확인 질문", "참고 자료", "문서 목록" 같은 중간 제목·구분선·따옴표·강조 표기(**, ''')를 섹션 안에 넣지 마라.
- 문서 파일명은 이 섹션의 체크리스트에 넣지 마라. 연결 문서는 시스템이 별도 첨부파일 영역에 표시한다.
- 실제 자료로 확인할 수 없는 항목은 "사수와 범위 합의 필요"라고 한 줄로 쓴다.

업무 데이터(JSON):
{grounding_json}

엄격한 제약: JSON에 없는 Todo, 고객사, 품번, 날짜, 담당자, 완료 기준을 만들지 마라. 실제 자료가 부족하면 "확인 필요" 또는 "사수와 범위 합의 필요"라고 적는다. Markdown 본문만 출력한다."""


class HandoverDraftService:
    """Generate a handover document when Azure OpenAI is configured."""

    async def generate(self, handover_input: dict[str, Any], *, document_type: str = "handoff") -> str | None:
        if not settings.llm_enabled:
            return None

        owner = handover_input.get("owner") or "전임자"
        receiver = handover_input.get("receiver") or "후임자"
        target = handover_input.get("target") or owner or "신입 구성원"
        mentor = handover_input.get("mentor") or receiver or "사수 확인 필요"
        department = handover_input.get("department") or "소속 팀 확인 필요"
        grounding_json = json.dumps(handover_input, ensure_ascii=False, default=str, indent=2)
        if document_type == "onboarding":
            user_message = ONBOARDING_PROMPT.format(
                target=target,
                mentor=mentor,
                department=department,
                grounding_json=grounding_json,
            )
        else:
            user_message = HANDOVER_PROMPT.format(
                owner=owner,
                receiver=receiver,
                grounding_json=grounding_json,
            )

        try:
            content = (await chat_completion(
                user_message,
                system_prompt=SYSTEM_PROMPT,
                temperature=0.2,
            )).strip()
        except (AzureOpenAIConfigError, ModuleNotFoundError, RuntimeError, ValueError) as exc:
            logger.error(
                "handover draft LLM call failed (document_type=%s): %s: %s",
                document_type,
                type(exc).__name__,
                exc,
            )
            return None
        except Exception as exc:
            logger.exception(
                "handover draft LLM call raised unexpected error (document_type=%s): %s",
                document_type,
                type(exc).__name__,
            )
            return None

        if not self._is_complete(content, document_type=document_type):
            logger.error(
                "handover draft rejected as incomplete (document_type=%s, length=%d): %r",
                document_type,
                len(content),
                content[:200],
            )
            return None
        return content

    @staticmethod
    def _is_complete(content: str, *, document_type: str = "handoff") -> bool:
        required = ["## 1.", "## 2.", "## 3.", "## 4."]
        if document_type == "onboarding":
            required.append("## 5.")
        return len(content) >= 200 and all(marker in content for marker in required)
