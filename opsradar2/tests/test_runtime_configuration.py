from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_database_uses_configured_schema() -> None:
    config = read("app/core/config.py")
    database = read("app/core/database.py")

    assert 'DB_SCHEMA: str = os.getenv("DB_SCHEMA", "public")' in config
    assert 'search_path": f"{settings.DB_SCHEMA},public"' in database
    assert "pool_pre_ping=True" in database


def test_dev_server_does_not_override_database_url() -> None:
    server = read("scripts/dev_server.py")

    assert "DATABASE_URL" not in server
    assert "selector_loop_factory" in server


def test_calendar_adapter_preserves_selected_year_and_month() -> None:
    adapter = read("frontend/js/api-integration.js")

    assert "const [year, month, day] = date.split(\"-\").map(Number);" in adapter
    assert "y: year" in adapter
    assert "m: month - 1" in adapter
    assert "loadCalendar: loadCalendarFromAPI" in adapter
    assert "event_date: [" in adapter
    assert "`2026-05-${String(day).padStart(2, \"0\")}`" not in adapter


def test_chat_ui_calls_backend_api() -> None:
    frontend_app = read("frontend/js/app.js")
    index = read("frontend/index.html")

    assert "window.opsRadarApi.request('/chat'" in frontend_app
    assert '<script src="/static/js/api-integration.js"></script>' in index


def test_frontend_api_uses_same_origin_by_default() -> None:
    adapter = read("frontend/js/api-integration.js")

    assert 'window.OPSRADAR_API_BASE || "/api/v1"' in adapter


def test_calendar_state_is_exposed_to_api_adapter() -> None:
    frontend_app = read("frontend/js/app.js")
    adapter = read("frontend/js/api-integration.js")

    assert "window.G = G;" in frontend_app
    assert "if (!window.G) return;" in adapter
    assert "window.G.calEvents = Array.from(byDay.values());" in adapter


def test_react_frontend_runtime_settings_are_configurable() -> None:
    config = read("app/core/config.py")
    main = read("app/main.py")
    env_example = read(".env.example")

    assert "FRONTEND_ORIGINS" in config
    assert "parse_csv_env" in config
    assert "allow_origins=list(settings.FRONTEND_ORIGINS)" in main
    assert "http://127.0.0.1:5173" in env_example


def test_fastapi_can_serve_react_build_output() -> None:
    main = read("app/main.py")

    assert "FRONTEND_BUILD = FRONTEND / \"build\"" in main
    assert "react_assets = FRONTEND_DIST / \"assets\"" in main
    assert "def frontend_static_asset" in main
    assert 'app.mount("/assets"' in main
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
