import { useEffect, useMemo, useState } from "react";
import { downloadSourceDocument } from "./documentDownload";

function normalizeLine(value) {
  return String(value || "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
    .replace(/\*\*|__|```|'''|`/g, "")
    .trim();
}

function readSection(previewData, marker) {
  const section = previewData.sections?.find(([title]) => title.includes(marker));
  return section?.[1]?.map(normalizeLine).filter(Boolean) || [];
}

function checklistItems(previewData) {
  const ignored = /^(사수 확인 질문|참고 자료|참고문서|연결된 참고 문서|문서 목록|확인 질문)$/;
  return readSection(previewData, "5.").filter((item) => !ignored.test(item) && !/^DOC[-_]/i.test(item) && !/\.(md|txt|pdf|docx|csv)$/i.test(item));
}

function PlanStage({ icon, title, subtitle, items, accent }) {
  return <section className={`hc-onboarding-stage ${accent}`}>
    <header><i className={`ti ${icon}`} /><div><strong>{title}</strong><span>{subtitle}</span></div></header>
    <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
  </section>;
}

function ProgressButton({ checked, label, onToggle }) {
  return <button type="button" className={`hc-progress-toggle${checked ? " done" : ""}`} aria-label={`${label} ${checked ? "완료 취소" : "완료 표시"}`} aria-pressed={checked} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggle(); }}><i className={checked ? "ti ti-check" : "ti ti-circle"} /></button>;
}

