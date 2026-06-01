# Frontend Entry Point

OpsRadar 2의 실행 기준 프론트 파일은 `opsradar2/frontend/index.html`입니다.

FastAPI는 해당 파일을 루트 `/`에서 제공하고, DB 연결 어댑터는
`/static/api-integration.js`에서 불러옵니다. 화면 실행과 배포 확인은 이
파일만 기준으로 진행합니다.
