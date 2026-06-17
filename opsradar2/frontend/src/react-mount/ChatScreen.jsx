// AI Assistant(s-chat) 화면의 React 버전 (스트랭글러 5번째 — 운영분석/캘린더 패턴).
//
// (A) dangerouslySetInnerHTML 방식: 기존 #s-chat 내부 HTML 을 verbatim 주입한다.
// inline onclick/onkeydown/oninput/style 을 전부 그대로 보존하므로, 브라우저가 innerHTML
// 파싱 시 이를 네이티브 이벤트로 등록 → 기존 전역 함수(sendMsg/autoResize/
// createNewChatSession/clearCurrentChatSession 등)를 그대로 호출. React 관리 상태 0개.
//
// ⚠️ 재렌더 절대 금지(memo + 재렌더 0, state/effect/MutationObserver/key 미사용):
//   - app.js appendChatMsg() 는 #chatArea 에 메시지 div 를 appendChild 로 "쌓는다".
//   - app.js renderCurrentChatMessages() 는 #chatArea.innerHTML 을 교체 후 세션 메시지를 재append.
//   React 가 #chatArea 를 한 번이라도 재렌더하면 쌓인 대화가 intro 로 리셋된다.
//   → memo 로 1회만 렌더하고 main.jsx 에서 재렌더를 절대 트리거하지 않는다. 그러면 #chatArea/
//   #chatSessionList/컨텍스트 리스트가 진짜 element 로 남아 vanilla 가 그대로 채운다.
//   (#s-chat 에는 런타임 주입 패널이 없고, RAG /chat API 는 app.js sendMsg 에 내장 — 몽키패치 없음.)
//
// 구조 보존(픽셀 동일): #s-chat 는 .screen(flex column) 컨테이너이고 직계 자식은
// .topbar.chat-topbar 와 .chat-workspace 두 개다. createRoot(#s-chat) 는 자식으로 렌더하므로,
// 래퍼 div 를 끼우면 .screen 의 flex 레이아웃이 깨진다. 따라서 프래그먼트로 두 직계 자식을
// 각각 직접 렌더하고 그 안쪽만 dangerouslySetInnerHTML 로 채운다(원본 직계 구조 그대로).
//
// 폴백: localStorage.opsradar_react_chat = 'off' (+새로고침) → React 미마운트, 바닐라 복귀.
import { memo } from 'react'

// index.html #s-chat 의 <div class="topbar chat-topbar"> 내부 (verbatim)
const TOPBAR_INNER = `
    <div>
      <div class="topbar-title">AI Assistant</div>
      <div class="chat-topbar-sub">운영 데이터 기반 질의응답 · 일정 등록 · 근거 문서 연결</div>
    </div>
    <div class="chat-top-actions">
      <span class="badge b-success" style="display:flex;align-items:center;gap:4px"><i class="ti ti-circle-filled" style="font-size:8px"></i> RAG 연결됨</span>
      <button class="tbtn" type="button" onclick="createNewChatSession(true)"><i class="ti ti-plus"></i> 새 분석 세션</button>
    </div>
  `

// index.html #s-chat 의 <div class="chat-workspace"> 내부 (verbatim)
const WORKSPACE_INNER = `
    <aside class="chat-session-panel" id="chatSessionPanel">
      <div class="chat-session-head">
        <div>
          <div class="chat-context-eyebrow">Analysis Sessions</div>
          <strong>운영 질문 기록</strong>
        </div>
        <button class="chat-session-add" type="button" onclick="createNewChatSession(true)" title="새 분석 세션"><i class="ti ti-plus"></i></button>
      </div>
      <div class="chat-session-actions">
        <button class="tbtn" type="button" onclick="clearCurrentChatSession()"><i class="ti ti-eraser"></i> 현재 세션 초기화</button>
      </div>
      <div class="chat-session-list" id="chatSessionList"></div>
    </aside>
    <section class="chat-main-panel">
      <div class="chat-area" id="chatArea">
        <div class="msg chat-intro-msg"><div class="msg-av av-ai"><i class="ti ti-sparkles" style="font-size:13px"></i></div>
        <div><div class="ai-analysis-card chat-welcome-card"><div class="ai-card-kicker">OPS ASSISTANT</div><div class="ai-card-title">운영 데이터 기반으로 질문에 답변드립니다.</div><p><strong>일정 등록도 자연어로</strong> 입력하시면 캘린더에 자동 반영됩니다.</p></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          <div class="sq" onclick="sendMsg('현재 가장 위험한 이슈는?')">현재 가장 위험한 이슈는?</div>
          <div class="sq" onclick="sendMsg('이번주 미완료 Todo 알려줘')">이번주 미완료 Todo</div>
          <div class="sq" onclick="sendMsg('이성우 5/26 부재')">이성우 5/26 부재</div>
          <div class="sq" onclick="sendMsg('이성우 다음주 화요일 외부 일정')">이성우 다음주 화요일 외부 일정</div>
        </div></div></div>
      </div>
      <div class="chat-input-bar">
        <textarea class="chat-input" id="chatInput" rows="1" placeholder="운영 상태 질문 또는 일정 등록..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMsg()}" oninput="autoResize(this)"></textarea>
        <button class="send-btn" id="sendBtn" onclick="sendMsg()"><i class="ti ti-send" style="font-size:14px"></i></button>
      </div>
    </section>
    <aside class="chat-context-panel" id="chatContextPanel">
      <div class="chat-context-head"><div><div class="chat-context-eyebrow">Operational Context</div><strong>근거 문서와 연결 항목</strong></div><i class="ti ti-database-search"></i></div>
      <div class="chat-context-section">
        <div class="chat-context-label">출처 문서</div>
        <div id="chatSourceList" class="chat-context-list"><div class="chat-context-empty">질문 후 관련 출처가 표시됩니다.</div></div>
      </div>
      <div class="chat-context-section">
        <div class="chat-context-label">관련 Todo</div>
        <div id="chatTodoList" class="chat-context-list"><div class="chat-context-empty">연결된 Todo 없음</div></div>
      </div>
      <div class="chat-context-section">
        <div class="chat-context-label">관련 Issue</div>
        <div id="chatIssueList" class="chat-context-list"><div class="chat-context-empty">연결된 Issue 없음</div></div>
      </div>
    </aside>
  `

function ChatScreen() {
  return (
    <>
      <div className="topbar chat-topbar" dangerouslySetInnerHTML={{ __html: TOPBAR_INNER }} />
      <div className="chat-workspace" dangerouslySetInnerHTML={{ __html: WORKSPACE_INNER }} />
    </>
  )
}

// memo: props 가 없으므로 부모가 재렌더해도 이 컴포넌트는 다시 렌더되지 않는다.
// (main.jsx 는 애초에 재렌더를 트리거하지 않지만, 이중 안전장치로 memo 적용.)
export default memo(ChatScreen)
