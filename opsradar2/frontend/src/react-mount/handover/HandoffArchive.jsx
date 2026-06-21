import HandoffPreview from "./HandoffPreview";

function confirmDelete(onDelete, id) {
  if (window.confirm("이 인수인계 문서를 삭제할까요?")) onDelete(id);
}

export default function HandoffArchive({ archives, filter, selected, onFilter, onOpen, onBack, onList, onClone, onShare, onPreviewChange, onDelete }) {
  if (selected) return <main className="hc-archive">
    <header className="hc-page-head"><button className="hc-icon-btn" type="button" onClick={onList} title="문서함으로"><i className="ti ti-arrow-left" /></button><div><span>ARCHIVED DOCUMENT</span><h1>{selected.title}</h1></div></header>
    <div className="hc-archive-meta"><span className="hc-status">초안</span><span><i className="ti ti-calendar" />{new Date(selected.createdAt).toLocaleString("ko-KR")}</span><span><i className="ti ti-user" />{selected.createdBy}</span></div>
    <section className="hc-archive-summary"><h2>선택 조건 요약</h2><dl><div><dt>기존 담당자 / 대상자</dt><dd>{selected.owner || selected.target}</dd></div><div><dt>신규 담당자</dt><dd>{selected.receiver || "-"}</dd></div><div><dt>소속 팀</dt><dd>{selected.department}</dd></div><div><dt>고객사 / 구매처</dt><dd>{selected.customer} / {selected.supplier}</dd></div><div><dt>업무 범위</dt><dd>{selected.scope || "온보딩 가이드"}</dd></div><div><dt>참고 기간</dt><dd>{selected.period}</dd></div></dl></section>
    <section className="hc-archive-materials"><h2>포함된 업무 자료</h2><div>{(selected.selectedCandidates || []).map((item) => <span key={item.id}>{item.group} · {item.title}</span>)}</div></section>
    <HandoffPreview previewData={selected.previewData} archived onPreviewChange={(previewData) => onPreviewChange(selected.id, previewData)} />
    <footer className="hc-archive-actions"><button type="button" className="hc-delete-btn" onClick={() => confirmDelete(onDelete, selected.id)}><i className="ti ti-trash" />삭제</button><button type="button" onClick={onShare}><i className="ti ti-share" />공유하기</button><button type="button" onClick={() => onClone(selected)}><i className="ti ti-copy" />복제해서 새로 만들기</button></footer>
  </main>;

  const visible = archives.filter((item) => filter === "all" || item.type === filter);
  return <main className="hc-archive">
    <header className="hc-page-head"><button className="hc-icon-btn" type="button" onClick={onBack} title="처음으로"><i className="ti ti-arrow-left" /></button><div><span>SAVED DOCUMENTS</span><h1>인수인계 문서함</h1></div></header>
    <div className="hc-archive-toolbar"><div>{[["all", "전체"], ["handoff", "업무 인수인계"], ["onboarding", "신입 온보딩"]].map(([value, label]) => <button type="button" className={filter === value ? "active" : ""} onClick={() => onFilter(value)} key={value}>{label}</button>)}</div><span>{visible.length}건</span></div>
    {visible.length ? <section className="hc-archive-list">{visible.map((item) => <div className="hc-archive-card-wrap" key={item.id}><button type="button" className="hc-archive-card" onClick={() => onOpen(item.id)}><span className="hc-archive-kind">{item.type === "onboarding" ? "신입 온보딩" : "업무 인수인계"} · 초안</span><h2>{item.title}</h2><p>{item.owner || item.target} {item.receiver ? `→ ${item.receiver}` : ""} · {item.department}</p><p>{item.customer || "전체 고객사"} · {item.scope || "온보딩 가이드"}</p><footer><span>{item.createdBy} · {new Date(item.createdAt).toLocaleDateString("ko-KR")}</span><i className="ti ti-chevron-right" /></footer></button><button type="button" className="hc-archive-card-delete" title="삭제" onClick={(e) => { e.stopPropagation(); confirmDelete(onDelete, item.id); }}><i className="ti ti-trash" /></button></div>)}</section> : <section className="hc-empty"><i className="ti ti-archive" /><h2>저장된 문서가 없습니다</h2><p>결과 미리보기에서 초안을 저장하면 이 문서함에 표시됩니다.</p></section>}
  </main>;
}
