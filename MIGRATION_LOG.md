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
| Dashboard | s-dashboard | React(DashboardScreen.jsx) + renderDashboardLive 등 동작 vanilla 공존 | **전환완료** (박주원) |
| 운영 로그 분석 | s-analysis | React(AnalysisScreen.jsx) + 동작 vanilla 공존 | **전환완료** |
| Todo | s-todo | React(TodoScreen.jsx) + app.js compatibility wrapper + todo-calendar-enhancements.js | **전환완료** (Codex) |
| 이슈 로그 | s-issues | React(IssuesScreen.jsx) + workflow-v2/app.js 동작 vanilla 공존 | **전환완료** (박주원) |
| 캘린더 | s-calendar | React(CalendarScreen.jsx) + 동작 vanilla 공존 | **전환완료** |
| 인수인계 센터 | s-knowledge | React(KnowledgeScreen.jsx) + handoff.js/app.js 동작 vanilla 공존 | **전환완료** (b25e8de) |
| 보고서 | s-reports | React(ReportsScreen.jsx) + report.js/app.js 동작 vanilla 공존 | **전환완료** |
| AI Assistant | s-chat | React(ChatScreen.jsx) + 동작 vanilla 공존 | **전환완료** |
| 설정 | s-settings | React(SettingsScreen.jsx) + 멤버패널 vanilla 공존 | **전환완료** (e6ff5a4) |
(상태값: 기존바닐라 / 전환중 / 전환완료)

## 공통 인프라 현황
- [x] 0단계: 안전 복구 (public/ 서빙 정상화) — 완료 (2026-06-16, Claude)
- [x] 1단계: Vite 골격 + 빈 마운트 공존 세팅 — 완료 (2026-06-16, Claude)
- [ ] 공유 API 클라이언트 (api-integration.js를 React/바닐라 공용으로) — 미완
      (※ 현재 React는 window.opsRadarApi/window.G 전역을 그대로 공유 가능 — 별도 클라이언트 불요)

## 마지막 작업 (누가/언제/뭐)
- 2026-06-16, Claude Code, 0단계 안전 복구:
  - app/main.py 수정: CRA `frontend/build/`를 우선 서빙하던 로직이 화면을 깨뜨렸음.
    이제 build/를 무시하고 `frontend/public/`(정상 바닐라 앱)을 서빙. dist/(Vite)는
    생기면 자동 우선. build/는 삭제하지 않고 무시만 함.
  - 검증: .venv-run311로 임시 8003 포트 기동 → 루트가 "WorkRader AI - Clean Version"
    서빙, workflow-v2.css/js·app.js 모두 HTTP 200, CRA main.* 청크 없음 확인 후 종료.
  - 사용자의 8002 기존 서버는 건드리지 않음(정상 동작 중).
  - 안전조치: 미커밋 상태였던 handoff.js(+502줄)를 `.backups/handoff.js.20260616-uncommitted.bak`로
    백업(.backups는 gitignore됨).
- 2026-06-16, Claude Code, 인수인계 센터 월요일 작업 보존·커밋 완료:
  - 커밋 `03b02ca` "feat: 인수인계 센터 - 퇴사자/신규입사자 카드 + AI 파이프라인 데모 화면 (월요일 작업 보존)".
  - 대상: opsradar2/frontend/public/static/js/handoff.js (504줄, +502/-20). 한 세트로 묶일
    다른 파일은 없었음(index.html 버전쿼리 등은 이전 커밋 69281e9/dc49ee8에 이미 포함).
  - 8002 서버를 새 main.py로 재기동(구 PID 25776 종료 → 신규 PID 27364)하여 504줄 화면 확인.
    사용자가 브라우저에서 "퇴사자/신규입사자 두 카드 + 각 상세 AI 파이프라인 데모/보드" 정상 확인함.
  - .backups/ 백업본(504줄)은 폐기하지 않고 그대로 보존.
- 2026-06-16, Claude Code, 1단계 Vite 골격 + 빈 마운트 공존 완료 (스트랭글러 토대만, 화면 미전환):
  - Vite 8.0.16 + @vitejs/plugin-react 6.0.2를 frontend devDependencies에 **추가**(react-scripts 5.0.1 보존).
    package.json에 `vite`/`vite:build` 스크립트 추가.
  - vite.config.js 신규: publicDir:false, build.outDir=public/static/react, base=/static/react/,
    input=src/react-mount/main.jsx, entryFileNames=main.js. **dist/ 미생성**(main.py 진입점 바꿔치기 회피).
  - src/react-mount/main.jsx 신규: #react-mount에 빈 StrictMode 마운트(아무것도 안 그림 = 픽셀 0).
  - public/index.html: workflow-v2.js 스크립트 다음에 3줄만 삽입(주석 + `<div id="react-mount">` +
    `<script type="module" src="/static/react/main.js">`). 기존 줄 무수정.
  - .gitignore에 `/public/static/react/`(빌드 산출물) 추가 → 생성물은 커밋 안 함.
  - 검증: `vite build` 통과(main.js 189.68kB). 8002에서 main.js HTTP 200 +
    content-type application/javascript(모듈 MIME 정상), 기존 화면/자산(title·workflow-v2·handoff) 그대로.
    사용자가 브라우저에서 픽셀 변화 0 + React main.js 관련 콘솔 에러 없음 직접 확인.
