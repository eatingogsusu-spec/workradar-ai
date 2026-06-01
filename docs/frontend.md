# Frontend Entry Point

OpsRadar AI의 프론트 실행 기준 파일은 `opsradar2/frontend/index.html`입니다.

프론트 화면을 실행하거나 배포 대상으로 확인할 때는 `opsradar2/frontend/index.html`만 기준으로 봅니다. 중복 HTML 파일은 혼란을 줄이기 위해 `docs/frontend_archive/`에 보관합니다.

FastAPI는 프론트 파일을 루트 `/`에서 제공하고, DB/API 연결 어댑터는 `/static/api-integration.js`에서 불러옵니다.