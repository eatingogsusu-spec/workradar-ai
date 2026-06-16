# 프론트 React+Vite 전환 일지 (두 AI 공유)

## 이 파일의 규칙
- 모든 AI(Codex/Claude)는 작업 시작 전 이 파일을 먼저 읽는다.
- 작업이 끝나면 이 파일을 갱신하고 git 커밋한다.
- "다음 작업" 칸에 다음 AI가 할 일을 구체적으로 남긴다.

## 절대 원칙
- 기존 디자인/CSS 100% 유지. 픽셀 단위로 동일. 화면이 달라지면 실패.
- 기존 CSS(theme/layout/components/role-workflow-enhancements/workflow-v2)는
  새로 만들지 않고 그대로 재사용.
- React 컴포넌트는 기존 index.html과 똑같은 class·HTML 구조 사용.
- 한 번에 한 화면. 각 화면 = 커밋 하나. 중간에 멈춰도 앱은 항상 정상.
- 파일 삭제/build·dist 정리/worktree·브랜치 변경은 사용자 확인 후에만.

## 환경 고정
- 작업 폴더: jw-new2-test-run worktree (이게 최신본)
- Python: 3.11 가상환경
- 빌드 도구: Vite (create-react-app 아님)
- 백엔드 API: /api/v1, 포트 8002
- 반드시 살려야 할 신규 기능: workflow-v2 (역할 기반 이슈/리스크 검토)

## 화면 전환 현황 (9개)
| 화면 | ID | 담당 기존 JS | 상태 |
|------|----|----|----|
| Dashboard | s-dashboard | app.js + workflow-v2.js | 기존바닐라 |
| 운영 로그 분석 | s-analysis | app.js | 기존바닐라 |
| Todo | s-todo | app.js + todo-calendar-enhancements.js | 기존바닐라 |
| 이슈 로그 | s-issues | app.js + workflow-v2.js | 기존바닐라 |
| 캘린더 | s-calendar | app.js + todo-calendar-enhancements.js | 기존바닐라 |
| 인수인계 센터 | s-knowledge | handoff.js | 기존바닐라 |
| 보고서 | s-reports | report.js | 기존바닐라 |
| AI Assistant | s-chat | app.js | 기존바닐라 |
| 설정 | s-settings | app.js | 기존바닐라 |
(상태값: 기존바닐라 / 전환중 / 전환완료)

## 공통 인프라 현황
- [x] 0단계: 안전 복구 (public/ 서빙 정상화) — 완료 (2026-06-16, Claude)
- [ ] 1단계: Vite 골격 + 기존앱 공존 세팅 — 미완
- [ ] 공유 API 클라이언트 (api-integration.js를 React/바닐라 공용으로) — 미완

## 마지막 작업 (누가/언제/뭐)
- 2026-06-16, Claude Code, 0단계 안전 복구:
  - app/main.py 수정: CRA `frontend/build/`를 우선 서빙하던 로직이 화면을 깨뜨렸음.
    이제 build/를 무시하고 `frontend/public/`(정상 바닐라 앱)을 서빙. dist/(Vite)는
    생기면 자동 우선. build/는 삭제하지 않고 무시만 함.
  - 검증: .venv-run311로 임시 8003 포트 기동 → 루트가 "WorkRader AI - Clean Version"
    서빙, workflow-v2.css/js·app.js 모두 HTTP 200, CRA main.* 청크 없음 확인 후 종료.
  - 사용자의 8002 기존 서버는 건드리지 않음(정상 동작 중).
  - 안전조치: 미커밋 상태였던 handoff.js(+502줄)를 `.backups/handoff.js.20260616-uncommitted.bak`로
    백업(.backups는 gitignore됨). handoff.js 자체는 사용자 확인 전까지 커밋 안 함.

## 다음 작업 (다음 AI가 할 일)
- 사용자에게 미커밋 handoff.js(+502줄, 인수인계 센터 대규모 수정) 처리 방침 확인:
  별도 커밋할지 / 계속 작업 중인지. (백업본 존재: .backups/)
- 기존 8002 서버를 새 main.py로 재기동해야 최신 서빙 로직 반영됨(현재 구 프로세스 PID 25776).
  단, 재기동은 사용자 확인 후.
- 1단계 착수: Vite 골격을 frontend/에 추가하되 기존 public/ 바닐라 앱과 공존(스트랭글러).
  package.json이 현재 create-react-app(react-scripts)임 → Vite로 교체 필요(사용자 확인).

## 주의사항 / 막힌 점
- app.js(3305줄)에 거의 모든 화면 로직이 몰려있음. 화면 전환 = app.js에서 해당 부분 추출.
- workflow-v2.js는 이슈/리스크 검토(renderPendingIssues 등). 이슈 화면 전환 시 반드시 함께 보존.
- frontend/build/ = 어제의 CRA 전면교체 시도본(깨짐). 삭제 금지, 무시만. main.py가 이미 무시함.
- venv: 메인 프로젝트 루트의 `.venv-run311`(Python 3.11)에 uvicorn 등 의존성 있음.
  실행: opsradar2/ 에서 `python scripts/dev_server.py` (포트 8002 고정).
