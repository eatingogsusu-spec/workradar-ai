"""Regression checks for the Todo workflow integration."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_todo_edit_persists_due_date_from_calendar():
    adapter = read("frontend/public/static/js/api-integration.js")
    calendar = read("frontend/public/static/js/todo-calendar-enhancements.js")

    assert 'const dueAt = document.getElementById("editDueDate")?.value || null;' in adapter
    assert "JSON.stringify({ title, description, assignee, due_at: dueAt })" in adapter
    assert "JSON.stringify({ title, description, assignee, due_at: dueDate })" in calendar


def test_completed_todos_can_return_to_progress_or_be_deleted():
    index = read("frontend/public/index.html")
    calendar = read("frontend/public/static/js/todo-calendar-enhancements.js")

    assert 'id="todoBulkRestoreDoneBtn"' in index
    assert "window.restoreDoneTodo" in calendar
    assert "window.bulkRestoreDoneTodos" in calendar
    assert 'JSON.stringify({ status: "in_progress", approval_status: "approved" })' in calendar
    assert "window.deleteDoneTodo" in calendar


def test_todo_dates_have_distinct_created_and_updated_fields():
    adapter = read("frontend/public/static/js/api-integration.js")
    repository = read("app/repositories/todo_repository.py")

    assert "createdAt: todo.created_at || null" in adapter
    assert "updatedAt: todo.updated_at || todo.created_at || null" in adapter
    assert "COALESCE(t.updated_at, t.created_at) AS updated_at" in repository


def test_authenticated_runtime_loads_all_todos_for_local_tabs():
    adapter = read("frontend/public/static/js/api-integration.js")

    assert 'localStorage.getItem("opsradar_session")' in adapter
    assert "headers.Authorization = `Bearer ${token}`" in adapter
    assert 'request("/todos?limit=500")' in adapter


def test_role_workflow_supports_assignees_rejection_and_member_permissions():
    workflow = read("frontend/public/static/js/role-workflow-enhancements.js")
    index = read("frontend/public/index.html")

    assert "담당자는 최소 한 명이어야 합니다." in workflow
    assert "editAssigneeEditor" in workflow
    assert "tcAssigneeEditor" in workflow
    assert "todoRejectReasonModal" in workflow
    assert "showTodoRejectionReason" in workflow
    assert "wr-team-member" in workflow
    assert "extraAssignees(todo).includes(name)" in workflow
    assert "/static/js/role-workflow-enhancements.js" in index


def test_analysis_approval_center_and_calendar_preferences_are_available():
    workflow = read("frontend/public/static/js/role-workflow-enhancements.js")

    assert "분석 승인 관리" in workflow
    assert "승인 대기함" in workflow
    assert "승인 완료함" in workflow
    assert "captureAnalysisApproval" in workflow
    assert "calendarPreferencePanel" in workflow
    assert "applyCalendarPreferences" in workflow
    assert "analysisApprovalCenter" in workflow
    assert "팀장에게 전송" in workflow
    assert "discardCurrentAnalysis" in workflow
    assert 'item.status = "done"' in workflow
    assert "refreshApprovalRecordsFromServer" in workflow


def test_document_upload_tracks_uploader_for_shared_approval_center():
    endpoint = read("app/api/v1/endpoints/documents.py")
    service = read("app/services/document_service.py")

    assert "uploaded_by_member_id = await _resolve_uploaded_by_member_id" in endpoint
    assert '"uploaded_by": document["uploaded_by"]' in endpoint
    assert '"pending_todo_count"' in endpoint
    assert "uploaded_by_member_id=uploaded_by_member_id" in service


def test_personal_todo_counts_and_clean_detail_are_available():
    workflow = read("frontend/public/static/js/role-workflow-enhancements.js")

    assert "updatePersonalTodoCounts" in workflow
    assert "extraAssignees(todo).includes(memberName())" in workflow
    assert "AI 분석 근거" in workflow
    assert "wr-todo-source" in workflow
    assert "todo.recommendedAssignee || todo.assignee" in workflow


def test_calendar_month_navigation_replaces_ai_prediction_panel():
    workflow = read("frontend/public/static/js/role-workflow-enhancements.js")
    styles = read("frontend/public/static/css/role-workflow-enhancements.css")

    assert 'insight.id = "wrCalendarMonthNav"' in workflow
    assert "calPrevBtn" in workflow
    assert "calMonthTitle" in workflow
    assert "calNextBtn" in workflow
    assert ".wr-calendar-month-nav" in styles


def test_ai_extraction_separates_todo_title_and_description():
    summarizer = read("app/ai/summarizer.py")
    document_service = read("app/services/document_service.py")

    assert '"title": "해야 할 일"' in summarizer
    assert '"description": "업무 수행 방법과 완료 기준"' in summarizer
    assert 'description = item.get("description") or item.get("content") or str(title)' in document_service
