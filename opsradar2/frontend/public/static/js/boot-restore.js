// 부팅 라우팅/권한 처리 (담당: 대시보드 / 운영 로그 분석 화면의 F5 이슈)
//
//  [C]  현재 경로 영속화·복원 — nav() 마다 localStorage 저장, 부팅 시 복원(라우터 없음 보완).
//  [A6] role 서버 재조회 — /auth/me 로 최신 role 을 받아 캐시(localStorage) 갱신 후 역할 UI 재적용.
//  [A5] 로딩가드 — html.app-booting 동안 오버레이로 가려, role 확정 전 화면(팀원↔관리자) 깜빡임 제거.
//
// race condition 처리:
//  - 가드 해제는 reload() 렌더가 아니라 **role 재조회 완료 + 새 role 재렌더 이후** 시점에 한다.
//    (안 그러면 캐시(팀원) UI 가 먼저 그려졌다가 관리자로 바뀌는 깜빡임이 남음)
//  - /auth/me 가 실패하거나 2.5s 안에 응답이 없으면 **캐시 role 로 폴백하고 가드를 푼다**(무한로딩 방지).
//
// 이 스크립트는 모든 화면 JS(app/enhancements/workflow-v2) **다음**에 로드되어 최종 nav 를 감싼다.
(function () {
  "use strict";

  var SCREEN_KEY = "opsradar_current_screen";
  var VALID = ["dashboard", "todo", "issues", "calendar", "analysis", "chat", "knowledge", "reports", "settings"];
  var ROLE_TIMEOUT_MS = 2500;
  var guardReleased = false;

  // [A5] 가드 해제(멱등). 어느 경로로 호출돼도 한 번만 적용.
  function removeGuard() {
    if (guardReleased) return;
    guardReleased = true;
    document.documentElement.classList.remove("app-booting");
  }

  // [C] 최종 nav 를 한 겹 더 감싸 화면 이동마다 현재 경로를 저장한다.
  function wrapNavPersist() {
    if (window.__navPersistWrapped || typeof window.nav !== "function") return;
    var base = window.nav;
    window.nav = function (screen) {
      var ret = base.apply(this, arguments);
      try {
        if (VALID.indexOf(screen) !== -1) localStorage.setItem(SCREEN_KEY, screen);
      } catch (e) {}
      return ret;
    };
    window.__navPersistWrapped = true;
  }

  function getToken() {
    try {
      return localStorage.getItem("access_token") || localStorage.getItem("token");
    } catch (e) {
      return null;
    }
  }

  // [A6] /auth/me 로 최신 role 을 받아 캐시 갱신. 2.5s 타임아웃/실패 시 false(=캐시 폴백)로 resolve.
  function refreshRole() {
    var token = getToken();
    if (!token) return Promise.resolve(false);

    var base = window.OPSRADAR_API_BASE || "/api/v1";
    var controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, ROLE_TIMEOUT_MS);
    var opts = { headers: { Authorization: "Bearer " + token } };
    if (controller) opts.signal = controller.signal;

    return fetch(base + "/auth/me", opts)
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (me) {
        if (me && me.role) {
          try {
            // ★ isLead() 는 opsradar_session.user 의 role/username 을 본다(role-workflow-enhancements).
            //   캐시 키(opsradar_user_role/role)만 바꾸면 역할 UI 가 안 따라오므로 session.user 를 머지한다.
            var sess = {};
            try { sess = JSON.parse(localStorage.getItem("opsradar_session") || "{}") || {}; } catch (e2) { sess = {}; }
            sess.user = Object.assign({}, sess.user || {}, me);
            localStorage.setItem("opsradar_session", JSON.stringify(sess));
            // 사이드바/getStoredUserInfo 용 캐시도 함께 갱신.
            localStorage.setItem("opsradar_user_role", me.role);
            localStorage.setItem("role", me.role);
          } catch (e) {}
          return true;
        }
        return false;
      })
      .catch(function () { return false; })
      .then(function (updated) { clearTimeout(timer); return updated; });
  }

  // 새 role 을 역할 가시성에 반영. renderDashboardLive 내부에서 applyRoleVisibility()+renderMemberDashboard()
  // 도 함께 호출되므로(role-workflow-enhancements), 관리자 전용 UI(담당자 관리 등)도 갱신된다.
  function applyRoleAndRender() {
    return Promise.resolve()
      .then(function () {
        if (typeof window.renderDashboardLive === "function") return window.renderDashboardLive();
      })
      .catch(function () {});
  }

  // [C] 저장된 경로 복원(없으면 dashboard 유지). nav(target) 이 그 화면 init 을 새 isLead 로 재실행 →
  // 화면별 관리자 UI(이슈 반려탭/설정 멤버패널 등)도 최신 role 로 다시 그려진다.
  function restoreScreen() {
    var target = "dashboard";
    try {
      var saved = localStorage.getItem(SCREEN_KEY);
      if (saved && VALID.indexOf(saved) !== -1) target = saved;
    } catch (e) {}
    try {
      if (typeof window.nav === "function") window.nav(target);
    } catch (e) {}
  }

  function boot() {
    wrapNavPersist();
    // role 캐시(localStorage)만 먼저 확정한 뒤, 경로 복원과 가드 해제를 진행한다.
    // ⚠️ [C] 경로 복원을 [A6] renderDashboardLive 에 await 로 묶지 않는다.
    //   renderDashboardLive 는 4중 몽키패치(ops/todo-calendar/role/workflow-v2)를 거치며 내부
    //   await 체인이 boot 시점에 resolve 되지 않는 경우가 있어, 묶으면 restoreScreen 이 영영
    //   실행되지 않아 F5 때 항상 dashboard 로 떨어졌다(실측 버그). 그래서 분리한다.
    refreshRole()
      .catch(function () {})
      .then(function () {
        // [A6] 역할 UI 재렌더는 백그라운드(await 안 함). role 캐시는 위에서 이미 갱신됨.
        try { applyRoleAndRender(); } catch (e) {}
        // [C] 저장된 경로 복원 → 복원 화면이 갱신된 role 로 렌더된다.
        restoreScreen();
        // [A5] 가드 해제.
        removeGuard();
      });
  }

  // [A5] 가능한 빨리 가드 ON(+ head 인라인에서 선반영). 안전 타임아웃으로 무한로딩 방지.
  document.documentElement.classList.add("app-booting");
  setTimeout(removeGuard, ROLE_TIMEOUT_MS + 1000);

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); }, { once: true });
  } else {
    setTimeout(boot, 0);
  }
})();