- 2026-06-16, Claude Code, 설정(s-settings) 화면 React 전환 — 스트랭글러 1번째 (커밋 e6ff5a4):
  - SettingsScreen.jsx: 기존 `#s-settings` 노드 안에 `createRoot` 로 렌더 → `#s-settings` ID 스코프
    CSS 그대로 상속(픽셀 동일). 마크업/class 100% 복제, ID는 생략(CSS 클래스 기반·legacy 중복 회피).
  - 데이터/동작은 전역 재사용: window.getStoredUserInfo(프로필) / setOpsRadarTheme(테마) / logout.
    app.js에 `window.getStoredUserInfo` 노출 +1줄만 추가(기존 줄 무수정).
  - nav 미래핑: #s-settings 의 .active 를 MutationObserver 로 감지해 갱신 → 다른 화면 영향 0.
  - 멤버(담당자 관리) 패널: 조사에서 놓쳤다가 깜빡임으로 발견. api-integration.js 가 런타임에
    `#memberAdminPanel` 을 주입하는 API CRUD 패널. Plan A 로 해결 — React.memo 로 "껍데기"만 1회
    렌더하고 리스트(`#memberAdminList`)/CRUD 는 vanilla 가 그대로 소유. api-integration.js 무수정.
  - 폴백: localStorage.opsradar_react_settings='off' +새로고침 → 바닐라 복귀.
  - 검증(사용자 직접): 깜빡임 없음, 멤버 CRUD/테마/로그아웃/프로필 정상, 타화면(인수인계 등) 무영향.
- 2026-06-16, 박주원, 보고서(s-reports) 화면 React 전환 — 스트랭글러 2번째:
  - ReportsScreen.jsx: 기존 `#s-reports` 노드 안에 `createRoot` 로 렌더 → ID 스코프 CSS 상속(픽셀 동일).
    기존 HTML class·구조·텍스트 100% 복제.
  - **app.js 무수정**(1줄 노출도 없음). 핵심: `nav('reports')` 가 매번 `initReportsScreen()` 를 호출해
    탭/툴바/저장 리스너를 idempotent(dataset 가드)하게 (재)바인딩 + `renderReportList()`. 따라서 React 는
    동일 구조를 **memo 로 1회만 렌더**하고, 보고서로 이동할 때 vanilla 가 그 React 노드에 바인딩한다.
  - 트랩① `#reportEditor`(contenteditable): api-integration.js `saveReport` 가 innerHTML 을 읽고
    app.js `renderReportDraft` 가 씀 → React 가 1회 렌더 후 재렌더 안 함 + `suppressContentEditableWarning`
    (uncontrolled) 으로 보호. 트랩② 주간/월간 탭 `.active`: React state 로 이중관리하지 않고 DOM 의
    `.active` 를 단일 소스로 두어 vanilla(`getActiveReportPeriod`/`setReportPeriod`)가 토글.
  - 폴백: localStorage.opsradar_react_reports='off' +새로고침 → 바닐라 복귀.
  - 검증(헤드리스 Chrome 실측): 픽셀 동일, React 마운트(설정·보고서 둘 다), 목록 3건/탭 전환/선택/AI초안
    버튼 정상, 9개 화면 무영향(설정 안 깨짐), 콘솔/페이지/HTTP 4xx·5xx 에러 0.
- 2026-06-16, nav() 방어수정 (전역 라우터 안정화 — React 전환 아님, app.js 국소 수정):
  - `nav(screen)`에 ① `getElementById('s-'+screen)`/`'nav-'+screen` **null 가드**(없으면 그 부분만
    건너뛰고 nav는 끝까지 진행, throw 금지) ② 화면별 init 호출(renderTodos/initReportsScreen/
    updateSettingsPage 등) **try/catch**(한 화면 init이 에러나도 nav 안 멈춤, console.warn만) 추가.
  - 기존 정상 동작 100% 동일(전환 결과 무변경) — "에러가 나도 안 멈춘다"만 추가.
  - 검증(헤드리스 Chrome): 9화면 순회·설정↔보고서 반복·동일화면 연타 전부 정상, React 마운트 유지,
    콘솔/페이지/HTTP 에러 0, **존재하지 않는 화면명 nav → throw 없이(NO_THROW) 조용히 넘어가고
    직후 정상 nav 완전 복구**.
  - ⏸ 로그아웃은 이번에 손대지 않음(제품 결정 대기 — 아래 주의사항 참고).
