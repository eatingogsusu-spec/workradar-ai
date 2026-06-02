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
    adapter = read("frontend/api-integration.js")

    assert "const [year, month, day] = date.split(\"-\").map(Number);" in adapter
    assert "y: year" in adapter
    assert "m: month - 1" in adapter
    assert "loadCalendar: loadCalendarFromAPI" in adapter
    assert "event_date: [" in adapter
    assert "`2026-05-${String(day).padStart(2, \"0\")}`" not in adapter


def test_chat_ui_calls_backend_api() -> None:
    frontend = read("frontend/index.html")

    assert "window.opsRadarApi.request('/chat'" in frontend
    assert '<script src="/static/api-integration.js"></script>' in frontend


def test_frontend_api_uses_same_origin_by_default() -> None:
    adapter = read("frontend/api-integration.js")

    assert 'window.OPSRADAR_API_BASE || "/api/v1"' in adapter


def test_calendar_state_is_exposed_to_api_adapter() -> None:
    frontend = read("frontend/index.html")
    adapter = read("frontend/api-integration.js")

    assert "window.G = G;" in frontend
    assert "if (!window.G) return;" in adapter
    assert "window.G.calEvents = Array.from(byDay.values());" in adapter
