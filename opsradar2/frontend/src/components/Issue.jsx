import { useEffect, useMemo, useState } from "react";
import { AiCandidatePreview, EvidencePanel, ReviewStatusBadge } from "./ProductDirection.jsx";

const emptySnapshot = {
  currentTab: "confirmed",
  issues: [],
  selectedIssue: null,
  counts: { confirmed: 0, candidate: 0, resolved: 0 },
};

function callLegacy(name, ...args) {
  window[name]?.(...args);
}

function severityBadge(issue) {
  if (issue.type === "candidate") {
    return (
      <>
        <span className="badge b-warn">?꾨낫</span>
        <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--warn)", fontWeight: 500 }}>
          {issue.confidence ?? 0}%
        </span>
      </>
    );
  }

  const className = issue.severity === "high" ? "b-danger" : issue.severity === "medium" ? "b-warn" : "b-gray";
  const label = issue.severity === "high" ? "High" : issue.severity === "medium" ? "Medium" : "Low";
  return <span className={`badge ${className}`}>{label}</span>;
}

function statusBadge(status) {
  if (status === "in_progress") return <span className="badge b-warn">In Progress</span>;
  if (status === "resolved") return <span className="badge b-success">Resolved</span>;
  return <span className="badge b-gray">Open</span>;
}

function EmptyIssueList() {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
      <i className="ti ti-check" style={{ fontSize: 28, display: "block", marginBottom: 8 }} />
      이 탭에 항목이 없습니다.
      <AiCandidatePreview title="결제 API 응답 지연 Issue 후보" />
    </div>
  );
}