- 2026-06-17, Claude Code, 캘린더(s-calendar) 화면 React 전환 — 스트랭글러 3번째 (보고서 패턴):
  - CalendarScreen.jsx: 기존 `#s-calendar` HTML 을 verbatim 복제(class·id·inline style 동일, 픽셀 동일),
    `createRoot(#s-calendar)` 로 memo 1회 렌더(재렌더 0, MutationObserver 미사용).
    동작은 전부 vanilla 재사용: nav('calendar') → renderCalendar()/updateCalendarHeader()/showCalBanner()
    가 이 React 노드(같은 id)에 바인딩·채움. **app.js / api-integration.js 무수정.**
    (참고: `#calEventBanner` 인라인에 display:none/flex 중복 → 실제 computed=flex, React도 flex로 복제)
  - 디자인 개선(역할 무관, 같이 반영): 하루 일정 많으면 칸 깨지는 문제 → **셀당 태그 최대 2개 +
    초과 시 "+N 더보기"**. renderCalendar 무수정, `#calGrid` 에 MutationObserver(childList)로 vanilla
    가 셀을 (재)그린 직후 표시만 후처리(멱등, 루프 없음). "+N"/셀 클릭은 기존 `openCalModal` 로 전체 표시.
  - 폴백: localStorage.opsradar_react_calendar='off' +새로고침 → 바닐라 복귀.
  - 검증(헤드리스 Chrome): 9화면 순회 정상, React 마운트(설정·보고서·캘린더 셋 다), 날짜셀 35개·월이동
    (6월→5월→6월 복원)·AI모달·미니챗 정상, "+N 더보기" 데코레이터 실측(태그3개→"+1 더보기"·표시2개),
    9화면 무영향, 콘솔/HTTP 에러 0. 사용자 브라우저 직접 확인 완료.
- 2026-06-17, 박주원, 이슈 로그(s-issues) 화면 React 전환 (feature/issues-dashboard-react 브랜치):
  - IssuesScreen.jsx: 기존 #s-issues HTML 100% 복제(픽셀 동일), `createRoot(#s-issues)` memo 1회 렌더
    (재렌더 0). 동작은 전부 vanilla: app.js(renderIssues/selectIssue) + role-workflow-enhancements.js
    (renderIssues 몽키패치) + workflow-v2.js(반려탭 주입·renderPendingRisks/RejectedRisks). **app.js/
    api-integration.js/workflow-v2.js 무수정.** main.jsx 마운트 등록 1줄만 추가.
  - ★핵심 함정(해결): workflow-v2 가 탭을 **리터럴 onclick 속성 문자열**로 찾는다
    (`.tab[onclick*="'candidate'"]`, `getAttribute("onclick")`). React onClick 은 onclick 속성을
    안 만들어 깨짐 → **.tabs 만 dangerouslySetInnerHTML 로 리터럴 onclick 보존**(나머지는 JSX
    프래그먼트로 여분 래퍼 회피). "반려" 탭은 configureRoleScreen 이 setTimeout(900/2800)+
    setInterval(800)로 React 마운트 *후* 주입 → memo 1회 렌더라 보존됨.
  - 폴백: localStorage.opsradar_react_issues='off' +새로고침 → 바닐라 복귀(검증됨).
  - 검증(헤드리스 Chrome): 픽셀 동일, React 마운트(설정·보고서·캘린더·이슈 넷 다), **반려탭 주입 확인 +
    onclick 속성 셀렉터 매칭(핵심 게이트 통과)**, 탭 토글(진행중↔승인대기↔반려) 정상, 수동등록 모달 정상,
    9화면 무영향. ⚠️ 반려 탭 클릭 시 401/login-required는 `/workflow/risks/rejected` 인증 필요로
    발생하는 **기존 토큰만료 이슈**(폴백 바닐라에서도 동일 발생 확인 → 전환 무관). 카드→상세는
    현재 데이터에 confirmed 이슈 0개라 미실행(상세 패널 노드는 정상 렌더, 메커니즘 vanilla 무변경).
- 2026-06-17, 박주원, 대시보드(s-dashboard) 화면 React 전환 (feature/issues-dashboard-react 브랜치):
  - DashboardScreen.jsx: 두 직계 자식(.topbar / .content)만 **verbatim dangerouslySetInnerHTML**로
    렌더(클래스·인라인 onclick·스타일 100% 보존, 여분 래퍼 0 → flex 레이아웃 유지). memo 1회 렌더(재렌더 0).
    동작은 전부 vanilla: renderDashboardLive(4중 몽키패치 — ops/role/todo-calendar/workflow-v2)가
    nav('dashboard')/init/reload 에서 카운트(textContent)·#db-high-risk-grid·#db-ai-todo-list·
    #db-member-view(innerHTML) 채움. **app.js·4개 enhancement js·workflow-v2.js 무수정.** main.jsx 1줄 추가.
  - ★핵심(재렌더 0): applyRoleVisibility 가 `.ops-role-switch` 를 런타임 제거 + switchDbRole 로
    #db-admin-view/#db-member-view `.active` 토글(isLead 가 그 .active 를 상태소스로 읽음). React 가
    재렌더하면 제거된 role-switch 가 되살아나고 뷰 상태가 꼬임 → memo + 1회 렌더로 완전 회피.
    (대시보드엔 이슈 같은 onclick 속성 셀렉터 결합 없음, 차트 라이브러리 없음 → 추가 처리 불요.)
  - 날짜 칩 함정(이슈 화면도 동일): `[data-current-date]` 를 채우는 app.js renderCurrentDateLabels 가
    init 1회만 실행 → React 마운트가 placeholder 로 덮음. 마운트 시 useEffect 로 renderCurrentDateLabels()
    1회 호출(전역·멱등)로 해결. IssuesScreen 에도 동일 적용.
  - 폴백: localStorage.opsradar_react_dashboard='off' +새로고침 → 바닐라 복귀.
  - 검증(헤드리스 Chrome): 픽셀 동일(날짜 칩 포함), React 마운트 5개 다, **재렌더 0 스트레스(nav 5회 왕복)
    후 .ops-role-switch 제거 유지 + 뷰 .active 일관 + 카운트/그리드/리스트/멤버뷰 보존**, switchDbRole
    뷰 토글 정상, openDashboardTodoTab 클릭(→todo 이동) 정상, 9화면 무영향, 콘솔/페이지/HTTP 에러 0.
