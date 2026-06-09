from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_database_uses_configured_schema() -> None:
    config = read("app/core/config.py")
    database = read("app/core/database.py")

    assert 'DB_SCHEMA: str = os.getenv("DB_SCHEMA", "opsradar2")' in config
    assert 'search_path": f"{settings.DB_SCHEMA},public"' in database
    assert "pool_pre_ping=True" in database


def test_dev_server_does_not_override_database_url() -> None:
    server = read("scripts/dev_server.py")

    assert "DATABASE_URL" not in server
    assert "selector_loop_factory" in server
    assert "port=8002" in server


def test_calendar_adapter_preserves_selected_year_and_month() -> None:
    adapter = read("frontend/public/static/js/api-integration.js")

    assert "const [year, month, day] = date.split(\"-\").map(Number);" in adapter
    assert "y: year" in adapter
    assert "m: month - 1" in adapter
    assert "loadCalendar: loadCalendarFromAPI" in adapter
    assert "event_date: [" in adapter
    assert "`2026-05-${String(day).padStart(2, \"0\")}`" not in adapter


def test_chat_ui_calls_backend_api() -> None:
    frontend_app = read("frontend/public/static/js/app.js")
    index = read("frontend/public/index.html")

    assert "window.opsRadarApi.request('/chat'" in frontend_app
    assert '<script src="/static/js/api-integration.js"></script>' in index


def test_frontend_api_uses_same_origin_by_default() -> None:
    adapter = read("frontend/public/static/js/api-integration.js")

    assert 'window.OPSRADAR_API_BASE || "/api/v1"' in adapter


def test_calendar_state_is_exposed_to_api_adapter() -> None:
    adapter = read("frontend/public/static/js/api-integration.js")

    assert "if (!window.G) return;" in adapter
    assert "window.G.calEvents = Array.from(byDay.values());" in adapter


def test_react_frontend_runtime_settings_are_configurable() -> None:
    config = read("app/core/config.py")
    main = read("app/main.py")
    env_example = read(".env.example")
    public_index = read("frontend/public/index.html")

    assert "FRONTEND_ORIGINS" in config
    assert "parse_csv_env" in config
    assert "MAX_UPLOAD_BYTES" in config
    assert "allow_origins=list(settings.FRONTEND_ORIGINS)" in main
    assert "http://127.0.0.1:8002" in env_example
    assert "http://127.0.0.1:5173" in env_example
    assert 'window.location.port === "8002"' in public_index


def test_fastapi_can_serve_react_build_output() -> None:
    main = read("app/main.py")

    assert "FRONTEND_BUILD = FRONTEND / \"build\"" in main
    assert "FRONTEND_DIST = FRONTEND / \"dist\"" in main
    assert "FRONTEND_OUTPUT = FRONTEND_BUILD if FRONTEND_BUILD.exists() else FRONTEND_DIST" in main
    assert "FRONTEND_PUBLIC_STATIC = FRONTEND / \"public\" / \"static\"" in main
    assert "react_assets = FRONTEND_OUTPUT / \"assets\"" in main
    assert 'app.mount("/assets"' in main
    assert '@app.api_route("/static/{asset_type}/{asset_path:path}", methods=["GET", "HEAD"])' in main
    assert "def frontend_static_asset" in main
    assert "def spa_fallback" in main


def test_api_router_uses_registry() -> None:
    api = read("app/api/api.py")
    registry = read("app/api/v1/router_registry.py")

    assert "include_api_routers(api_router)" in api
    assert "RouterSpec(todos.router, \"/todos\", \"todos\")" in registry
    assert "RouterSpec(system.router, \"/system\", \"system\")" in registry
    assert "def include_api_routers" in registry


def normalize_route_path(path: str) -> str:
    return (
        path.replace("{todo_id}", "{}")
        .replace("{issue_id}", "{}")
        .replace("{event_id}", "{}")
        .replace("{report_id}", "{}")
        .replace("{document_id}", "{}")
        .replace("{member_id}", "{}")
    )


