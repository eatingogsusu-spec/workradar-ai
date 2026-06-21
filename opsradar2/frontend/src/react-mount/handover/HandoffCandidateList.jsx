export default function HandoffCandidateList({ candidates, selectedIds, onToggle, type }) {
  const groups = [...new Set(candidates.map((item) => item.group))];
  const guidance = type === "onboarding"
    ? "현재 진행 Todo와 미해결 이슈입니다. 신입이 사수와 함께 익힐 실제 업무 자료만 선택하세요."
    : "AI가 조건에 맞는 Todo, 이슈, 보고서와 문서를 추천했습니다. 인수인계서에 포함할 업무를 선택하세요.";
  return <div className="hc-candidates"><div className="hc-notice"><i className="ti ti-sparkles" /><span>{guidance}</span></div>{groups.map((group) => { const items = candidates.filter((item) => item.group === group); return <section className="hc-candidate-group" key={group}><header><h3>{group}</h3><span>{items.filter((item) => selectedIds.includes(item.id)).length}/{items.length}</span></header><div className="hc-candidate-list">{items.map((item) => <label className="hc-candidate" key={item.id}><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} /><span className="hc-checkmark"><i className="ti ti-check" /></span><span className="hc-candidate-copy"><strong>{item.title}</strong><small>{item.meta}</small></span><span className={`hc-priority ${item.priority.toLowerCase()}`}>{item.priority}</span></label>)}</div></section>; })}</div>;
}