- 2026-06-18, Claude Code, 인수인계 센터(s-knowledge) 화면 React 전환 — 스트랭글러 4번째 (커밋 b25e8de):
  - KnowledgeScreen.jsx: 기존 `#s-knowledge` 셸 HTML 을 verbatim 복제(class·id·inline style 동일, 픽셀 동일),
    `createRoot(#s-knowledge)` 로 memo 1회 렌더(재렌더 0, MutationObserver 미사용).
  - 동작/콘텐츠는 전부 vanilla 소유(무수정): handoff.js(window.nav 패치 / #knowledgeContent innerHTML 주입 /
    #s-knowledge data-handoff-view 토글 / document.head 에 <style id="handoffCenterStyle"> 주입) + app.js.
    탭(kbtn-*) 인라인 onclick 미러, '문서 생성 미리보기'는 vanilla 바인딩이라 onClick 미부착.
  - main.jsx 에 import / USE_REACT_KNOWLEDGE 폴백 / mountReactKnowledge / bootstrap 4곳 순수 추가.
    handoff.js/app.js/api-integration.js/workflow-v2.js 무수정, dist 미생성.
  - 검증(헤드리스 Chrome): 9화면 무에러, home 카드 뷰 렌더(contentLen 1975)·탭 클릭 뷰 전환(home→offboard)·
    data-handoff-view 토글·head <style> 주입 정상, 이중렌더 없음(reactContainer 1, 3회 재진입에도 콘텐츠 유지),
    기존 3화면(설정·보고서·캘린더) 무영향. 폴백(opsradar_react_knowledge='off') → React 미마운트·바닐라 복귀 정상.

- 2026-06-17, Claude Code, 운영 로그 분석(s-analysis) 화면 React 전환 — 스트랭글러 4번째 (dangerouslySetInnerHTML verbatim):
  - AnalysisScreen.jsx: 기존 `#s-analysis` 내부 HTML(index.html 215~294줄)을 **dangerouslySetInnerHTML 로
    verbatim 주입**. inline onclick/onchange/ondragover/ondragleave/ondrop/style 전부 보존 →
    브라우저가 innerHTML 파싱 시 네이티브 이벤트로 등록 → 기존 전역 함수(startAnalysis/resetUpload/
    toggleHistory/onFileSelect/ondov/ondl/handleUploadDrop/openAnalysisTodoReview/openAnalysisRiskReview/
    applyDashboard/resetFlow 등)를 그대로 호출. **React 관리 상태 0개.**
  - 구조 보존: `#s-analysis`(.screen flex column)의 직계 자식은 `.topbar`/`.content` 두 개.
    래퍼 div 를 끼우면 flex 가 깨지므로 프래그먼트로 `.topbar`/`.content` 를 각각 직접 렌더하고
    그 안쪽만 dangerouslySetInnerHTML 로 채움(원본 직계 구조 동일, 픽셀 동일).
  - **app.js / api-integration.js / workflow-v2.js / role-workflow-enhancements.js 무수정.**
    특히 api-integration.js 의 startAnalysis 몽키패치(실제 문서 업로드→분석→todos/issues API)는 그대로 둠.
  - 폴백: localStorage.opsradar_react_analysis='off' +새로고침 → 바닐라 복귀. main.jsx 에
    mountReactAnalysis() 추가(캘린더와 동일: createRoot 1회 render, MutationObserver/key 미사용).
  - 검증(사용자 직접): 픽셀 동일(업로드존/플로우/결과), 파일 업로드→AI 분석 4단계 끝까지 정상
    (DB documents/todos/issues 반영), **주입 패널 2개(승인 대기 Todo 큐 + 이슈 자동탐지) 재렌더로 안 사라짐 확인**,
    콘솔 빨간 에러 없음(401 토큰 기존 이슈 제외).

- 2026-06-17, Claude Code, AI Assistant(s-chat) 화면 React 전환 — 스트랭글러 5번째 (dangerouslySetInnerHTML verbatim):
  - ChatScreen.jsx: 기존 `#s-chat` 내부 HTML(index.html 597~652줄)을 **dangerouslySetInnerHTML 로
    verbatim 주입**. 직계 자식 `.topbar.chat-topbar` + `.chat-workspace` 를 프래그먼트 2개로 각각
    직접 렌더하고 안쪽만 채움(원본 직계 구조 동일, 픽셀 동일). inline onclick/onkeydown/oninput/style
    전부 보존 → 기존 전역 함수(sendMsg/autoResize/createNewChatSession/clearCurrentChatSession 등)
    그대로 호출. **React 관리 상태 0개.**
  - **app.js / api-integration.js / workflow-v2.js / role-workflow-enhancements.js 무수정.**
    특히 app.js `sendMsg`(RAG `POST /chat` API 내장)는 그대로 둠. api-integration.js 는 s-chat 을
    아예 안 건드림(운영분석의 startAnalysis 몽키패치와 달리 채팅은 RAG 가 app.js 에 직접 내장).
  - 폴백: localStorage.opsradar_react_chat='off' +새로고침 → 바닐라 복귀. main.jsx 에
    mountReactChat() 추가(운영분석/캘린더와 동일: createRoot 1회 render, MutationObserver/key 미사용).
  - 검증(사용자 직접): 픽셀 동일(세션/채팅/컨텍스트 3패널), 메시지 전송→응답 카드 렌더 정상,
    **재렌더 0 검증 통과 — 메시지 주고받고 다른 화면 갔다 와도 #chatArea 대화 그대로 보존**,
    타화면 무영향, 콘솔 빨간 JS 에러 없음.
  - ⚠️ 채팅 RAG 응답이 "Azure OpenAI 연결 실패"로 옴 — **프론트 전환과 무관한 백엔드 문제**
    (서버 Azure OpenAI API 키 재발급 미완료). sendMsg→POST /chat 호출까지는 정상, LLM 연결만 실패.
    아래 백로그 참고.
- 2026-06-17, Codex, Todo(s-todo) 화면 React 렌더링 전환 — 스트랭글러 4번째:
  - TodoScreen.jsx를 React shell에서 실제 React 렌더링 화면으로 확장. 탭 active, 검색 조건/키워드,
    페이지, 테이블/카드 뷰, 선택 Todo 상세, empty state를 React state로 관리.
  - TodoTabs.jsx / TodoList.jsx / TodoDetail.jsx / TodoEmptyState.jsx / todoStateAdapter.js 추가.
    기존 class/id 구조는 유지하고, 기존 Todo 데이터 source(todos/G)는 app.js bridge로 읽어 React state에 반영.
  - app.js의 renderTodos/selectTodo/renderTodoDetail/switchTodoTab/switchTodoView 등 기존 전역 함수는
    삭제하지 않고 compatibility wrapper로 전환해 `opsradar:todo-*` 이벤트를 발생시킴.
    Dashboard의 openDashboardTodoTab 및 api-integration/workflow/todo-calendar 기존 호출 흐름 유지.
  - workflow-v2.js의 Todo 목록/상세 DOM 후처리는 React 렌더링과 중복되어 wrapper 호출만 남김.
  - Vite 산출물은 기존 규칙대로 public/static/react/main.js만 갱신(dist 미생성).

- 2026-06-18, Claude Code, **pgvector RAG 백필 230/230 + 끝단 검증** (codex의 pgvector(2a9f324 박주원)
  + embedder dimensions 픽스(1d93716, PR #15) 위에서 수행. DB 쓰기는 백필만, 통제된 방식):
  - 배경: codex pgvector는 `chunk_embeddings.embedding vector(1536)` + `EMBEDDING_DIMENSION=1536`. 임베딩 모델은
    text-embedding-3-large(native 3072)이므로 embedder가 `dimensions=1536`으로 단축 출력해야 정합(이게 PR #15 픽스).
  - `scripts/backfill_pgvector_embeddings.py` 단계 실행: dry-run(pending 191 확인) → `--execute --limit 16`(1배치 16/16 성공)
    → `--execute`(나머지 175, 11배치 전부 성공). **결과: completed 39→230, pending 191→0, 실패 0.** 활성 문서 청크 230개 전부 임베딩.
    (document_chunks 660 중 삭제 문서 청크 430 제외 = 활성 230. `azag-embedding-prod` 440행은 failed+벡터 NULL이라 search 무시·무해.)
  - 멱등·resumable·차원(1536) 정합 실증. backfill은 배치별 커밋이라 중간 실패해도 재실행으로 이어감(이번엔 실패 0).
  - **검색 검증(읽기)**: 4개 주제 쿼리(API 지연/단가 인상/인수인계/납기 클레임) 모두 0.41 임계 통과 + 주제별 정확 매칭
    (납기 클레임→클레임 관리표 DOC-0093/0090/0139 등). FAISS 1벡터 → pgvector 230벡터로 코퍼스 충실해짐.
  - **채팅 끝단 검증(임시 8003 서버, 사용자 8002 무영향)**: `POST /api/v1/chat` 분석형 질문(운영토큰 회피) →
    **진짜 LLM(gpt-4o) 답변이 RAG 문서 기반으로 합성됨**(BE-ORDER-0128~0130 납기, Global Harness Vietnam AP-CB-510 통관지연,
    원자재 품질 등 문서 청크의 구체 엔티티 인용). sources에 RAG 문서 3건(주간보고서/인수인계 회의록/구매발주) 포함.
    ※ 운영토큰(issue/todo/calendar/이슈/리스크/일정 등)이 들어가면 chat.py가 LLM 안 타고 로컬 DB 템플릿으로 답함(설계).
  - ⚠️ 검색 score 일부 0.42~0.51로 낮은 편 → 임계값 0.41이 다소 빡빡. 추후 검색 품질 튜닝(임계/top_k) 여지 있음(현재 정상 범위).
  - **→ pgvector RAG 통합 완료** (pgvector 2a9f324 + dimensions 픽스 1d93716 + 백필 230 + 검색·채팅 끝단 검증).
  - (출처: feature/pgvector-integration 의 7aa1bc3 기록을 codex 라인으로 구제한 것.)

- 2026-06-19, Claude Code, **발표 baseline 적재 완료** (공유 DB 프로젝트 7fc2594d AutoParts One Korea):
  - 배경: 기존 278문서(비정제 더미 포함)를 비우고 dummy 브랜치 정제 raw 문서 149개를 업로드 파이프라인으로 재적재.
    비우기 전 pg_dump 백업 `backups/azag_db_backup_20260619.sql` (5.9 MB) 생성 후 진행.
  - 적재: 정제 문서 151개 중 라이브 데모용 2개(DOC-0001 meeting_notes / DOC-0007 quality_claims) 제외한
    149개를 `baseline_upload.py`(멱등·재개 가능, MESSY 84개 제외)로 업로드. 149/149 성공, 실패 0.
  - 결과: documents 149 / document_chunks 239 / chunk_embeddings 239 / analysis_status 전부 completed.
    임베딩 누락 0 → 백필 불필요.
  - ⚠️ Todo/이슈/ai_summaries 삭제(444/213/149건): baseline은 RAG 과거데이터 전용으로 설계.
    1년치 자료가 미결 Todo로 뜨는 건 비현실적 → Todo/이슈는 라이브 업로드 데모 때만 생성하는 설계.
  - 남긴 것: documents + document_chunks + chunk_embeddings (RAG 핵심) / calendar_events 136 / 마스터(teams 2 / users 18 / departments 6).
  - RAG 검증: `POST /chat` 분석형 질문 → gpt-4o가 baseline 문서 인용 답변 생성(DOC-0096/0075/0045 등),
    retrieve score 0.47~0.54로 임계(0.41) 통과. "monthly operation status report" 쿼리만 임계 미달(정상 — 해당 주제 문서 없음).
  - 라이브 데모용 2개(`C:\Users\soldesk\demo_docs\`): DOC-0001_meeting_notes_2025-06-25.md /
    DOC-0007_quality_claims_2025-06-07.md — baseline 미포함 확인, 발표 때 직접 업로드.
  - MESSY 84개는 baseline 미포함(필요 시 추후 적재 또는 라이브 추가 가능).

## handoff.js 보존 결정 기록 (2026-06-16, 최종)
- 정정: 한때 "미커밋 504줄을 폐기하고 dc49ee8로 되돌린다"는 방침이 있었으나 **취소됨**.
- 최종: 504줄은 월요일(2026-06-15) 사용자+Codex가 만든 인수인계 센터 핵심 작업 →
  **보존·정식 커밋(03b02ca) 완료.** 되돌리지 않음.
- 참고(되돌린 게 아님): 직전 커밋 dc49ee8(22줄)은 "신규 입사자 온보딩" 모듈이었고,
  504줄본이 이를 인수인계 센터 전면(퇴사자/신규입사자 카드 + AI 파이프라인 데모/보드)으로 확장함.

## 다음 작업 (다음 AI가 할 일)
- 🔴 **[발표 전 필수 해결] 로그인/로그아웃 + 토큰 만료 복구** (기존 "제품 결정 대기"에서 격상, 2026-06-17).
  진단 결론: 로그인/로그아웃 플로우가 반쪽만 이식됨(`src/Login.js`·`__workraderLogout`·login CSS가
  CRA src에만 있고 서빙 vite 번들엔 없음 → `logout()`이 reload만 하고 같은 대시보드로 복귀).
  **사용자가 "발표 때 로그아웃이 무엇을 해야 하는지" 정한 뒤** app.js의 `logout()`을 그에 맞게 수정.
  - **증상 실증됨(2026-06-17)**: 토큰 만료 시 인증 기능(예: 문서 삭제 `DELETE /api/v1/documents/{id}`)이
    **401**, 그런데 **로그인 화면이 vite 번들에 없어 재로그인 불가** → 한 번 만료되면 **복구 불가**.
    (실제로 이번에 테스트 더미 문서 삭제가 이 401 때문에 막힘.)
  - **발표 리스크**: 데모 중 토큰이 만료되면 인증 기능이 죽고 되살릴 길이 없음.
  - **발표 전 팀 결정 필요**: ㄱ(로그아웃 숨김 + 직전 새 토큰 발급) / ㄴ(토큰 클리어 후 안내) /
    ㄷ(로그인 화면 신설). 정한 뒤 app.js `logout()` + 토큰 갱신 흐름 수정.
  - **추가 확인 필요**: 토큰 유효기간 설정값(`JWT_EXPIRE_HOURS`)이 데모 시간 동안 안 만료되는지 점검.
  - 별도(정리 보류): 테스트 더미 문서 **6407772e**(`ops_dummy.txt`) + 연결 Todo 3 / Issue 2 **미삭제** —
    토큰 401 로 막혀 보류. 나중에 **DB 직접 삭제** 또는 토큰 복구 후 `DELETE /api/v1/documents/6407772e...` 로 정리.
- 화면 전환 — **9개 전부 전환완료**(설정·보고서·캘린더·이슈·대시보드·인수인계·운영분석·AI Assistant·Todo).
  남은 바닐라 화면 없음. 이후 작업은 위 로그아웃/토큰 이슈 + 공통 인프라(공유 API 클라이언트 등) 중심.
  - 후보 검토 시 반드시 **api-integration.js 런타임 주입 여부 + 바닐라 리스너 바인딩 방식까지** 조사할 것(아래 교훈 참고).
  - 패턴: 기존 노드에 createRoot 렌더(ID 스코프 CSS 상속), 전역 함수 재사용.
    화면 전체가 vanilla 소유면 보고서·캘린더처럼 **memo 1회 렌더(재렌더 0)**, React 관리 상태가 있으면
    설정처럼 MutationObserver + memo 껍데기 혼용. 복잡/주입 패널은 React.memo 껍데기 + vanilla 공존.
    vanilla가 그리는 DOM에 표시만 더하려면(캘린더 +N더보기처럼) #노드에 MutationObserver 후처리.
  - 빌드: `npm run vite:build` (dist/ 절대 생성 금지). 폴백 스위치 패턴 유지.
- 그 외 남은 바닐라 3개 화면은 계속 유지, 한 번에 한 화면씩.

## 백로그 (나중에 할 일)
- [✅ 해결됨] (2026-06-17) AI Assistant 채팅 RAG "Azure OpenAI 연결 실패" — **키 문제 아니었음.**
      원인: `.env` 의 `AZURE_OPENAI_ENDPOINT` 가 **Foundry 프로젝트 URL**(`...services.ai.azure.com/api/projects/...`)
      + 미지원 API 버전이었음. 표준 `AsyncAzureOpenAI` 클라이언트와 형식 불일치 → 400/404.
      해결 (**`.env` 3줄, 코드 0줄**):
      · `AZURE_OPENAI_ENDPOINT = https://<리소스>.openai.azure.com/`
        (Foundry "Azure OpenAI 엔드포인트" 칸 값. ⚠️ **끝에 `/openai/v1` 붙이지 말 것 — 베이스 URL만.**
         `/openai/v1` 붙이면 SDK 가 경로를 또 붙여 404)
      · `AZURE_OPENAI_API_VERSION = 2024-10-21`
      · 키/배포명(gpt-4o, text-embedding-3-large)은 그대로
      검증: 채팅 gpt-4o 응답 + 임베딩 3072차원 + 문서분석(업로드→임베딩→Todo/Issue 추출) 끝단까지 성공.
      ⚠️ **`.env` 는 git 미추적 → 각 PC 에 직접 적용해야 함. 통합/발표 PC 도 같은 값으로 맞출 것.**
- [ ] 멤버 관리: 담당자별 ID/이메일 수정 + 비밀번호 변경 기능.
      ⚠️ 백엔드 API 없음 → PATCH /members/{id}, 비번 변경 엔드포인트 + DB 스키마
      (멤버 비번 필드) 먼저 필요. 보안: 비번 평문 노출 금지, '변경' 폼만. DB 담당이 작업.
- [ ] 캘린더 역할 기반 기능 (역할 3단계: 시스템관리자 / PM=팀장 / 팀원). ⚠️ 백엔드/DB 선행 필요.
      - 관리자: 이슈로그가 가장 먼저 보이게. 일정은 캘린더 크기에 맞춰 일부만(나머지 더보기).
      - PM(팀장): 본인 포함 팀원 선택 → 선택 팀원 이슈만 필터. 날짜 클릭 시 휴가자/출장자 구분 표시
        + 상세 패널 양쪽으로 넓게. 팀장 전용 항목(예: 퇴사자 면담)은 팀장만 노출.
      - 팀원: 본인 일정 + 팀 전체 대표 일정만. (TODO 등록 시 '전체공유/팀장팀원만공유' 구분 필요)
      - 권한 위임: 위임받으면 그 팀원 일정을 받아서 볼 수 있게 (인수인계 서비스 연계).
      ⚠️ 프론트 숨기기만 하면 가짜(F12로 다 보임) → 역할별 필터는 백엔드 API/DB에서. DB담당 작업.

## 주의사항 / 막힌 점
- ★교훈(설정 전환에서 배움): 단순해 보이는 화면도 **런타임 주입 패널**이 있을 수 있다.
  예) 담당자(멤버) 패널은 index.html에 없고 api-integration.js가 `#s-settings`에 주입함.
  화면 조사 시 **index.html 정적 HTML뿐 아니라 api-integration.js(및 *-enhancements.js)의
  런타임 DOM 주입까지 반드시 확인**할 것. 놓치면 React가 노드를 덮어써 깜빡임 발생.
  → 주입형 API 패널은 React.memo 껍데기 + vanilla 리스트 공존 패턴으로 처리.
- ★교훈(보고서 전환에서 배움): `nav(screen)`(app.js)은 화면 진입 시 화면별 init을 호출한다
  (예: `if(screen==='reports') initReportsScreen()`). 이 init이 **리스너를 dataset 가드로 idempotent
  하게 바인딩**(textContent/속성 스캔)하면, React가 동일 구조를 **1회만** 렌더해 두기만 하면 진입 시
  vanilla가 그 React 노드에 그대로 바인딩된다 → **app.js 무수정**으로 전환 가능(인라인 onClick도 불필요).
  단 React가 재렌더하면 vanilla가 채운 DOM(목록/contenteditable/탭 active)을 되돌릴 수 있으니
  **memo + 재렌더 0**(MutationObserver 미사용)으로 둘 것. contenteditable은 uncontrolled(+
  suppressContentEditableWarning)로 두어 vanilla의 innerHTML 읽기/쓰기를 방해하지 말 것.
- ★교훈(AI Assistant 전환에서 배움): 채팅 메시지는 app.js `appendChatMsg()` 가 `#chatArea` 에
  **appendChild 로 live 하게 쌓는다**(+ `renderCurrentChatMessages()` 가 innerHTML 교체로 세션 복원).
  → **재렌더 0 필수 — memo 1회 렌더.** 운영분석과 동일 패턴이지만, 여기는 런타임 주입 패널이 없는 대신
  메시지가 live append 되므로 React 가 재렌더하면 진행 중 **대화 전체가 intro 로 리셋**된다(운영분석은
  주입 패널 소실, 채팅은 대화 소실 — 위험 형태만 다름). dangerouslySetInnerHTML 로 `#chatArea` 를 진짜
  element 로 두면 vanilla 의 append/innerHTML 교체가 그대로 작동하고, React 가 안 그리는 한 보존된다.
  참고: RAG `POST /chat` 은 api-integration.js 몽키패치가 아니라 app.js `sendMsg` 에 직접 내장이라
  채팅 전환은 api-integration.js 와 무관(운영분석의 startAnalysis 몽키패치와 대비).
- ★교훈(운영 로그 분석 전환에서 배움): `#s-analysis .content` 에는 **두 외부 JS 가 런타임에 패널을
  prepend** 한다 — workflow-v2.js `ensureQueues()`→`#workflowQueueCenter`(승인 대기 Todo/Risk 큐),
  role-workflow-enhancements.js `ensureApprovalCenter()`→`#analysisApprovalCenter`(관리자 승인함).
  React 가 `.content` 를 한 번이라도 재렌더하면 이 주입 패널이 사라진다.
  → **재렌더 0 필수 — memo 1회 렌더(MutationObserver/key 미사용)로 해결.** dangerouslySetInnerHTML 로
  `.content` 를 진짜 element 로 두면, React 가 다시 안 그리는 한 vanilla 가 prepend 한 자식은 보존된다.
  (설정 멤버패널과 같은 주입형 위험이지만 여기선 패널이 2개 + 역할 기반이라 더 주의.)
- ★방어수정(2026-06-16): `nav()`에 **null 가드 + 화면별 init try/catch** 적용 완료. 이제 화면 노드가
  없거나 한 화면 init이 에러나도 nav 전체가 throw로 멈추지 않음(에러는 console.warn). 향후 React 전환에서
  `#s-OOO` 노드를 없애는 변경을 하더라도 nav가 죽지 않는다(단 가능하면 컨테이너 노드는 유지할 것).
- ⏸ **로그아웃은 제품 결정 대기 중**(이번 nav 수정엔 미포함): 진단 결과 로그인/로그아웃 플로우가
  반쪽만 이식됨 — `__workraderLogout`·로그인 화면(`src/Login.js`)·login CSS는 **CRA `src/`에만** 있고
  서빙되는 vite 번들(`react-mount/main.jsx`)엔 없음(죽은 코드). 그래서 `logout()`은 reload 후
  로그인 화면이 없어 같은 대시보드(기본 정체성 김희진)로 복귀 → "로그아웃 무효". 인증 강제 환경이면
  reload 후 401로 화면 깨질 수 있음. **발표 시나리오에서 로그아웃이 무엇을 해야 하는지 확정 후 처리**
  (옵션: ㄱ 데모용 숨김/토스트 / ㄴ 토큰 클리어 후 안내 / ㄷ 로그인 화면 신설).
- app.js(3305줄)에 거의 모든 화면 로직이 몰려있음. 화면 전환 = app.js에서 해당 부분 추출.
- workflow-v2.js는 이슈/리스크 검토(renderPendingIssues 등). 이슈 화면 전환 시 반드시 함께 보존.
- frontend/build/ = 어제의 CRA 전면교체 시도본(깨짐). 삭제 금지, 무시만. main.py가 이미 무시함.
- venv: 메인 프로젝트 루트의 `.venv-run311`(Python 3.11)에 uvicorn 등 의존성 있음.
  실행: opsradar2/ 에서 `python scripts/dev_server.py` (포트 8002 고정).
- 콘솔 401 invalid token: 8002에서 workflow-v2.js / api-integration.js가 401(invalid token)을
  내는 건 **로그인 토큰 만료** 때문이며 1단계 Vite 작업과 무관한 기존 이슈. React main.js와는 별개.
  나중에 세션/토큰 갱신 처리를 점검할 것(로그인 후 access_token 재발급 흐름 확인).
- Vite 빌드 산출물 public/static/react/main.js 는 gitignore됨(생성물). 소스 변경 후
  `npm run vite:build` 재실행 필요. 서버 재기동 없이 FileResponse라 즉시 반영됨.
