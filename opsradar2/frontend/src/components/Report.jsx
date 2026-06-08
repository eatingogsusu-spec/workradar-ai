import { useEffect, useMemo, useState } from "react";
import { ReportQualityCheck } from "./ProductDirection.jsx";

const emptySnapshot = {
  currentPeriod: "weekly",
  query: "",
  reports: [],
  selectedReport: null,
  currentDraft: null,
  editorHtml: "",
};

const sectionLabels = {
  completed: "완료된 업무",
  inProgress: "진행 중인 업무",
  technical: "AI 및 기술적 상세 내용",
  risk: "리스크 관리 및 해결 방안",
  retrospective: "팀 회고",
  nextPlan: "차주 계획",
};

function callLegacy(name, ...args) {
  window[name]?.(...args);
}

function statusLabel(status) {
  return { draft: "초안", complete: "완료", shared: "공유됨" }[status] || "초안";
}

function statusClass(status) {
  if (status === "shared") return "report-status-shared";
  if (status === "complete") return "report-status-complete";
  return "report-status-draft";
}

function typeLabel(type) {
  return type === "monthly" ? "월간 보고서" : "주간 보고서";
}

function formatDate(value, withTime = false) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return withTime
    ? date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })
    : date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function normalizeSections(input) {
  const normalized = {
    completed: [],
    inProgress: [],
    technical: [],
    risk: [],
    retrospective: [],
    nextPlan: [],
  };

  if (!input) return normalized;
  if (Array.isArray(input)) {
    input.forEach(([title, items]) => {
      const key = Object.keys(sectionLabels).find((entry) => sectionLabels[entry] === title) || title;
      normalized[key] = Array.isArray(items) ? items : [items];
    });
    return normalized;
  }

  Object.keys(normalized).forEach((key) => {
    const value = input[key];
    normalized[key] = Array.isArray(value) ? value : (value ? [value] : []);
  });
  return normalized;
}

function ReportListItem({ report, active }) {
  return (
    <button
      className={`report-item ${active ? "active" : ""}`}
      type="button"
      onClick={() => callLegacy("selectReport", report.id)}
    >
      <div className="report-item-top">
        <div className="report-item-title text-content">{report.title || "운영 보고서"}</div>
        <span className={`badge ${statusClass(report.status)}`}>{statusLabel(report.status)}</span>
      </div>
      <div className="report-item-meta text-content">
        {typeLabel(report.type)} · {report.period || "-"}
        <br />
        생성일 {formatDate(report.createdAt)} · {report.author || "관리자"}
      </div>
      <div className="report-item-stats">
        <span className="report-stat-chip">주요 이슈 {Number(report.issues || 0)}건</span>
        <span className="report-stat-chip">완료 Todo {Number(report.doneTodos || 0)}건</span>
        <span className="report-stat-chip">미완료 Todo {Number(report.pendingTodos || 0)}건</span>
      </div>
    </button>
  );
}

