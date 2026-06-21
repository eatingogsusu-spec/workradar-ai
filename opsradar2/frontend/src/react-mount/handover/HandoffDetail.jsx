import HandoffCandidateList from "./HandoffCandidateList";
import HandoffPreview from "./HandoffPreview";
import OnboardingLearningPlan from "./OnboardingLearningPlan";
import { DEPARTMENTS, CUSTOMERS, SUPPLIERS, PERIODS, HANDOFF_REASONS, HANDOFF_SCOPES, HANDOFF_INCLUDES, ONBOARDING_INCLUDES } from "./handoverData";

const Field = ({ label, value, options, onChange }) => (
  <label className="hc-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
);
const StaticField = ({ label, value }) => <div className="hc-field hc-static-field"><span>{label}</span><strong>{value}</strong></div>;

export default function HandoffDetail(props) {
  const { type, step, conditions, candidates, selectedIds, previewData, savedDraftId, members, generating, generationNote, onBack, onStep, onCondition, onInclude, onToggle, onEdit, onRegenerate, onShare, onSave, onOpenArchive } = props;
  const onboarding = type === "onboarding";
  const includeOptions = onboarding ? ONBOARDING_INCLUDES : HANDOFF_INCLUDES;
  const stepLabels = ["조건 선택", onboarding ? "포함할 온보딩 자료 선택" : "포함할 업무 선택", onboarding ? "가이드 미리보기" : "결과 미리보기"];
  return <main className={`hc-detail-page${onboarding ? " onboarding-detail" : ""}`}>
    <header className="hc-page-head"><button type="button" className="hc-icon-btn" onClick={onBack} title="처음으로"><i className="ti ti-arrow-left" /></button><div><span>{onboarding ? "NEW EMPLOYEE" : "WORK TRANSFER"}</span><h1>{onboarding ? "신입 온보딩 생성" : "업무 인수인계 생성"}</h1></div></header>
    <nav className="hc-steps" aria-label="생성 단계">{stepLabels.map((label, index) => <button type="button" key={label} className={step === index + 1 ? "active" : ""} onClick={() => onStep(index + 1)}><b>{index + 1}</b><span>{label}</span></button>)}</nav>
    <section className={`hc-step-body${step === 3 ? " preview-wide" : ""}`}>
      {step === 1 && <div className="hc-condition-panel"><header><h2>생성 조건</h2><p>{onboarding ? "신입과 사수를 지정하면 선택한 실제 업무를 바탕으로 첫 30일 적응 플랜을 구성합니다." : "업무 기록을 찾을 범위와 결과 문서에 포함할 항목을 선택하세요."}</p></header>
        <div className="hc-form-grid">{onboarding ? <>
          <StaticField label="온보딩 대상" value="신입" /><Field label="사수" value={conditions.mentor} options={members} onChange={(v) => onCondition("mentor", v)} /><Field label="소속 팀" value={conditions.department} options={DEPARTMENTS} onChange={(v) => onCondition("department", v)} /><Field label="조회 기간" value={conditions.period} options={PERIODS} onChange={(v) => onCondition("period", v)} />
        </> : <>
          <Field label="기존 담당자" value={conditions.owner} options={members} onChange={(v) => onCondition("owner", v)} /><Field label="신규 담당자" value={conditions.receiver} options={members} onChange={(v) => onCondition("receiver", v)} /><Field label="기존 담당자 소속 팀" value={conditions.department} options={DEPARTMENTS} onChange={(v) => onCondition("department", v)} /><Field label="인수인계 사유" value={conditions.reason} options={HANDOFF_REASONS} onChange={(v) => onCondition("reason", v)} /><Field label="업무 범위" value={conditions.scope} options={HANDOFF_SCOPES} onChange={(v) => onCondition("scope", v)} /><Field label="고객사" value={conditions.customer} options={CUSTOMERS} onChange={(v) => onCondition("customer", v)} /><Field label="구매처" value={conditions.supplier} options={SUPPLIERS} onChange={(v) => onCondition("supplier", v)} /><Field label="자료 필터 부서" value={conditions.filterDepartment} options={["전체", ...DEPARTMENTS]} onChange={(v) => onCondition("filterDepartment", v)} /><Field label="참고 기간" value={conditions.period} options={PERIODS} onChange={(v) => onCondition("period", v)} />
        </>}</div>
        <div className="hc-includes"><h3>포함할 자료</h3><div>{includeOptions.map((value) => <label key={value}><input type="checkbox" checked={conditions.includes.includes(value)} onChange={() => onInclude(value)} /><span><i className="ti ti-check" /></span>{value}</label>)}</div></div>
      </div>}
      {step === 2 && <HandoffCandidateList candidates={candidates} selectedIds={selectedIds} onToggle={onToggle} type={type} />}
      {step === 3 && (generating
        ? <div className="hc-generating"><span className="hc-spinner" aria-hidden="true" /><p>{onboarding ? "AI가 신입의 첫 30일 적응 플랜을 구성 중입니다…" : "AI가 인수인계서를 생성 중입니다…"}</p></div>
        : <>
            {generationNote && <div className="hc-notice hc-fallback-note"><i className="ti ti-info-circle" /><span>{generationNote}</span></div>}
            {onboarding
              ? <OnboardingLearningPlan previewData={previewData} candidates={candidates} selectedIds={selectedIds} conditions={conditions} savedDraftId={savedDraftId} onRegenerate={onRegenerate} onSave={onSave} onOpenArchive={onOpenArchive} />
              : <HandoffPreview previewData={previewData} type={type} savedDraftId={savedDraftId} onPreviewChange={onEdit} onRegenerate={onRegenerate} onShare={onShare} onSave={onSave} onOpenArchive={onOpenArchive} />}
          </>)}
    </section>
    {step < 3 && <footer className="hc-step-footer"><span>{step === 2 ? `${selectedIds.length}개 자료 선택됨` : "조건을 확인한 뒤 다음 단계로 이동하세요."}</span><button type="button" className="primary" onClick={() => onStep(step + 1)}>{step === 1 ? (onboarding ? "온보딩 자료 선택" : "포함할 업무 선택") : "미리보기 생성"}<i className="ti ti-arrow-right" /></button></footer>}
  </main>;
}
