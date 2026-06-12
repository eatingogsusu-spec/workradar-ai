"""Regression tests for high-signal AI Assistant answers."""

from app.api.v1.endpoints.chat import _is_operational_question, _local_answer, _local_knowledge_answer


CONTEXT = """
[OpsRadar current operational data]

Todos:
- dashboard/summary API 집계 쿼리 구현 | description=Dashboard 집계 API를 구현한다. | status=completed | priority=high | assignee=김성호 | due=no due date | created=2026-06-01
- PPT 발표 자료 작성 | description=최종 발표용 PPT를 작성하고 검토한다. | status=in_progress | priority=medium | assignee=이성우 | due=2026-06-20T00:00:00 | created=2026-06-10
- 미완료 API 점검 | description=API 상태를 점검한다. | status=pending | priority=medium | assignee=김희진 | due=no due date | created=2026-06-10

Issues:
- API timeout | status=open | severity=high | assignee=김성호 | created=2026-06-10

Calendar:
- 발표 | type=meeting | starts_at=2026-06-20T10:00:00
"""


def test_term_question_is_not_misclassified_as_operational_summary():
    assert _is_operational_question("업무 관련하여 RAG가 뭐야?") is False
    answer = _local_knowledge_answer("RAG가 뭐야?", "")
    assert answer is not None
    assert "Retrieval-Augmented Generation" in answer
    assert "FAISS" in answer


def test_completed_implementation_question_returns_completed_todo():
    answer = _local_answer("dashboard/summary API 집계 쿼리 구현 했어?", CONTEXT)
    assert "dashboard/summary API 집계 쿼리 구현" in answer
    assert "상태: 완료" in answer
    assert "김성호" in answer


def test_assignee_question_matches_todo_title_and_description():
    answer = _local_answer("현재 PPT 담당이 누구야?", CONTEXT)
    assert "PPT 발표 자료 작성" in answer
    assert "담당자: 이성우" in answer
    assert "상태: 진행 중" in answer


def test_duplicate_tasks_are_collapsed_to_most_useful_record():
    duplicated = CONTEXT.replace(
        "Issues:",
        "- PPT 발표 자료 작성 | description=최종 발표용 PPT를 작성하고 검토한다. | status=pending | priority=medium | assignee=담당자 미지정 | due=no due date | created=2026-06-09\n\nIssues:",
    )
    answer = _local_answer("현재 PPT 담당이 누구야?", duplicated)
    assert answer.count("**PPT 발표 자료 작성**") == 1
    assert "담당자: 이성우" in answer


def test_incomplete_todo_list_excludes_completed_items():
    answer = _local_answer("미완료 Todo 알려줘", CONTEXT)
    assert "미완료 API 점검" in answer
    assert "dashboard/summary API 집계 쿼리 구현" not in answer