export default function OnboardingLearningPlan({ previewData, candidates, selectedIds, conditions, savedDraftId, onRegenerate, onSave, onOpenArchive, archived = false }) {
  const actualCandidates = useMemo(() => candidates.filter((candidate) => selectedIds.includes(candidate.id) && (candidate.id.startsWith("todo_") || candidate.id.startsWith("issue_"))), [candidates, selectedIds]);
  const practiceTodos = actualCandidates.filter((candidate) => candidate.id.startsWith("todo_"));
  const risks = actualCandidates.filter((candidate) => candidate.id.startsWith("issue_"));
  const mentorChecks = checklistItems(previewData);
  const firstDay = readSection(previewData, "2.");
  const firstWeek = readSection(previewData, "3.");
  const firstMonth = readSection(previewData, "4.");
  const overview = readSection(previewData, "1.");
  const storageKey = useMemo(() => `opsradar_onboarding_progress_${encodeURIComponent(["신입", conditions.department, ...actualCandidates.map((candidate) => candidate.id).sort()].join("|"))}`, [conditions.department, actualCandidates]);
  const [progress, setProgress] = useState({});

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      setProgress(saved && typeof saved === "object" ? saved : {});
    } catch {
      setProgress({});
    }
  }, [storageKey]);

  const toggleProgress = (key) => {
    setProgress((current) => {
      const next = { ...current, [key]: !current[key] };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch (_) { window.showToast?.("학습 진행 상태는 이 브라우저에서만 저장됩니다.", "warn"); }
      return next;
    });
  };

  const trackedItems = [...practiceTodos.map((candidate) => `task:${candidate.id}`), ...mentorChecks.map((_, index) => `mentor:${index}`)];
  const completeCount = trackedItems.filter((key) => progress[key]).length;
  const completionRate = trackedItems.length ? Math.round((completeCount / trackedItems.length) * 100) : 0;
  const documentList = previewData.documents || [];
  const download = (docId, title) => downloadSourceDocument(docId, title).catch((error) => window.showToast?.(error.message || "문서를 불러올 수 없습니다.", "warn") || alert("문서를 불러올 수 없습니다."));

  return <article className="hc-onboarding-plan">
    <header className="hc-onboarding-head"><div><span>{archived ? "SAVED ONBOARDING PLAN" : "NEW MEMBER LEARNING PLAN"}</span><h2>{previewData.title}</h2><p>{conditions.department} · 대상 신입 · 사수 {conditions.mentor || "확인 필요"}</p></div><div className="hc-onboarding-progress"><span>개인 학습 진행률</span><strong>{completeCount}/{trackedItems.length || 0}</strong><div role="progressbar" aria-label="개인 학습 진행률" aria-valuenow={completionRate} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${completionRate}%` }} /></div></div></header>

    <section className="hc-onboarding-map"><header><div><span>01</span><h3>업무 지도</h3></div><small>선택된 실제 운영 자료만 반영</small></header><p>{overview.length ? overview.join(" ") : "선택한 운영 자료를 바탕으로 업무 흐름을 확인합니다."}</p></section>

    <section className="hc-onboarding-route" aria-label="3 Step 업무 적응 단계"><PlanStage icon="ti-compass" title="1 Step" subtitle="흐름과 자료를 이해합니다" items={firstDay.length ? firstDay : ["선택된 자료의 현재 상태와 출처를 사수와 함께 확인합니다."]} accent="day" /><PlanStage icon="ti-users" title="2 Step" subtitle="사수와 실제 업무를 연습합니다" items={firstWeek.length ? firstWeek : ["선택된 Todo의 처리 흐름과 완료 기준을 사수와 함께 확인합니다."]} accent="week" /><PlanStage icon="ti-shield-check" title="3 Step" subtitle="독립 처리 범위와 위험 기준을 합의합니다" items={firstMonth.length ? firstMonth : ["독립 처리 범위와 즉시 공유할 조건을 사수와 합의합니다."]} accent="month" /></section>

    <div className="hc-onboarding-workspace">
      <section className="hc-onboarding-practice"><header><div><span>02</span><h3>사수와 하는 실전 연습</h3></div><small>완료는 개인 학습 기록으로만 저장됩니다.</small></header>{practiceTodos.length ? <div className="hc-onboarding-task-list">{practiceTodos.map((candidate) => { const key = `task:${candidate.id}`; return <article className={`hc-onboarding-task${progress[key] ? " done" : ""}`} key={candidate.id}><ProgressButton checked={Boolean(progress[key])} label={candidate.title} onToggle={() => toggleProgress(key)} /><div><strong>{candidate.title}</strong><small>{candidate.meta || "담당자 확인 필요"}{candidate.dueAt ? ` · 마감 ${candidate.dueAt}` : ""}</small>{candidate.description && <p>{candidate.description}</p>}</div><em className={candidate.priority?.toLowerCase()}>{candidate.priority || "Medium"}</em></article>; })}</div> : <p className="hc-onboarding-empty">선택된 진행 Todo가 없습니다. 사수와 함께 연습할 업무를 먼저 선택하세요.</p>}</section>

      <section className="hc-onboarding-mentor"><header><div><span>03</span><h3>사수 확인 및 참고 자료</h3></div><small>단독 처리 전 기준을 합의합니다.</small></header><div className="hc-onboarding-check-list">{(mentorChecks.length ? mentorChecks : ["처리 우선순위와 완료 기준을 함께 확인", "단독 처리 가능한 범위와 즉시 공유할 조건을 합의"]).map((item, index) => { const key = `mentor:${index}`; return <article key={key} className={progress[key] ? "done" : ""}><ProgressButton checked={Boolean(progress[key])} label={item} onToggle={() => toggleProgress(key)} /><span>{item}</span></article>; })}</div>{risks.length > 0 && <div className="hc-onboarding-risk"><strong><i className="ti ti-alert-triangle" />사수 검토가 필요한 리스크</strong><ul>{risks.map((risk) => <li key={risk.id}>{risk.title}<span>{risk.priority || "Medium"}</span></li>)}</ul></div>}</section>
    </div>

    <section className="hc-onboarding-documents"><header><div><span>04</span><h3>원본 첨부파일</h3></div><small>출처 문서는 원본 파일로 확인합니다.</small></header>{documentList.length ? <div>{documentList.map(({ doc_id, title }) => <button key={doc_id} type="button" onClick={() => download(doc_id, title)}><i className="ti ti-file-download" /><span>{title}</span><i className="ti ti-download" /></button>)}</div> : <p>연결된 참고 문서가 없습니다. 선택 자료의 출처 문서는 사수에게 확인하세요.</p>}</section>

    {!archived && <><footer className="hc-onboarding-actions"><button type="button" onClick={onRegenerate}><i className="ti ti-refresh" />AI로 다시 구성</button><button type="button" className="primary" onClick={onSave}><i className="ti ti-device-floppy" />플랜 저장</button></footer>{savedDraftId && <div className="hc-save-followup"><span><i className="ti ti-circle-check" />온보딩 플랜을 문서함에 저장했습니다.</span><button type="button" onClick={onOpenArchive}>문서함 보기<i className="ti ti-arrow-right" /></button></div>}</>}
  </article>;
}