function ReportSection({ title, items }) {
  const list = Array.isArray(items) && items.length ? items : ["데이터 연결 후 표시됩니다."];
  return (
    <section className="report-doc-section">
      <h4>{title}</h4>
      <ul>
        {list.map((item, index) => (
          <li className="text-content" key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function ReportDetail({ report }) {
  if (!report) {
    return (
      <div id="reportDetail" className="report-detail-empty">
        아직 생성된 보고서가 없습니다. 운영 로그 분석 후 주간 보고서를 생성해보세요.
      </div>
    );
  }

  const sections = normalizeSections(report.sections);

  return (
    <div id="reportDetail" className="report-detail-doc">
      <div className="report-doc-head">
        <div>
          <div className="report-eyebrow">{typeLabel(report.type)}</div>
          <div className="report-doc-title text-content">{report.title || "운영 보고서"}</div>
          <div className="report-doc-meta">
            <span>기간 {report.period || "-"}</span>
            <span>생성일 {formatDate(report.createdAt, true)}</span>
            <span>작성자 {report.author || "관리자"}</span>
            <span className={statusClass(report.status)}>{statusLabel(report.status)}</span>
          </div>
        </div>
        <div className="report-doc-actions">
          <button className="tbtn" type="button" onClick={() => callLegacy("editReport", report.id)}>
            <i className="ti ti-pencil" /> 수정
          </button>
          <button className="tbtn" type="button" onClick={() => callLegacy("shareReport", report.id)}>
            <i className="ti ti-share" /> 공유
          </button>
        </div>
      </div>
      <ReportQualityCheck />
      <ReportSection title="완료된 업무" items={sections.completed} />
      <ReportSection title="진행 중인 업무" items={sections.inProgress} />
      <ReportSection title="AI 및 기술적 상세 내용" items={sections.technical} />
      <ReportSection title="리스크 관리 및 해결 방안" items={sections.risk} />
      <ReportSection title="팀 회고" items={sections.retrospective} />
      <ReportSection title="차주 계획" items={sections.nextPlan} />
      <ReportSection title="관련 문서 / 출처" items={report.docs || ["연결된 문서가 없습니다."]} />
    </div>
  );
}

function ReportEditor({ snapshot }) {
  const editorKey = useMemo(() => {
    const draft = snapshot.currentDraft;
    return `${draft?.id || draft?.title || "draft"}-${draft?.createdAt || ""}`;
  }, [snapshot.currentDraft]);

  return (
    <div id="reportEditorWrap" className="report-editor-wrap">
      <div className="report-editor-toolbar">
        <button className="tbtn" type="button" style={{ fontWeight: 700, padding: "3px 8px" }} onClick={() => callLegacy("formatReport", "bold")}>B</button>
        <button className="tbtn" type="button" style={{ fontStyle: "italic", padding: "3px 8px" }} onClick={() => callLegacy("formatReport", "italic")}>I</button>
        <button className="tbtn" type="button" style={{ padding: "3px 8px" }} onClick={() => callLegacy("formatReport", "h1")}>H1</button>
        <button className="tbtn" type="button" style={{ padding: "3px 8px" }} onClick={() => callLegacy("formatReport", "h2")}>H2</button>
        <div className="report-divider" />
        <button className="tbtn" type="button" style={{ padding: "3px 8px" }} onClick={() => callLegacy("formatReport", "list")}>
          <i className="ti ti-list" style={{ fontSize: 12 }} />
        </button>
        <div style={{ flex: 1 }} />
        <span>AI 초안 · 직접 편집 가능</span>
      </div>
      <div
        id="reportEditor"
        key={editorKey}
        contentEditable
        suppressContentEditableWarning
        className="report-editor text-content"
        dangerouslySetInnerHTML={{ __html: snapshot.editorHtml }}
      />
      <ReportQualityCheck />
      <div className="report-editor-actions">
        <button className="tbtn" type="button" onClick={() => callLegacy("shareReport")}>
          <i className="ti ti-share" /> 공유
        </button>
        <button className="tbtn primary" type="button" onClick={() => callLegacy("saveReport")}>
          <i className="ti ti-device-floppy" /> 저장
        </button>
      </div>
    </div>
  );
}

export default function Report() {
  const [snapshot, setSnapshot] = useState(emptySnapshot);

  useEffect(() => {
    function handleReportState(event) {
      setSnapshot({ ...emptySnapshot, ...event.detail });
    }

    window.addEventListener("opsradar:report-state-updated", handleReportState);
    const timer = window.setTimeout(() => callLegacy("initReportsScreen"), 0);

    return () => {
      window.removeEventListener("opsradar:report-state-updated", handleReportState);
      window.clearTimeout(timer);
    };
  }, []);

  const isDraftMode = Boolean(snapshot.currentDraft);

  return (
    <>
      <div className="topbar report-topbar">
        <div>
          <div className="topbar-title">보고서 관리</div>
          <div className="report-topbar-sub">주간/월간 운영 보고서 생성 · 저장 · 열람</div>
        </div>
        <div className="report-top-actions">
          <div className="report-period-tabs" role="tablist" aria-label="보고서 유형">
            <button className={`tbtn ${snapshot.currentPeriod === "weekly" ? "active" : ""}`} type="button" onClick={() => callLegacy("setReportPeriod", "weekly")}>주간 보고서</button>
            <button className={`tbtn ${snapshot.currentPeriod === "monthly" ? "active" : ""}`} type="button" onClick={() => callLegacy("setReportPeriod", "monthly")}>월간 보고서</button>
          </div>
          <label className="report-search" aria-label="보고서 검색">
            <i className="ti ti-search" />
            <input
              id="reportSearchInput"
              type="search"
              placeholder="제목, 작성자, 기간 검색"
              value={snapshot.query}
              onChange={(event) => callLegacy("setReportQuery", event.target.value)}
            />
          </label>
          <button className="tbtn primary" type="button" onClick={() => callLegacy("generateReportDraft")}>
            <i className="ti ti-wand" /> AI 초안 생성
          </button>
        </div>
      </div>

      <div className="content report-content">
        <section className="report-list-panel">
          <div className="report-panel-head">
            <div>
              <div className="report-eyebrow">Archive</div>
              <h3>지난 보고서</h3>
            </div>
            <span className="report-count" id="reportListCount">{snapshot.reports.length}건</span>
          </div>
          <div id="reportList" className="report-list">
            {snapshot.reports.length ? snapshot.reports.map((report) => (
              <ReportListItem
                active={!isDraftMode && snapshot.selectedReport?.id === report.id}
                key={report.id}
                report={report}
              />
            )) : (
              <div className="report-empty-state">아직 생성된 보고서가 없습니다. 운영 로그 분석 후 보고서를 생성해보세요.</div>
            )}
          </div>
        </section>

        <section className="report-detail-panel">
          {isDraftMode ? <ReportEditor snapshot={snapshot} /> : <ReportDetail report={snapshot.selectedReport} />}
        </section>
      </div>
    </>
  );
}