function IssueCard({ issue }) {
  const isCandidate = issue.type === "candidate";

  return (
    <article
      className={`issue-card ${issue.selected ? "selected" : ""} ${isCandidate ? "candidate" : ""}`}
      onClick={() => callLegacy("selectIssue", issue.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          callLegacy("selectIssue", issue.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="issue-hd">
        {severityBadge(issue)}
        <div className="issue-title">{issue.title}</div>
        {statusBadge(issue.status)}
        {issue.hasTodo ? (
          <span className="badge b-success" style={{ fontSize: 9 }}>
            Todo ?앹꽦??
          </span>
        ) : null}
        <ReviewStatusBadge status={isCandidate ? "pending_review" : issue.status === "resolved" ? "official" : "approved"} />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <span className="badge b-gray">{issue.src || "?먮룞 媛먯?"}</span>
        {issue.days > 0 ? <span className="badge b-gray">{issue.days}?쇱㎏</span> : null}
        {issue.assignee ? (
          <span className="badge b-gray">?대떦: {issue.assignee}</span>
        ) : (
          <span className="badge b-danger" style={{ fontSize: 9 }}>
            ?대떦??誘몄???
          </span>
        )}
      </div>
      <div className="issue-desc">{issue.desc}</div>
      <div className="issue-footer">
        <div style={{ fontSize: 10, color: "var(--text3)" }}>AI ?먮룞 ?먯?</div>
        <div style={{ display: "flex", gap: 5 }}>
          {isCandidate ? (
            <>
              <button
                className="tbtn primary"
                type="button"
                style={{ fontSize: 10, padding: "4px 8px", background: "var(--danger)", borderColor: "var(--danger)" }}
                onClick={(event) => {
                  event.stopPropagation();
                  callLegacy("openConfirmIssue", issue.id);
                }}
              >
                ?댁뒋 ?뺤젙
              </button>
              <button
                className="tbtn"
                type="button"
                style={{ fontSize: 10, padding: "4px 8px", color: "var(--text3)" }}
                onClick={(event) => {
                  event.stopPropagation();
                  callLegacy("doRemoveIssue", issue.id);
                }}
              >
                臾댁떆
              </button>
            </>
          ) : issue.type === "resolved" ? null : (
            <button
              className="tbtn"
              type="button"
              style={{ fontSize: 10, padding: "4px 8px" }}
              onClick={(event) => {
                event.stopPropagation();
                callLegacy("openTodoCreate", issue.id);
              }}
            >
              <i className="ti ti-plus" /> ???Todo ?앹꽦
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function IssueDetail({ issue }) {
  if (!issue) {
    return (
      <div className="detail-empty" id="issueDetailEmpty">
        <i className="ti ti-hand-click" />
        <span>
          ?댁뒋瑜??대┃?섎㈃
          <br />
          ?곸꽭 ?댁슜???쒖떆?⑸땲??
        </span>
      </div>
    );
  }

  return (
    <>
      <div id="issueDetailContent" className="fade-up" style={{ display: "block", padding: 14, overflowY: "auto", flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", marginBottom: 10, lineHeight: 1.5 }}>
          {issue.title}
        </div>
        {issue.chunk ? (
          <>
            <div className="detail-section">異쒖쿂 泥?겕</div>
            <div className="chunk-box">
              <div className="chunk-meta">
                <i className="ti ti-file-text" style={{ fontSize: 11, color: "var(--accent)" }} />
                {issue.src}
              </div>
              {issue.chunk}
            </div>
          </>
        ) : null}
        {issue.domino?.length ? (
          <>
            <div className="detail-section">?꾨????곹뼢</div>
            <div className="domino">
              <div className="domino-lbl">???꾪뿕?쒓?</div>
              {issue.domino.map((item) => (
                <div key={item}>??{item}</div>
              ))}
              {issue.dominoFinal ? (
                <div className="domino-final" style={{ marginTop: 4 }}>
                  ??{issue.dominoFinal}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
        {issue.history?.length ? (
          <>
            <div className="detail-section">?곹깭 蹂???대젰</div>
            {issue.history.map((item) => (
              <div className="history-row" key={`${item.date}-${item.s}-${item.note}`}>
                <div className="history-date">{item.date}</div>
                <span className={`badge ${item.s === "Open" ? "b-gray" : item.s === "Resolved" ? "b-success" : "b-warn"}`}>
                  {item.s}
                </span>
                <div className={item.cls} style={{ flex: 1, fontSize: 10, color: item.cls ? "inherit" : "var(--text3)" }}>
                  {item.note}
                </div>
              </div>
            ))}
          </>
        ) : null}
        <EvidencePanel
          compact
          evidence={{
            title: issue.title,
            reviewStatus: issue.type === "candidate" ? "pending_review" : issue.status === "resolved" ? "official" : "approved",
            sourceDocument: issue.src || "operation_log_test_20260605.txt",
            evidenceText: issue.chunk || issue.desc || "운영 기록에서 고객 영향 가능성이 있는 신호가 확인되었습니다.",
            aiReason: issue.dominoFinal || "리스크 전파 가능성이 있어 운영 이슈 후보로 제안합니다.",
            sourceType: issue.type === "candidate" ? "AI 제안" : "공식 Issue",
          }}
        />
        {issue.createdTodos?.length ? (
          <>
            <div className="detail-section">?앹꽦?????Todo</div>
            {issue.createdTodos.map((todo) => (
              <div
                key={todo.id}
                style={{
                  background: "var(--success-soft)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 10px",
                  fontSize: 11,
                  color: "var(--success)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <i className="ti ti-checkbox" style={{ fontSize: 12 }} />
                {todo.title}
              </div>
            ))}
          </>
        ) : null}
      </div>
      {issue.type === "confirmed" && issue.status !== "resolved" ? (
        <div id="issueDetailActions" style={{ display: "flex", padding: "12px 14px", borderTop: "1px solid var(--border)", flexDirection: "column", gap: 6 }}>
          <>
            <button className="tbtn primary" type="button" onClick={() => callLegacy("openTodoCreate", issue.id)} style={{ justifyContent: "center" }}>
              <i className="ti ti-plus" /> ???Todo ?앹꽦
            </button>
            <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
              <button className="tbtn" type="button" style={{ flex: 1, justifyContent: "center", color: "var(--success)" }} onClick={() => callLegacy("resolveIssue", issue.id)}>
                <i className="ti ti-check" /> ?닿껐 ?꾨즺
              </button>
            </div>
          </>
        </div>
      ) : issue.type === "candidate" ? (
        <div id="issueDetailActions" style={{ display: "flex", padding: "12px 14px", borderTop: "1px solid var(--border)", flexDirection: "column", gap: 6 }}>
          <>
            <button
              className="tbtn primary"
              type="button"
              onClick={() => callLegacy("openConfirmIssue", issue.id)}
              style={{ justifyContent: "center", background: "var(--danger)", borderColor: "var(--danger)" }}
            >
              <i className="ti ti-alert-triangle" /> ?댁뒋 ?뺤젙
            </button>
            <button className="tbtn" type="button" onClick={() => callLegacy("doRemoveIssue", issue.id)} style={{ justifyContent: "center", color: "var(--text3)", marginTop: 4 }}>
              臾댁떆
            </button>
          </>
        </div>
      ) : null}
    </>
  );
}

export default function Issue() {
  const [snapshot, setSnapshot] = useState(emptySnapshot);

  useEffect(() => {
    function handleIssueState(event) {
      setSnapshot({ ...emptySnapshot, ...event.detail });
    }

    window.addEventListener("opsradar:issue-state-updated", handleIssueState);
    const timer = window.setTimeout(() => callLegacy("renderIssues"), 0);

    return () => {
      window.removeEventListener("opsradar:issue-state-updated", handleIssueState);
      window.clearTimeout(timer);
    };
  }, []);

  const counts = snapshot.counts || emptySnapshot.counts;
  const currentTab = snapshot.currentTab || "confirmed";
  const tabs = useMemo(
    () => [
      { id: "confirmed", label: "?뺤젙 ?댁뒋", count: counts.confirmed, badge: "b-danger" },
      { id: "candidate", label: "?댁뒋 ?꾨낫", count: counts.candidate, badge: "b-warn" },
      { id: "resolved", label: "Resolved", count: counts.resolved, badge: "b-gray" },
    ],
    [counts.candidate, counts.confirmed, counts.resolved],
  );

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">?댁뒋 濡쒓렇</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="tbtn primary" type="button" onClick={() => callLegacy("openIssueCreateModal")}>
            <i className="ti ti-plus" /> ?섎룞 ?깅줉
          </button>
          <div className="chip" data-current-date="short">?ㅻ뒛 ?좎쭨</div>
        </div>
      </div>
      <div className="ctx-banner" id="issuectxBanner">
        <i className="ti ti-circle-check" />
        <span id="issuectxText">Todo媛 ?앹꽦?섏뿀?듬땲?? Todo ?붾㈃?먯꽌 ?뺤씤?섏꽭??</span>
        <button
          className="tbtn"
          type="button"
          onClick={() => callLegacy("nav", "todo")}
          style={{ marginLeft: "auto", fontSize: 10, padding: "3px 8px", color: "var(--success)", borderColor: "var(--success)" }}
        >
          Todo ?뺤씤 ??
        </button>
      </div>
      <div className="tabs">
        {tabs.map((tab) => (
          <button className={`tab${currentTab === tab.id ? " active" : ""}`} type="button" key={tab.id} onClick={() => callLegacy("switchIssueTab", tab.id)}>
            {tab.label} <span className={`badge ${tab.badge}`} id={tab.id === "confirmed" ? "i-conf-cnt" : tab.id === "candidate" ? "i-cand-cnt" : undefined}>{tab.count}</span>
          </button>
        ))}
      </div>
      <div className="body-wrap">
        <div className="issue-list" style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }} id="issueList">
          {snapshot.issues?.length ? snapshot.issues.map((issue) => <IssueCard issue={issue} key={issue.id} />) : <EmptyIssueList />}
        </div>
        <div className="detail-panel">
          <IssueDetail issue={snapshot.selectedIssue} />
        </div>
      </div>
    </>
  );
}