def test_frontend_api_paths_exist_in_backend_router() -> None:
    from app.api.api import api_router

    backend_routes = {
        (method, normalize_route_path(route.path))
        for route in api_router.routes
        for method in route.methods
        if method in {"GET", "POST", "PATCH", "DELETE"}
    }

    expected_routes = {
        ("GET", "/system/health"),
        ("GET", "/system/frontend-config"),
        ("GET", "/dashboard/summary"),
        ("GET", "/todos"),
        ("POST", "/todos"),
        ("PATCH", "/todos/{}"),
        ("GET", "/issues"),
        ("POST", "/issues"),
        ("PATCH", "/issues/{}"),
        ("PATCH", "/issues/{}/resolve"),
        ("POST", "/issues/{}/todos"),
        ("GET", "/members"),
        ("POST", "/members"),
        ("PATCH", "/members/{}"),
        ("DELETE", "/members/{}"),
        ("GET", "/calendar"),
        ("POST", "/calendar/"),
        ("DELETE", "/calendar/{}"),
        ("GET", "/reports"),
        ("POST", "/reports/generate"),
        ("PATCH", "/reports/{}"),
        ("POST", "/chat"),
        ("POST", "/chat/extract"),
        ("POST", "/documents/upload"),
        ("GET", "/documents"),
        ("GET", "/documents/{}/status"),
    }

    assert expected_routes <= backend_routes


def test_frontend_backend_contract_doc_exists() -> None:
    contracts = read("docs/api-contracts.md")

    assert "`/api/v1/todos`" in contracts
    assert "`/api/v1/chat`" in contracts
    assert "`/api/v1/system/frontend-config`" in contracts
    assert "`/api/v1/documents/upload`" in contracts
    assert "`/api/v1/chat/extract`" in contracts
    assert 'window.OPSRADAR_API_BASE || "/api/v1"' in contracts
    assert "http://127.0.0.1:8002" in contracts

def test_ai_pipeline_is_integrated_under_opsradar2_app() -> None:
    parser = read("app/ai/file_parser.py")
    chunker = read("app/ai/chunker.py")
    retriever = read("app/ai/retriever.py")
    summarizer = read("app/ai/summarizer.py")
    documents = read("app/api/v1/endpoints/documents.py")
    chat = read("app/api/v1/endpoints/chat.py")

    assert "SUPPORTED_EXTENSIONS" in parser
    assert "def chunk_text" in chunker
    assert "async def retrieve" in retriever
    assert "async def extract_todos" in summarizer
    assert "run_document_pipeline" in documents
    assert '@router.post("/extract")' in chat


def test_document_upload_has_size_limit_and_nonblocking_copy() -> None:
    config = read("app/core/config.py")
    service = read("app/services/document_service.py")

    assert "MAX_UPLOAD_BYTES" in config
    assert "asyncio.to_thread" in service
    assert "_copy_upload_file_with_limit" in service
    assert "file is too large" in service
    assert "shutil.copyfileobj" not in service


def test_document_chunk_actions_use_pydantic_payloads() -> None:
    schemas = read("app/schemas/document.py")
    documents = read("app/api/v1/endpoints/documents.py")

    assert "class ChunkTodoCreate" in schemas
    assert "class ChunkIssueCreate" in schemas
    assert 'ConfigDict(extra="forbid")' in schemas
    assert "body: ChunkTodoCreate" in documents
    assert "body: ChunkIssueCreate" in documents
    assert "model_dump(exclude_none=True)" in documents


def test_member_actions_use_pydantic_payloads() -> None:
    schemas = read("app/schemas/member.py")
    members = read("app/api/v1/endpoints/members.py")

    assert "class MemberCreate" in schemas
    assert "class MemberUpdate" in schemas
    assert 'ConfigDict(extra="forbid")' in schemas
    assert "body: MemberCreate" in members
    assert "body: MemberUpdate" in members
    assert "model_dump(exclude_unset=True, exclude_none=True)" in members
