import { useMemo, useState } from "react";
import { downloadSourceDocument } from "./documentDownload";

const copyPreview = (value) => ({ ...value, sections: value.sections.map(([title, items]) => [title, [...items]]) });
const cleanLine = (value) => String(value || "").replace(/^\s*(?:[-*•▸]|\d+[.)])\s*/, "").replace(/\*\*|__/g, "").trim();

function sectionIndex(sections, words) {
  return sections.findIndex(([title]) => words.some((word) => title.includes(word)));
}

function HandoffBlock({ eyebrow, title, icon, items, tone = "default" }) {
  return <section className={`hc-handoff-block ${tone}`}><header><div><span>{eyebrow}</span><h3><i className={`ti ${icon}`} />{title}</h3></div></header><ol>{items.length ? items.map((item, index) => <li key={`${title}-${index}`}>{cleanLine(item)}</li>) : <li>확인할 항목이 없습니다.</li>}</ol></section>;
}

export default function HandoffPreview({ previewData, type, savedDraftId, onPreviewChange, onRegenerate, onSave, onOpenArchive, archived = false }) {
  const [isEditingPreview, setIsEditingPreview] = useState(false);
  const [editablePreviewData, setEditablePreviewData] = useState(null);
  const startEditing = () => { setEditablePreviewData(copyPreview(previewData)); setIsEditingPreview(true); };
  const updateSection = (index, value) => setEditablePreviewData((current) => ({ ...current, sections: current.sections.map((section, sectionIndexValue) => sectionIndexValue === index ? [section[0], value.split("\n")] : section) }));
  const saveEditing = () => { const next = { ...editablePreviewData, sections: editablePreviewData.sections.map(([title, items]) => [title, items.map((item) => item.trim()).filter(Boolean)]) }; onPreviewChange(next); setEditablePreviewData(null); setIsEditingPreview(false); };
  const displayed = isEditingPreview ? editablePreviewData : previewData;
  const layout = useMemo(() => {
    const sections = displayed.sections || [];
    const overviewIndex = sectionIndex(sections, ["개요"]);
    const priorityIndex = sectionIndex(sections, ["우선순위", "즉시 조치"]);
    const workIndex = sectionIndex(sections, ["진행 중 업무", "업무 및 이슈", "미해결 이슈"]);
    const referenceIndex = sectionIndex(sections, ["참고 자료", "참고자료"]);
    const used = new Set([overviewIndex, priorityIndex, workIndex, referenceIndex].filter((index) => index >= 0));
    return {
      overview: overviewIndex >= 0 ? sections[overviewIndex] : ["인수인계 개요", []],
      priority: priorityIndex >= 0 ? sections[priorityIndex] : ["우선순위 및 즉시 조치 사항", []],
      work: workIndex >= 0 ? sections[workIndex] : ["진행 중 업무 및 이슈", []],
      reference: referenceIndex >= 0 ? sections[referenceIndex] : ["참고 자료", []],
      extras: sections.filter((_, index) => !used.has(index)),
    };
  }, [displayed]);
  const download = (docId, title) => downloadSourceDocument(docId, title).catch((error) => window.showToast?.(error.message || "문서를 불러올 수 없습니다.", "warn") || alert("문서를 불러올 수 없습니다."));

  if (isEditingPreview) return <article className="hc-handoff-plan editing"><header className="hc-handoff-head"><div><span>DOCUMENT EDIT MODE</span><h2>{displayed.title}</h2></div><span className="hc-status">편집 중</span></header><div className="hc-handoff-edit-grid">{displayed.sections.map(([label, values], index) => <section key={`${label}-${index}`}><h3>{label}</h3><textarea value={values.join("\n")} onChange={(event) => updateSection(index, event.target.value)} aria-label={`${label} 내용 편집`} /></section>)}</div><footer className="hc-handoff-actions"><button type="button" onClick={() => { setEditablePreviewData(null); setIsEditingPreview(false); }}><i className="ti ti-x" />취소</button><button type="button" className="primary" onClick={saveEditing}><i className="ti ti-device-floppy" />수정 저장</button></footer></article>;

  return <article className="hc-handoff-plan">
    <header className="hc-handoff-head"><div><span>{archived ? "SAVED TRANSFER PLAN" : "AI GENERATED TRANSFER PLAN"}</span><h2>{displayed.title}</h2></div><span className="hc-status">초안</span></header>
    <section className="hc-handoff-overview"><header><span>01</span><h3>{layout.overview[0]}</h3></header><p>{(layout.overview[1] || []).map(cleanLine).join(" ") || "선택된 업무 자료를 바탕으로 인수인계 범위를 확인합니다."}</p></section>
    <div className="hc-handoff-main"><HandoffBlock eyebrow="02" title={layout.priority[0]} icon="ti-flag" items={layout.priority[1] || []} tone="priority" /><HandoffBlock eyebrow="03" title={layout.work[0]} icon="ti-route" items={layout.work[1] || []} tone="work" /></div>
    <div className="hc-handoff-support"><HandoffBlock eyebrow="04" title={layout.reference[0]} icon="ti-files" items={layout.reference[1] || []} tone="reference" />{layout.extras.map(([title, items], index) => <HandoffBlock key={`${title}-${index}`} eyebrow={`0${index + 5}`} title={title} icon="ti-notes" items={items || []} />)}</div>
    {displayed.documents?.length > 0 && <section className="hc-handoff-documents"><header><div><span>첨부파일</span><h3>원본 참고 문서</h3></div><small>원본 파일을 내려받아 근거를 확인할 수 있습니다.</small></header><div>{displayed.documents.map(({ doc_id, title }) => <button key={doc_id} type="button" onClick={() => download(doc_id, title)}><i className="ti ti-file-download" /><span>{title}</span><i className="ti ti-download" /></button>)}</div></section>}
    <footer className="hc-handoff-actions"><button type="button" onClick={startEditing}><i className="ti ti-edit" />수정하기</button>{!archived && <><button type="button" onClick={() => onRegenerate(type)}><i className="ti ti-refresh" />다시 생성</button><button type="button" className="primary" onClick={onSave}><i className="ti ti-device-floppy" />초안 저장</button></>}</footer>
    {!archived && savedDraftId && <div className="hc-save-followup"><span><i className="ti ti-circle-check" />초안이 인수인계 문서함에 저장되었습니다.</span><button type="button" onClick={onOpenArchive}>문서함 보기<i className="ti ti-arrow-right" /></button></div>}
  </article>;
}
