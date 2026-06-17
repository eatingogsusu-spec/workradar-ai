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
| Dashboard | s-dashboard | app.js + workflow-v2.js | **전환중** (박주원, feature/issues-dashboard-react) |
| 운영 로그 분석 | s-analysis | app.js | 기존바닐라 |
| Todo | s-todo | app.js + todo-calendar-enhancements.js | 기존바닐라 |
| 이슈 로그 | s-issues | React(IssuesScreen.jsx) + workflow-v2/app.js 동작 vanilla 공존 | **전환완료** (박주원) |
| 캘린더 | s-calendar | React(CalendarScreen.jsx) + 동작 vanilla 공존 | **전환완료** |
| 인수인계 센터 | s-knowledge | handoff.js (504줄·월요일작업 03b02ca) | 기존바닐라 |
| 보고서 | s-reports | React(ReportsScreen.jsx) + report.js/app.js 동작 vanilla 공존 | **전환완료** |
| AI Assistant | s-chat | app.js | 기존바닐라 |
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

## handoff.js 보존 결정 기록 (2026-06-16, 최종)
- 정정: 한때 "미커밋 504줄을 폐기하고 dc49ee8로 되돌린다"는 방침이 있었으나 **취소됨**.
- 최종: 504줄은 월요일(2026-06-15) 사용자+Codex가 만든 인수인계 센터 핵심 작업 →
  **보존·정식 커밋(03b02ca) 완료.** 되돌리지 않음.
- 참고(되돌린 게 아님): 직전 커밋 dc49ee8(22줄)은 "신규 입사자 온보딩" 모듈이었고,
  504줄본이 이를 인수인계 센터 전면(퇴사자/신규입사자 카드 + AI 파이프라인 데모/보드)으로 확장함.

## 다음 작업 (다음 AI가 할 일)
- ⏸ **로그아웃 후속처리(제품 결정 대기)** — nav 방어수정(커밋 fd9409a)은 끝남. 남은 건 로그아웃.
  진단 결론: 로그인/로그아웃 플로우가 반쪽만 이식됨(`src/Login.js`·`__workraderLogout`·login CSS가
  CRA src에만 있고 서빙 vite 번들엔 없음 → `logout()`이 reload만 하고 같은 대시보드로 복귀).
  **사용자가 "발표 때 로그아웃이 무엇을 해야 하는지" 정한 뒤** app.js의 `logout()`을 그에 맞게 수정.
  (옵션: ㄱ 데모용 숨김/토스트 / ㄴ 토큰 클리어 후 안내 / ㄷ 로그인 화면 신설) — 자세한 건 주의사항 참고.
- 🟦 **선점(2026-06-17, 박주원)**: 이슈 로그(s-issues) + 대시보드(s-dashboard) 두 화면은
  `feature/issues-dashboard-react` 브랜치에서 박주원이 작업 중(둘 다 workflow-v2 의존이라 묶음).
  이슈 로그 먼저 진행. 다른 사람은 이 두 화면 손대지 말 것.
- 4번째 화면 전환 — 대상 미정(사용자와 상의). 남은 바닐라 6개: Dashboard / 운영 로그 분석 /
  Todo / 이슈 로그 / 인수인계 센터 / AI Assistant.
  - 후보 검토 시 반드시 **api-integration.js 런타임 주입 여부 + 바닐라 리스너 바인딩 방식까지** 조사할 것(아래 교훈 참고).
  - 패턴: 기존 노드에 createRoot 렌더(ID 스코프 CSS 상속), 전역 함수 재사용.
    화면 전체가 vanilla 소유면 보고서·캘린더처럼 **memo 1회 렌더(재렌더 0)**, React 관리 상태가 있으면
    설정처럼 MutationObserver + memo 껍데기 혼용. 복잡/주입 패널은 React.memo 껍데기 + vanilla 공존.
    vanilla가 그리는 DOM에 표시만 더하려면(캘린더 +N더보기처럼) #노드에 MutationObserver 후처리.
  - 빌드: `npm run vite:build` (dist/ 절대 생성 금지). 폴백 스위치 패턴 유지.
- 그 외 화면(인수인계 센터 포함)은 계속 바닐라 유지, 한 번에 한 화면씩.

## 백로그 (나중에 할 일)
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
