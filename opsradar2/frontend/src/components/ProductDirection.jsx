export const mockAiCandidate = {
  id: "candidate_001",
  type: "todo",
  title: "결제 API 응답 지연 원인 확인",
  description: "결제 API timeout 원인 분석이 필요합니다.",
  reviewStatus: "pending_review",
  sourceDocument: "operation_log_test_20260605.txt",
  evidenceText:
    "일부 고객 결제 요청에서 timeout이 발생했으며 고객 문의가 증가할 가능성이 있습니다.",
  aiReason: "결제 실패 증가 가능성이 있어 High Risk 관련 Todo로 제안합니다.",
  sourceType: "AI 제안",
  suggestedAssignees: ["백엔드 담당자 A", "인프라 담당자 B"],
  suggestedDueDate: "2026-06-05T16:00:00",
  priority: "high",
};

export const mockDashboardReview = {
  pendingAiTodos: 3,
  pendingAiIssues: 1,
  pendingReportItems: 2,
  highRiskTitle: "결제 API 응답 지연",
  highRiskDue: "오늘 16:00",
  relatedTodos: 2,
  reportEvidenceGaps: 2,
  unassignedTodos: 1,
  missingDueDateTodos: 3,
};

export const mockReportGap = {
  evidenceBackedItems: 5,
  missingEvidenceItems: 2,
  missingAssigneeItems: 1,
  missingDueDateItems: 3,
  possibleConflictItems: 1,
};

const reviewStatusMap = {
  ai_suggested: ["b-accent", "AI 제안"],
  pending_review: ["b-warn", "검토 대기"],
  edited: ["b-gray", "수정됨"],
  approved: ["b-success", "승인됨"],
  rejected: ["b-danger", "반려됨"],
  official: ["b-accent", "공식 반영"],
};

export function ReviewStatusBadge({ status = "pending_review" }) {
  const [className, label] = reviewStatusMap[status] || reviewStatusMap.pending_review;
  return <span className={`badge ${className} review-status-badge`}>{label}</span>;
}

export function EvidencePanel({ evidence = mockAiCandidate, compact = false }) {
  return (
    <section className={`evidence-panel${compact ? " compact" : ""}`}>
      <div className="evidence-panel-head">
        <div>
          <span className="evidence-eyebrow">근거 패널</span>
          <h4>출처와 AI 판단 이유</h4>
        </div>
        <ReviewStatusBadge status={evidence.reviewStatus || "pending_review"} />
      </div>
      <dl className="evidence-grid">
        <div>
          <dt>출처 문서</dt>
          <dd>{evidence.sourceDocument || "operation_log_test_20260605.txt"}</dd>
        </div>
        <div>
          <dt>생성 방식</dt>
          <dd>{evidence.sourceType || "AI 제안"}</dd>
        </div>
        <div className="wide">
          <dt>근거 문장</dt>
          <dd>{evidence.evidenceText}</dd>
        </div>
        <div className="wide">
          <dt>AI 판단 이유</dt>
          <dd>{evidence.aiReason}</dd>
        </div>
      </dl>
    </section>
  );
}

export function ReviewCommandBar({ status = "pending_review" }) {
  return (
    <div className="review-command-bar">
      <ReviewStatusBadge status="ai_suggested" />
      <ReviewStatusBadge status={status} />
      <div className="review-actions">
        <button className="tbtn" type="button">근거 보기</button>
        <button className="tbtn primary" type="button">승인</button>
        <button className="tbtn" type="button">수정</button>
        <button className="tbtn danger-soft" type="button">반려</button>
      </div>
    </div>
  );
}

export function AiCandidatePreview({ title = mockAiCandidate.title }) {
  return (
    <article className="ai-candidate-preview">
      <div className="ai-candidate-top">
        <div>
          <span className="evidence-eyebrow">AI 제안 항목</span>
          <h4>{title}</h4>
        </div>
        <ReviewStatusBadge status="pending_review" />
      </div>
      <p>{mockAiCandidate.description}</p>
      <ReviewCommandBar />
      <EvidencePanel evidence={mockAiCandidate} compact />
    </article>
  );
}

export function DashboardReviewCards({ data = mockDashboardReview, onNav }) {
  return (
    <section className="dashboard-review-grid">
      <article className="dashboard-review-card">
        <div className="dashboard-review-icon blue"><i className="ti ti-clipboard-check" /></div>
        <div>
          <span className="evidence-eyebrow">AI 검토 대기</span>
          <h3>오늘 확인할 AI 제안</h3>
          <p>Todo 후보 {data.pendingAiTodos}건 · Issue 후보 {data.pendingAiIssues}건 · Report 항목 후보 {data.pendingReportItems}건</p>
          <button className="tbtn primary" type="button" onClick={() => onNav?.("todo")}>후보 검토하기</button>
        </div>
      </article>
      <article className="dashboard-review-card high-risk">
        <div className="dashboard-review-icon red"><i className="ti ti-alert-triangle" /></div>
        <div>
          <span className="evidence-eyebrow">High Risk</span>
          <h3>{data.highRiskTitle}</h3>
          <p>마감: {data.highRiskDue} · 관련 Todo {data.relatedTodos}건</p>
          <div className="inline-actions">
            <button className="tbtn" type="button">근거 보기</button>
            <button className="tbtn" type="button" onClick={() => onNav?.("todo")}>Todo 확인</button>
          </div>
        </div>
      </article>
      <article className="dashboard-review-card gap">
        <div className="dashboard-review-icon amber"><i className="ti ti-file-search" /></div>
        <div>
          <span className="evidence-eyebrow">근거 부족 / 데이터 부족</span>
          <h3>보완 필요 항목</h3>
          <p>보고서 근거 부족 {data.reportEvidenceGaps}건 · 담당자 미지정 Todo {data.unassignedTodos}건 · 마감일 누락 Todo {data.missingDueDateTodos}건</p>
          <button className="tbtn" type="button" onClick={() => onNav?.("reports")}>보완 필요 항목 보기</button>
        </div>
      </article>
    </section>
  );
}

export function ReportQualityCheck({ data = mockReportGap }) {
  const items = [
    ["근거 있는 항목", data.evidenceBackedItems, "ok"],
    ["근거 부족 항목", data.missingEvidenceItems, "warn"],
    ["담당자 누락", data.missingAssigneeItems, "warn"],
    ["마감일 누락", data.missingDueDateItems, "warn"],
    ["충돌 가능 기록", data.possibleConflictItems, "danger"],
  ];

  return (
    <section className="report-quality-check">
      <div className="report-quality-head">
        <div>
          <span className="evidence-eyebrow">보고서 검증 체크</span>
          <h4>최종 저장 전 근거와 누락 항목을 확인합니다</h4>
        </div>
        <ReviewStatusBadge status="pending_review" />
      </div>
      <div className="report-quality-grid">
        {items.map(([label, value, tone]) => (
          <div className={`report-quality-item ${tone}`} key={label}>
            <strong>{value}건</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <EvidencePanel compact evidence={{
        ...mockAiCandidate,
        aiReason: "보고서 항목별 출처, 담당자, 마감일이 있는지 검토한 뒤 공식 보고서로 반영해야 합니다.",
      }} />
      <div className="review-actions report-actions">
        <button className="tbtn" type="button">수정</button>
        <button className="tbtn" type="button">근거 보기</button>
        <button className="tbtn" type="button">보완 필요 표시</button>
        <button className="tbtn primary" type="button">최종 저장</button>
      </div>
    </section>
  );
}
